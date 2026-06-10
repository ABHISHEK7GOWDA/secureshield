import { Schema, model, Document } from "mongoose";

export interface ISession extends Document {
  userId: string;
  refreshToken: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  location: {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
  };
  expiresAt: Date;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SessionSchema = new Schema<ISession>(
  {
    userId: { type: String, required: true, index: true },
    refreshToken: { type: String, required: true, unique: true },
    deviceFingerprint: { type: String, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      city: { type: String },
      country: { type: String },
    },
    expiresAt: { type: Date, required: true, index: true },
    isValid: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SessionModel = model<ISession>("Session", SessionSchema);
export default SessionModel;
