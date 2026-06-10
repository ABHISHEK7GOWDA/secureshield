import { Schema, model, Document } from "mongoose";

export enum UserRole {
  USER = "User",
  ADMIN = "Admin",
  ANALYST = "SecurityAnalyst",
}

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isMfaEnabled: boolean;
  backupCodes: string[]; // Hashed codes
  failedAttempts: number;
  lockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isMfaEnabled: { type: Boolean, default: true },
    backupCodes: { type: [String], default: [] },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { timestamps: true }
);

export const UserModel = model<IUser>("User", UserSchema);
export default UserModel;
