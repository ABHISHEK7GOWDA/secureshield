import { logger } from "../config/logger";
import { isMongoMock } from "../config/db";
import { mockDb } from "../config/mockDb";
import SessionModel from "../models/session";
import TrustedDeviceModel from "../models/device";
import SecurityAlertModel, { AlertSeverity, AlertType } from "../models/alert";
import RiskAssessmentModel from "../models/assessment";
import { BiometricService, KeystrokeTelemetry, MouseTelemetry } from "./biometric.service";
import { GeofenceService, GeoLocation } from "./geofence.service";

export interface AuthenticationAttempt {
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  deviceName: string;
  keystrokeTelemetry?: KeystrokeTelemetry;
  mouseTelemetry?: MouseTelemetry;
  currentGps?: GeoLocation;
}

export class ThreatService {
  static async evaluateRisk(attempt: AuthenticationAttempt): Promise<{
    riskScore: number;
    triggers: string[];
    actionTaken: "allow" | "require_mfa" | "block";
    assessmentId: string;
  }> {
    const {
      userId,
      ipAddress,
      userAgent,
      deviceFingerprint,
      deviceName,
      keystrokeTelemetry,
      mouseTelemetry,
      currentGps,
    } = attempt;

    let riskScore = 0;
    const triggers: string[] = [];
    let isBotFlag = false;

    logger.info(`🔍 Evaluating login threat score for user: ${userId} (IP: ${ipAddress})`);

    // 1. Device Familiarity Check
    let device: any;
    if (isMongoMock) {
      device = mockDb.findOne("TrustedDevice", { userId, fingerprint: deviceFingerprint });
    } else {
      device = await TrustedDeviceModel.findOne({ userId, fingerprint: deviceFingerprint });
    }

    if (!device) {
      riskScore += 20;
      triggers.push("unknown_device");
      logger.warn(`⚠️ Unknown device fingerprint detected for user: ${userId}`);

      // Auto-register device as untrusted initially
      const newDevice = {
        userId,
        fingerprint: deviceFingerprint,
        deviceName: deviceName || "Unknown Hardware Sig",
        ipAddress,
        lastUsedAt: new Date(),
        isTrusted: false,
      };

      if (isMongoMock) {
        mockDb.insertOne("TrustedDevice", newDevice);
      } else {
        await new TrustedDeviceModel(newDevice).save();
      }
    } else if (!device.isTrusted) {
      riskScore += 10;
      triggers.push("untrusted_device");
      
      // Update last used time
      if (isMongoMock) {
        mockDb.updateOne("TrustedDevice", { _id: device._id }, { lastUsedAt: new Date(), ipAddress });
      } else {
        device.lastUsedAt = new Date();
        device.ipAddress = ipAddress;
        await device.save();
      }
    }

    // 2. IP Reputation Check
    const reputation = GeofenceService.checkIpReputation(ipAddress);
    if (reputation.score > 40) {
      riskScore += 25;
      triggers.push("suspicious_ip");
      logger.warn(`⚠️ High-risk IP reputation evaluated: ${reputation.score} (Details: ${reputation.details})`);
      
      await this.triggerAlert(
        userId,
        AlertType.SUSPICIOUS_LOGIN,
        AlertSeverity.MEDIUM,
        ipAddress,
        userAgent,
        `Suspicious IP attempt detected: ${reputation.details}`,
        riskScore
      );
    }

    // 3. Geofencing & Location Check
    const currentLoc = await GeofenceService.geolocateIp(ipAddress);
    const resolvedGps = currentGps || { latitude: currentLoc.latitude, longitude: currentLoc.longitude };

    // Find if the user has a saved trusted location profile
    let trustedLocation: any = null;
    let profiles: any[];
    if (isMongoMock) {
      profiles = mockDb.find("BehavioralProfile", { userId });
      trustedLocation = profiles.length > 0 ? profiles[0].location : null;
    } else {
      // In MongoDB, we save trusted locations inside the User profile or a special collection
      // For simplicity, we can lookup if user has a session location profile, or use local baseline
    }

    // We can simulate trusted geofencing constraints:
    // If the login is > 500 meters from their typical geolocation baseline, flag location outlier
    // Let's retrieve their last valid session location
    let lastSession: any;
    if (isMongoMock) {
      const sessions = mockDb.find<any>("Session", { userId, isValid: true });
      lastSession = sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    } else {
      lastSession = await SessionModel.findOne({ userId, isValid: true }).sort({ createdAt: -1 });
    }

    if (lastSession && lastSession.location && lastSession.location.latitude) {
      const distance = GeofenceService.calculateDistance(
        { latitude: resolvedGps.latitude, longitude: resolvedGps.longitude },
        { latitude: lastSession.location.latitude, longitude: lastSession.location.longitude }
      );

      if (distance > 500) {
        // More than 500m geofence outlier
        const distanceKm = distance / 1000;
        riskScore += distanceKm > 100 ? 30 : 15;
        triggers.push("geofence_outlier");
        logger.warn(`⚠️ Geofencing Alert: Login is ${distanceKm.toFixed(2)} km from last active session location.`);

        if (distanceKm > 100) {
          await this.triggerAlert(
            userId,
            AlertType.GEOLOCATION_OUTLIER,
            AlertSeverity.MEDIUM,
            ipAddress,
            userAgent,
            `Login attempt in location ${distanceKm.toFixed(1)} km away from baseline`,
            riskScore
          );
        }
      }

      // 4. Impossible Travel Check
      const travel = GeofenceService.checkImpossibleTravel(
        { coords: lastSession.location as GeoLocation, timestamp: new Date(lastSession.createdAt) },
        { coords: resolvedGps, timestamp: new Date() }
      );

      if (travel.impossible) {
        riskScore += 50;
        triggers.push("impossible_travel");
        logger.error(`🚨 IMPOSSIBLE TRAVEL: Speed required was ${travel.speedKmh.toFixed(1)} km/h.`);
        
        await this.triggerAlert(
          userId,
          AlertType.IMPOSSIBLE_TRAVEL,
          AlertSeverity.HIGH,
          ipAddress,
          userAgent,
          `Impossible travel velocity detected: user traveling at ${travel.speedKmh.toFixed(0)} km/h over ${travel.distanceKm.toFixed(0)} km.`,
          riskScore
        );
      }
    }

    // 5. Biometric Mouse Telemetry Check
    if (mouseTelemetry) {
      const mouseCheck = BiometricService.verifyMouseMovement(mouseTelemetry);
      if (mouseCheck.isBot) {
        isBotFlag = true;
        riskScore = 100;
        triggers.push("bot_behavior_detected");
        logger.error(`🚨 ROBOTIC MOUSE PATTERN: ${mouseCheck.details}`);
        
        await this.triggerAlert(
          userId,
          AlertType.BRUTE_FORCE,
          AlertSeverity.CRITICAL,
          ipAddress,
          userAgent,
          `Robotic mouse trajectory detected: ${mouseCheck.details}`,
          riskScore
        );
      }
    }

    // 6. Keystroke Dynamics Telemetry Check
    if (keystrokeTelemetry && !isBotFlag) {
      const keystrokeCheck = await BiometricService.verifyKeystroke(userId, keystrokeTelemetry);
      if (keystrokeCheck.trustScore < 60) {
        riskScore += 30;
        triggers.push("keystroke_mismatch");
        logger.warn(`⚠️ Keystroke rhythm mismatch detected (Confidence: ${keystrokeCheck.trustScore}%)`);
      }
    }

    // Cap score at 100
    riskScore = Math.min(riskScore, 100);

    // Policy Decision
    let actionTaken: "allow" | "require_mfa" | "block" = "require_mfa";
    if (isBotFlag || riskScore >= 75) {
      actionTaken = "block";
    } else if (riskScore < 30 && device && device.isTrusted) {
      // Allow seamless login with minimal check if risk is low and device is trusted
      actionTaken = "allow";
    }

    // Create Risk Assessment Record
    const assessmentData = {
      userId,
      ipAddress,
      deviceFingerprint,
      riskScore,
      triggers,
      actionTaken,
    };

    let assessment: any;
    if (isMongoMock) {
      assessment = mockDb.insertOne("RiskAssessment", assessmentData);
    } else {
      assessment = await new RiskAssessmentModel(assessmentData).save();
    }

    logger.info(`🛡️ Risk Evaluation Complete. Score: ${riskScore}, Action: ${actionTaken.toUpperCase()}`);

    return {
      riskScore,
      triggers,
      actionTaken,
      assessmentId: assessment._id.toString(),
    };
  }

  private static async triggerAlert(
    userId: string,
    alertType: AlertType,
    severity: AlertSeverity,
    ipAddress: string,
    userAgent: string,
    description: string,
    riskScore: number
  ) {
    const alertData = {
      userId,
      alertType,
      severity,
      details: {
        ipAddress,
        userAgent,
        description,
        riskScore,
      },
      resolved: false,
    };

    if (isMongoMock) {
      mockDb.insertOne("SecurityAlert", alertData);
    } else {
      await new SecurityAlertModel(alertData).save();
    }
  }
}
