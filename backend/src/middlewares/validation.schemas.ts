import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3, "Username must be at least 3 characters long").max(30),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    role: z.enum(["User", "Admin", "SecurityAnalyst"]).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
    deviceFingerprint: z.string().min(1, "Device fingerprint is required"),
    deviceName: z.string().min(1, "Device name is required"),
    keystrokeTelemetry: z
      .object({
        dwellTimes: z.array(z.number()),
        flightTimes: z.array(z.number()),
        keyCount: z.number(),
      })
      .optional(),
    mouseTelemetry: z
      .object({
        velocity: z.number(),
        jitter: z.number(),
        curvature: z.number(),
      })
      .optional(),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    userId: z.string().min(1, "User ID is required"),
    otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d+$/, "OTP must only contain numbers"),
  }),
});

export const verifyFaceSchema = z.object({
  body: z.object({
    userId: z.string().min(1, "User ID is required"),
    faceLivenessReport: z.object({
      livenessPassed: z.boolean(),
      antiSpoofScore: z.number().min(0).max(100),
      confidence: z.number().min(0).max(1),
      blinkCount: z.number(),
    }),
  }),
});

export const verifyLocationSchema = z.object({
  body: z.object({
    userId: z.string().min(1, "User ID is required"),
    gpsCoords: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
      })
      .optional(),
    deviceFingerprint: z.string().min(1, "Device fingerprint is required"),
    deviceName: z.string().min(1, "Device name is required"),
  }),
});

export const verifyBackupCodeSchema = z.object({
  body: z.object({
    username: z.string().min(1, "Username is required"),
    backupCode: z.string().length(8, "Backup code must be 8 hex characters").regex(/^[0-9a-fA-F]+$/, "Must be hex"),
  }),
});
