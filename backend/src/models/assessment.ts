import { Schema, model, Document } from "mongoose";

export interface IRiskAssessment extends Document {
  userId: string;
  sessionId?: string;
  ipAddress: string;
  deviceFingerprint: string;
  riskScore: number;
  triggers: string[]; // List of anomaly triggers flagged
  actionTaken: "allow" | "require_mfa" | "block";
  createdAt: Date;
}

export const RiskAssessmentSchema = new Schema<IRiskAssessment>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, index: true },
    ipAddress: { type: String, required: true },
    deviceFingerprint: { type: String, required: true },
    riskScore: { type: Number, required: true },
    triggers: { type: [String], default: [] },
    actionTaken: { type: String, enum: ["allow", "require_mfa", "block"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const RiskAssessmentModel = model<IRiskAssessment>("RiskAssessment", RiskAssessmentSchema);
export default RiskAssessmentModel;
