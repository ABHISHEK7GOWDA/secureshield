import { Schema, model, Document } from "mongoose";

export interface IOtp extends Document {
  userId: string;
  codeHash: string;
  type: "sms" | "email";
  destination: string; // Phone number or email address
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

export const OtpSchema = new Schema<IOtp>(
  {
    userId: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    type: { type: String, enum: ["sms", "email"], required: true },
    destination: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Auto-delete OTPs after expiration
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel = model<IOtp>("Otp", OtpSchema);
export default OtpModel;
