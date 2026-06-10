import { logger } from "../config/logger";
import { isMongoMock } from "../config/db";
import { mockDb } from "../config/mockDb";
import BehavioralProfileModel from "../models/behavior";

export interface KeystrokeTelemetry {
  dwellTimes: number[];
  flightTimes: number[];
  keyCount: number;
}

export interface MouseTelemetry {
  velocity: number;
  jitter: number;
  curvature: number;
}

export class BiometricService {
  // Verifies typing behavior and returns a matching score (0 to 100)
  static async verifyKeystroke(
    userId: string,
    telemetry: KeystrokeTelemetry
  ): Promise<{ trustScore: number; matchDetails: string }> {
    const { dwellTimes, flightTimes, keyCount } = telemetry;

    if (keyCount < 4 || dwellTimes.length === 0) {
      return { trustScore: 50, matchDetails: "Insufficient keys typed for reliable profile mapping." };
    }

    let profile: any;
    if (isMongoMock) {
      profile = mockDb.findOne("BehavioralProfile", { userId });
    } else {
      profile = await BehavioralProfileModel.findOne({ userId });
    }

    // If no baseline profile is registered yet, enroll the current login as the baseline
    if (!profile || profile.keystroke.keySamplesCount === 0) {
      const avgDwell = dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length;
      const avgFlight = flightTimes.length ? (flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length) : 180;
      
      const newProfile = {
        userId,
        keystroke: {
          avgDwellTime: Math.round(avgDwell),
          avgFlightTime: Math.round(avgFlight),
          rhythmVariance: 30, // Default variance
          keySamplesCount: keyCount,
        },
        mouse: {
          avgVelocity: 150,
          avgJitter: 5,
          curvatureFactor: 8,
        }
      };

      if (isMongoMock) {
        mockDb.insertOne("BehavioralProfile", newProfile);
      } else {
        await new BehavioralProfileModel(newProfile).save();
      }

      logger.info(`📝 Enrolled initial behavioral biometric profile for user: ${userId}`);
      return { trustScore: 100, matchDetails: "Initial keystroke dynamics profile enrolled successfully." };
    }

    // Compare telemetry against baseline
    const baselineDwell = profile.keystroke.avgDwellTime;
    const baselineFlight = profile.keystroke.avgFlightTime;

    const inputDwell = dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length;
    const inputFlight = flightTimes.length ? (flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length) : 180;

    const dwellDiff = Math.abs(inputDwell - baselineDwell);
    const flightDiff = Math.abs(inputFlight - baselineFlight);

    // Score calculations
    const dwellScore = Math.max(0, 100 - (dwellDiff / baselineDwell) * 100);
    const flightScore = Math.max(0, 100 - (flightDiff / baselineFlight) * 100);

    const trustScore = Math.round((dwellScore + flightScore) / 2);
    
    // Add updates to baseline slowly (moving average) for adaptive learning
    const alpha = 0.1; // Lerp rate
    const updatedDwell = Math.round(baselineDwell * (1 - alpha) + inputDwell * alpha);
    const updatedFlight = Math.round(baselineFlight * (1 - alpha) + inputFlight * alpha);

    if (isMongoMock) {
      mockDb.updateOne(
        "BehavioralProfile",
        { userId },
        { 
          "keystroke.avgDwellTime": updatedDwell, 
          "keystroke.avgFlightTime": updatedFlight 
        }
      );
    } else {
      profile.keystroke.avgDwellTime = updatedDwell;
      profile.keystroke.avgFlightTime = updatedFlight;
      await profile.save();
    }

    logger.debug(`Biometric check: DwellMatch=${dwellScore.toFixed(1)}%, FlightMatch=${flightScore.toFixed(1)}%`);

    return {
      trustScore,
      matchDetails: `Keystroke dynamics matching: ${trustScore}% similarity against historical baseline.`,
    };
  }

  // Detects if mouse path matches robotic automated actions (straight lines, instant clicks, zero acceleration)
  static verifyMouseMovement(telemetry: MouseTelemetry): { trustScore: number; details: string; isBot: boolean } {
    const { velocity, jitter, curvature } = telemetry;

    // Automated scripts (Selenium, Puppeteer) often move in perfect lines or teleport coordinates instantly.
    // Humans have curvature, jitter (micro-hesitation), and acceleration.
    
    if (velocity === 0 && curvature === 0) {
      return {
        trustScore: 0,
        details: "Instant mouse positioning anomaly detected (Potential credential stuffing script).",
        isBot: true,
      };
    }

    if (curvature === 0 && jitter === 0) {
      return {
        trustScore: 10,
        details: "Linear mouse drag without human hesitation vectors (Potential coordinate interpolation bot).",
        isBot: true,
      };
    }

    // Human ranges (flexible)
    if (curvature > 1 && jitter > 0.5) {
      return {
        trustScore: 95,
        details: "Mouse behavior features normal human hand jitter and curved motion paths.",
        isBot: false,
      };
    }

    return {
      trustScore: 70,
      details: "Mild mouse movement alignment flags, lower confidence.",
      isBot: false,
    };
  }
}
