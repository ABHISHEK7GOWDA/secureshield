import { Schema, model, Document } from "mongoose";

export interface ITrustedDevice extends Document {
  userId: string;
  fingerprint: string;
  deviceName: string;
  ipAddress: string;
  lastUsedAt: Date;
  isTrusted: boolean;
  createdAt: Date;
}

export const TrustedDeviceSchema = new Schema<ITrustedDevice>(
  {
    userId: { type: String, required: true, index: true },
    fingerprint: { type: String, required: true, index: true },
    deviceName: { type: String, required: true },
    ipAddress: { type: String, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    isTrusted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const TrustedDeviceModel = model<ITrustedDevice>("TrustedDevice", TrustedDeviceSchema);
export default TrustedDeviceModel;
