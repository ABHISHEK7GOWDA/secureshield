import { Schema, model, Document } from "mongoose";

export interface IAuditLog extends Document {
  userId?: string;
  action: string; // login_attempt, mfa_verify, session_revoke, policy_update, role_change, user_unlock
  status: "success" | "failure";
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  createdAt: Date;
}

export const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: String, index: true },
    action: { type: String, required: true, index: true },
    status: { type: String, enum: ["success", "failure"], required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLogModel = model<IAuditLog>("AuditLog", AuditLogSchema);
export default AuditLogModel;
