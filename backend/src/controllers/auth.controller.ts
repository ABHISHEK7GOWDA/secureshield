import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import * as argon2 from "argon2";
import { logger } from "../config/logger";
import { isMongoMock } from "../config/db";
import { mockDb } from "../config/mockDb";
import UserModel, { UserRole } from "../models/user";
import SessionModel from "../models/session";
import TrustedDeviceModel from "../models/device";
import AuditLogModel from "../models/audit";
import { OtpService } from "../services/otp.service";
import { ThreatService } from "../services/threat.service";
import { GeofenceService } from "../services/geofence.service";

// Breached Password check helper (Pwned Passwords API)
async function checkBreachedPassword(password: string): Promise<boolean> {
  try {
    const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, { timeout: 3000 });
    const lines = response.data.split("\n");
    
    for (const line of lines) {
      const [hashSuffix, count] = line.split(":");
      if (hashSuffix.trim() === suffix) {
        return Number(count) > 0;
      }
    }
    return false;
  } catch (error: any) {
    logger.warn(`Pwned Passwords API lookup failed: ${error.message}. Skipping breach check.`);
    return false; // Fail open for the breach check if the API is offline
  }
}

// Token generation helpers
const generateTokens = (user: any, sessionId: string) => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET || "secureshield_default_access_secret_2026";
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || "secureshield_default_refresh_secret_2026";

  const accessToken = jwt.sign(
    { id: user._id, username: user.username, email: user.email, role: user.role, sessionId },
    accessSecret,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: user._id, sessionId },
    refreshSecret,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

export class AuthController {
  // Layer 1: Register User & Set Role
  static async register(req: Request, res: Response) {
    try {
      const { username, email, password, role } = req.body;

      let existingUser: any;
      if (isMongoMock) {
        existingUser = mockDb.findOne("User", { username }) || mockDb.findOne("User", { email });
      } else {
        existingUser = await UserModel.findOne({ $or: [{ username }, { email }] });
      }

      if (existingUser) {
        return res.status(400).json({ ok: false, message: "Username or email is already registered." });
      }

      // Hashing password with Argon2id
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16, // 64MB
        timeCost: 3,
        parallelism: 4,
      });

      // Generate 8 backup codes
      const { rawCodes, hashedCodes } = OtpService.generateBackupCodes();

      const userData = {
        username,
        email,
        passwordHash,
        role: role || UserRole.USER,
        isMfaEnabled: true,
        backupCodes: hashedCodes,
        failedAttempts: 0,
      };

      let user: any;
      if (isMongoMock) {
        user = mockDb.insertOne("User", userData);
      } else {
        user = await new UserModel(userData).save();
      }

      logger.info(`👤 User registered successfully: ${username}`);
      
      return res.status(201).json({
        ok: true,
        message: "Registration completed. Please download your backup codes.",
        backupCodes: rawCodes, // Send raw codes once to client
      });
    } catch (error: any) {
      logger.error("❌ Registration Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Internal server error during registration." });
    }
  }

  // Layer 2: Password, Keystrokes, Mouse & Risk Calculation
  static async login(req: Request, res: Response) {
    try {
      const { username, password, keystrokeTelemetry, mouseTelemetry, deviceFingerprint, deviceName } = req.body;
      const ipAddress = req.ip || "127.0.0.1";
      const userAgent = req.headers["user-agent"] || "Unknown UA";

      let user: any;
      if (isMongoMock) {
        user = mockDb.findOne("User", { username });
      } else {
        user = await UserModel.findOne({ username });
      }

      if (!user) {
        return res.status(401).json({ ok: false, message: "Invalid credentials." });
      }

      // Check lockout
      if (user.lockUntil && new Date() < new Date(user.lockUntil)) {
        return res.status(423).json({
          ok: false,
          message: `Account is temporarily locked due to excessive failures. Unlock in ${Math.ceil(
            (new Date(user.lockUntil).getTime() - Date.now()) / 60000
          )} minutes.`,
        });
      }

      // Verify Password Hash
      const passwordMatch = await argon2.verify(user.passwordHash, password);
      if (!passwordMatch) {
        // Increment failed attempts
        const attempts = user.failedAttempts + 1;
        const updates: any = { failedAttempts: attempts };
        
        if (attempts >= 5) {
          updates.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
          updates.failedAttempts = 0;
          logger.warn(`🔒 Account locked out: ${username} for 15 minutes due to brute-force attempts.`);
        }

        if (isMongoMock) {
          mockDb.updateOne("User", { _id: user._id }, updates);
        } else {
          await UserModel.updateOne({ _id: user._id }, { $set: updates });
        }

        // Record Audit Log
        const logData = { userId: user._id.toString(), action: "login_attempt", status: "failure" as const, ipAddress, userAgent, details: { reason: "password_mismatch" } };
        if (isMongoMock) mockDb.insertOne("AuditLog", logData); else await new AuditLogModel(logData).save();

        return res.status(401).json({
          ok: false,
          message: attempts >= 5 
            ? "Too many failed attempts. Account locked out for 15 minutes." 
            : `Invalid credentials. ${5 - attempts} attempts remaining.`,
        });
      }

      // Password matches -> Clear failures
      if (isMongoMock) {
        mockDb.updateOne("User", { _id: user._id }, { failedAttempts: 0, lockUntil: undefined });
      } else {
        await UserModel.updateOne({ _id: user._id }, { $set: { failedAttempts: 0 }, $unset: { lockUntil: 1 } });
      }

      // Check Breached Password via API (Pwned Passwords)
      const isBreached = await checkBreachedPassword(password);
      if (isBreached) {
        logger.warn(`🚨 Password for user ${username} was found in external data breaches!`);
      }

      // Evaluate Adaptive Risk Score (AI engine)
      const evaluation = await ThreatService.evaluateRisk({
        userId: user._id.toString(),
        ipAddress,
        userAgent,
        deviceFingerprint,
        deviceName,
        keystrokeTelemetry,
        mouseTelemetry,
      });

      if (evaluation.actionTaken === "block") {
        return res.status(403).json({
          ok: false,
          message: "Access blocked by threat defense. Anomaly score exceeds policy limits.",
          triggers: evaluation.triggers,
        });
      }

      // Start OTP phase
      const otpCode = OtpService.generateOtpCode();
      
      // Save code Hash to OTP collection
      await OtpService.createOtpRecord(user._id.toString(), "email", user.email, otpCode);

      // Send OTP to user's registered Email
      const emailSent = await OtpService.sendEmailOtp(user._id.toString(), user.email, otpCode);
      
      let devOtp: string | undefined;
      if (!emailSent) {
        // Fallback for development offline support
        devOtp = otpCode;
      }

      return res.status(200).json({
        ok: true,
        message: "Password verified. Enter the OTP code sent to your email.",
        nextStage: "otp",
        userId: user._id.toString(),
        riskScore: evaluation.riskScore,
        triggers: evaluation.triggers,
        devOtp, // Only populated if SMTP is offline/unconfigured
      });
    } catch (error: any) {
      logger.error("❌ Login Stage 1 Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Internal login failure." });
    }
  }

  // Layer 3: Verify OTP Code
  static async verifyOtp(req: Request, res: Response) {
    try {
      const { userId, otp } = req.body;

      const user = isMongoMock ? mockDb.findOne("User", { _id: userId }) : await UserModel.findById(userId);
      if (!user) {
        return res.status(400).json({ ok: false, message: "Invalid authentication session." });
      }

      const verifyResult = await OtpService.verifyOtp(userId, "email", otp);
      if (!verifyResult.ok) {
        return res.status(400).json({ ok: false, message: verifyResult.message });
      }

      return res.status(200).json({
        ok: true,
        message: "One-Time Password verified. Proceed to biometric facial scan.",
        nextStage: "face",
      });
    } catch (error: any) {
      logger.error("❌ OTP Verification Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "OTP verification server error." });
    }
  }

  // Layer 4: Verify Face Liveness (Blinded check matching parameters)
  static async verifyFace(req: Request, res: Response) {
    try {
      const { userId, faceLivenessReport } = req.body;

      // In a real system, we'd compare image templates or decode mathematical structures.
      // Here we process the client-side TensorFlow.js report for liveness and anti-spoof checks.
      const { livenessPassed, antiSpoofScore, confidence, blinkCount } = faceLivenessReport || {};

      if (!livenessPassed || confidence < 0.75 || antiSpoofScore < 80) {
        return res.status(400).json({
          ok: false,
          message: "Facial verification failed. Liveness/Anti-Spoofing checklist was not completed.",
          details: { confidence, antiSpoofScore, blinkCount },
        });
      }

      logger.info(`👤 Facial biometrics passed for user: ${userId} (Confidence: ${(confidence * 100).toFixed(0)}%)`);

      return res.status(200).json({
        ok: true,
        message: "Biometric face verification completed. Proceed to context geolocation.",
        nextStage: "location",
      });
    } catch (error: any) {
      logger.error("❌ Facial biometrics validation error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Face check server error." });
    }
  }

  // Layer 5: Context Geofence & Complete Authentication Session
  static async verifyLocation(req: Request, res: Response) {
    try {
      const { userId, gpsCoords, deviceFingerprint, deviceName } = req.body;
      const ipAddress = req.ip || "127.0.0.1";
      const userAgent = req.headers["user-agent"] || "Unknown UA";

      const user = isMongoMock ? mockDb.findOne("User", { _id: userId }) : await UserModel.findById(userId);
      if (!user) {
        return res.status(400).json({ ok: false, message: "Authentication session expired." });
      }

      // Geolocate user IP
      const ipGeo = await GeofenceService.geolocateIp(ipAddress);
      const coordinates = gpsCoords || { latitude: ipGeo.latitude, longitude: ipGeo.longitude };

      // Generate Session ID
      const sessionId = Math.random().toString(36).substring(2, 11);

      // Create Active Session
      const sessionData = {
        _id: sessionId,
        userId: user._id.toString(),
        refreshToken: crypto.randomBytes(40).toString("hex"),
        deviceFingerprint,
        ipAddress,
        userAgent,
        location: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          city: ipGeo.city || "Bengaluru",
          country: ipGeo.country || "India",
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiration
        isValid: true,
      };

      let sessionRecord: any;
      if (isMongoMock) {
        sessionRecord = mockDb.insertOne("Session", sessionData);
      } else {
        sessionRecord = await new SessionModel(sessionData).save();
      }

      // Generate JWT Tokens
      const { accessToken, refreshToken } = generateTokens(user, sessionRecord._id.toString());

      // Save updated refresh token to database
      if (isMongoMock) {
        mockDb.updateOne("Session", { _id: sessionRecord._id }, { refreshToken });
      } else {
        sessionRecord.refreshToken = refreshToken;
        await sessionRecord.save();
      }

      // Log Audit Success
      const auditData = {
        userId: user._id.toString(),
        action: "login_attempt",
        status: "success" as const,
        ipAddress,
        userAgent,
        details: { deviceName, location: ipGeo.city },
      };
      if (isMongoMock) mockDb.insertOne("AuditLog", auditData); else await new AuditLogModel(auditData).save();

      // Configure Secure Cookies
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      logger.info(`🔑 User '${user.username}' signed in successfully.`);

      return res.status(200).json({
        ok: true,
        message: "Authentication successful. Access granted.",
        nextStage: "success",
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
        accessToken, // Fallback for clients not supporting cookies
      });
    } catch (error: any) {
      logger.error("❌ Context Check Stage 5 Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Geofencing check server error." });
    }
  }

  // Backup Code Login
  static async verifyBackupCode(req: Request, res: Response) {
    try {
      const { username, backupCode } = req.body;
      const ipAddress = req.ip || "127.0.0.1";
      const userAgent = req.headers["user-agent"] || "Unknown UA";

      const user = isMongoMock ? mockDb.findOne("User", { username }) : await UserModel.findOne({ username });
      if (!user) {
        return res.status(400).json({ ok: false, message: "Invalid backup credentials." });
      }

      const isValidCode = await OtpService.verifyBackupCode(user._id.toString(), backupCode);
      if (!isValidCode) {
        return res.status(400).json({ ok: false, message: "Invalid backup code. Code is incorrect or already used." });
      }

      // Successful bypass -> Set Session
      const sessionId = Math.random().toString(36).substring(2, 11);
      const sessionData = {
        _id: sessionId,
        userId: user._id.toString(),
        refreshToken: crypto.randomBytes(40).toString("hex"),
        deviceFingerprint: "backup_code_bypass",
        ipAddress,
        userAgent,
        location: { city: "Bypass Code", country: "Local" },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isValid: true,
      };

      let sessionRecord: any;
      if (isMongoMock) {
        sessionRecord = mockDb.insertOne("Session", sessionData);
      } else {
        sessionRecord = await new SessionModel(sessionData).save();
      }

      const { accessToken, refreshToken } = generateTokens(user, sessionRecord._id.toString());
      
      if (isMongoMock) {
        mockDb.updateOne("Session", { _id: sessionRecord._id }, { refreshToken });
      } else {
        sessionRecord.refreshToken = refreshToken;
        await sessionRecord.save();
      }

      res.cookie("accessToken", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 15 * 60 * 1000 });
      res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000 });

      return res.status(200).json({
        ok: true,
        message: "Backup code verified. Emergency access granted.",
        user: { id: user._id.toString(), username: user.username, email: user.email, role: user.role },
        accessToken,
      });
    } catch (error: any) {
      logger.error("❌ Backup Code Authentication Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Emergency check failure." });
    }
  }

  // Token Rotation & Refresh
  static async refresh(req: Request, res: Response) {
    try {
      const token = req.cookies?.refreshToken || req.body.refreshToken;
      
      if (!token) {
        return res.status(401).json({ ok: false, message: "Refresh token missing." });
      }

      const refreshSecret = process.env.REFRESH_TOKEN_SECRET || "secureshield_default_refresh_secret_2026";
      const decoded = jwt.verify(token, refreshSecret) as { id: string; sessionId: string };

      let session: any;
      if (isMongoMock) {
        session = mockDb.findOne("Session", { _id: decoded.sessionId, isValid: true });
      } else {
        session = await SessionModel.findOne({ _id: decoded.sessionId, isValid: true });
      }

      if (!session || session.refreshToken !== token) {
        return res.status(401).json({ ok: false, message: "Invalid or revoked refresh token session." });
      }

      let user: any;
      if (isMongoMock) {
        user = mockDb.findOne("User", { _id: decoded.id });
      } else {
        user = await UserModel.findById(decoded.id);
      }

      if (!user) {
        return res.status(401).json({ ok: false, message: "User account does not exist." });
      }

      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user, session._id.toString());

      // Save rotated refresh token
      if (isMongoMock) {
        mockDb.updateOne("Session", { _id: session._id }, { refreshToken: newRefreshToken });
      } else {
        session.refreshToken = newRefreshToken;
        await session.save();
      }

      res.cookie("accessToken", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 15 * 60 * 1000 });
      res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000 });

      return res.status(200).json({ ok: true, accessToken });
    } catch (error: any) {
      logger.warn(`Refresh token rotation failed: ${error.message}`);
      return res.status(401).json({ ok: false, message: "Session expired. Please sign in again." });
    }
  }

  // Get current logged-in user profile details
  static async me(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: "Unauthenticated request." });
    }
    return res.status(200).json({ ok: true, user: req.user });
  }

  // Logout & Revoke Session
  static async logout(req: Request, res: Response) {
    try {
      const token = req.cookies?.refreshToken || req.body.refreshToken;

      if (token) {
        if (isMongoMock) {
          mockDb.updateOne("Session", { refreshToken: token }, { isValid: false });
        } else {
          await SessionModel.updateOne({ refreshToken: token }, { $set: { isValid: false } });
        }
      }

      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      return res.status(200).json({ ok: true, message: "Logged out successfully. Session revoked." });
    } catch (error: any) {
      return res.status(500).json({ ok: false, message: "Logout failure." });
    }
  }
}
