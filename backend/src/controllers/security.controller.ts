import { Request, Response } from "express";
import { logger } from "../config/logger";
import { isMongoMock } from "../config/db";
import { mockDb } from "../config/mockDb";
import SecurityAlertModel from "../models/alert";
import AuditLogModel from "../models/audit";
import RiskAssessmentModel from "../models/assessment";

export class SecurityController {
  // Retrieve security alerts feed
  static async getAlerts(req: Request, res: Response) {
    try {
      let alerts: any[];
      if (isMongoMock) {
        alerts = mockDb.read("SecurityAlert");
      } else {
        alerts = await SecurityAlertModel.find({}).sort({ createdAt: -1 });
      }

      return res.status(200).json({ ok: true, alerts });
    } catch (error: any) {
      logger.error("❌ Security GetAlerts Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Failed to retrieve security alerts." });
    }
  }

  // Resolve active threat alert
  static async resolveAlert(req: Request, res: Response) {
    try {
      const { alertId } = req.params;
      const analystId = req.user?.id || "System Analyst";

      let alert: any;
      const updates = {
        resolved: true,
        resolvedBy: analystId,
        resolvedAt: new Date(),
      };

      if (isMongoMock) {
        alert = mockDb.updateOne("SecurityAlert", { _id: alertId }, updates);
      } else {
        alert = await SecurityAlertModel.findByIdAndUpdate(alertId, { $set: updates }, { new: true });
      }

      if (!alert) {
        return res.status(404).json({ ok: false, message: "Alert not found." });
      }

      logger.info(`🛡️ Security alert ${alertId} resolved by analyst: ${analystId}`);

      return res.status(200).json({ ok: true, message: "Security alert successfully resolved." });
    } catch (error: any) {
      logger.error("❌ Security ResolveAlert Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Failed to resolve alert." });
    }
  }

  // Fetch full system audit logs
  static async getAuditLogs(req: Request, res: Response) {
    try {
      let logs: any[];
      if (isMongoMock) {
        logs = mockDb.read("AuditLog");
      } else {
        logs = await AuditLogModel.find({}).sort({ createdAt: -1 }).limit(100);
      }

      return res.status(200).json({ ok: true, logs });
    } catch (error: any) {
      logger.error("❌ Security GetAuditLogs Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Failed to retrieve audit trail." });
    }
  }

  // Fetch AI risk assessments
  static async getRiskAssessments(req: Request, res: Response) {
    try {
      let assessments: any[];
      if (isMongoMock) {
        assessments = mockDb.read("RiskAssessment");
      } else {
        assessments = await RiskAssessmentModel.find({}).sort({ createdAt: -1 }).limit(100);
      }

      return res.status(200).json({ ok: true, assessments });
    } catch (error: any) {
      logger.error("❌ Security GetAssessments Error: %s", error.message);
      return res.status(500).json({ ok: false, message: "Failed to retrieve risk assessments." });
    }
  }
}
