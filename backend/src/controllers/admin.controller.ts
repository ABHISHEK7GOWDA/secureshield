import { Request, Response } from "express";
import { logger } from "../config/logger";
import { isMongoMock } from "../config/db";
import { mockDb } from "../config/mockDb";
import UserModel, { UserRole } from "../models/user";
import SessionModel from "../models/session";
import AuditLogModel from "../models/audit";

// Global threat scoring policy parameters (Stored in-memory or mock file for convenience)
export let GlobalSecurityPolicy = {
  mfaThreshold: 30, // Score above this triggers MFA
  blockThreshold: 75, // Score above this blocks login
  weights: {
    unknownDevice: 20,
    untrustedDevice: 10,
    suspiciousIp: 25,
    geofenceOutlier: 30,
    impossibleTravel: 50,
    keystrokeMismatch: 30,
  }
};

export class AdminController {
  // Fetch users list
  static async getUsers(req: Request, res: Response) {
    try {
      let users: any[];
      if (isMongoMock) {
        users = mockDb.read("User");
      } else {
        users = await UserModel.find({}, "-passwordHash");
      }

      // Strip sensitive information from mock data
      const sanitized = users.map((u) => ({
        id: u._id || u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        isMfaEnabled: u.isMfaEnabled,
        failedAttempts: u.failedAttempts,
        lockUntil: u.lockUntil,
        createdAt: u.createdAt,
      }));

      return res.status(200).json({ ok: true, users: sanitized });
    } catch (error: any) {
      logger.error("❌ Admin GetUsers Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Failed to retrieve user directory." });
    }
  }

  // Update User Role (RBAC)
  static async changeUserRole(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!Object.values(UserRole).includes(role as UserRole)) {
        return res.status(400).json({ ok: false, message: "Invalid role value." });
      }

      let updatedUser: any;
      if (isMongoMock) {
        updatedUser = mockDb.updateOne("User", { _id: userId }, { role });
      } else {
        updatedUser = await UserModel.findByIdAndUpdate(userId, { role }, { new: true });
      }

      if (!updatedUser) {
        return res.status(404).json({ ok: false, message: "User not found." });
      }

      // Record Audit log
      const auditData = {
        userId: req.user?.id,
        action: "role_change",
        status: "success" as const,
        ipAddress: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Unknown UA",
        details: { targetUserId: userId, newRole: role },
      };
      if (isMongoMock) mockDb.insertOne("AuditLog", auditData); else await new AuditLogModel(auditData).save();

      logger.info(`👑 Admin updated role of ${userId} to ${role}`);

      return res.status(200).json({ ok: true, message: `User role changed to ${role} successfully.` });
    } catch (error: any) {
      logger.error("❌ Admin ChangeRole Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Failed to modify role." });
    }
  }

  // Unlock Locked Account
  static async unlockUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      let user: any;
      if (isMongoMock) {
        user = mockDb.updateOne("User", { _id: userId }, { failedAttempts: 0, lockUntil: undefined });
      } else {
        user = await UserModel.findByIdAndUpdate(
          userId,
          { $set: { failedAttempts: 0 }, $unset: { lockUntil: 1 } },
          { new: true }
        );
      }

      if (!user) {
        return res.status(404).json({ ok: false, message: "User not found." });
      }

      // Record Audit log
      const auditData = {
        userId: req.user?.id,
        action: "user_unlock",
        status: "success" as const,
        ipAddress: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Unknown UA",
        details: { targetUserId: userId },
      };
      if (isMongoMock) mockDb.insertOne("AuditLog", auditData); else await new AuditLogModel(auditData).save();

      logger.info(`🔓 Admin unlocked user account: ${userId}`);

      return res.status(200).json({ ok: true, message: "User account unlocked successfully." });
    } catch (error: any) {
      logger.error("❌ Admin UnlockUser Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Failed to unlock account." });
    }
  }

  // Revoke session manually (Admin override)
  static async revokeSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;

      let session: any;
      if (isMongoMock) {
        session = mockDb.updateOne("Session", { _id: sessionId }, { isValid: false });
      } else {
        session = await SessionModel.findByIdAndUpdate(sessionId, { isValid: false }, { new: true });
      }

      if (!session) {
        return res.status(404).json({ ok: false, message: "Session not found." });
      }

      // Record Audit log
      const auditData = {
        userId: req.user?.id,
        action: "session_revoke",
        status: "success" as const,
        ipAddress: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Unknown UA",
        details: { revokedSessionId: sessionId },
      };
      if (isMongoMock) mockDb.insertOne("AuditLog", auditData); else await new AuditLogModel(auditData).save();

      logger.info(`🚫 Session revoked manually by Admin: ${sessionId}`);

      return res.status(200).json({ ok: true, message: "Active session revoked successfully." });
    } catch (error: any) {
      logger.error("❌ Admin RevokeSession Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Failed to revoke session." });
    }
  }

  // Fetch Threat Policy rules
  static async getPolicy(req: Request, res: Response) {
    return res.status(200).json({ ok: true, policy: GlobalSecurityPolicy });
  }

  // Update Global Adaptive Authentication scoring rules
  static async updatePolicy(req: Request, res: Response) {
    try {
      const { mfaThreshold, blockThreshold, weights } = req.body;

      if (mfaThreshold !== undefined) GlobalSecurityPolicy.mfaThreshold = Number(mfaThreshold);
      if (blockThreshold !== undefined) GlobalSecurityPolicy.blockThreshold = Number(blockThreshold);
      
      if (weights) {
        GlobalSecurityPolicy.weights = {
          ...GlobalSecurityPolicy.weights,
          ...weights,
        };
      }

      // Record Audit log
      const auditData = {
        userId: req.user?.id,
        action: "policy_update",
        status: "success" as const,
        ipAddress: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Unknown UA",
        details: { updatedPolicy: GlobalSecurityPolicy },
      };
      if (isMongoMock) mockDb.insertOne("AuditLog", auditData); else await new AuditLogModel(auditData).save();

      logger.info("⚙️ Global authentication threshold policy updated by Admin.");

      return res.status(200).json({
        ok: true,
        message: "Authentication thresholds and weights updated successfully.",
        policy: GlobalSecurityPolicy,
      });
    } catch (error: any) {
      logger.error("❌ Admin UpdatePolicy Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Failed to update policy." });
    }
  }
}
