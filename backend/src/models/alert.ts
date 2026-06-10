import { Schema, model, Document } from "mongoose";

export enum AlertSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum AlertType {
  SUSPICIOUS_LOGIN = "suspicious_login",
  FAILED_MFA = "failed_mfa",
  IMPOSSIBLE_TRAVEL = "impossible_travel",
  BRUTE_FORCE = "brute_force",
  BREACHED_PASSWORD = "breached_password",
  GEOLOCATION_OUTLIER = "geolocation_outlier",
}

export interface ISecurityAlert extends Document {
  userId?: string; // Optional for unauthorized username attempts
  alertType: AlertType;
  severity: AlertSeverity;
  details: {
    ipAddress: string;
    userAgent: string;
    description: string;
    riskScore: number;
    location?: string;
  };
  resolved: boolean;
  resolvedBy?: string; // Admin or Analyst user ID
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const SecurityAlertSchema = new Schema<ISecurityAlert>(
  {
    userId: { type: String, index: true },
    alertType: { type: String, enum: Object.values(AlertType), required: true },
    severity: { type: String, enum: Object.values(AlertSeverity), required: true },
    details: {
      ipAddress: { type: String, required: true },
      userAgent: { type: String, required: true },
      description: { type: String, required: true },
      riskScore: { type: Number, required: true },
      location: { type: String },
    },
    resolved: { type: Boolean, default: false, index: true },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

export const SecurityAlertModel = model<ISecurityAlert>("SecurityAlert", SecurityAlertSchema);
export default SecurityAlertModel;
