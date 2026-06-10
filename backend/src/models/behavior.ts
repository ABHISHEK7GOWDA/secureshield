import { Schema, model, Document } from "mongoose";

export interface IBehavioralProfile extends Document {
  userId: string;
  keystroke: {
    avgDwellTime: number;
    avgFlightTime: number;
    rhythmVariance: number;
    keySamplesCount: number;
  };
  mouse: {
    avgVelocity: number;
    avgJitter: number;
    curvatureFactor: number; // Curvature vector check
  };
  createdAt: Date;
  updatedAt: Date;
}

export const BehavioralProfileSchema = new Schema<IBehavioralProfile>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    keystroke: {
      avgDwellTime: { type: Number, default: 0 },
      avgFlightTime: { type: Number, default: 0 },
      rhythmVariance: { type: Number, default: 0 },
      keySamplesCount: { type: Number, default: 0 },
    },
    mouse: {
      avgVelocity: { type: Number, default: 0 },
      avgJitter: { type: Number, default: 0 },
      curvatureFactor: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const BehavioralProfileModel = model<IBehavioralProfile>("BehavioralProfile", BehavioralProfileSchema);
export default BehavioralProfileModel;
