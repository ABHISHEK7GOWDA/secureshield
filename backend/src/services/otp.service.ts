import crypto from "crypto";
import nodemailer from "nodemailer";
import { logger } from "../config/logger";
import OtpModel from "../models/otp";
import UserModel from "../models/user";
import { isMongoMock } from "../config/db";
import { mockDb } from "../config/mockDb";

export class OtpService {
  private static transporter: any = null;

  private static getTransporter() {
    if (!this.transporter) {
      // Create Nodemailer transporter (Ethereal test mail config by default, customizable via env)
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || "secureshield.test@ethereal.email",
          pass: process.env.SMTP_PASS || "secureshieldPassword123",
        },
      });
    }
    return this.transporter;
  }

  static generateOtpCode(): string {
    return String(crypto.randomInt(100000, 1000000));
  }

  static hashOtp(otp: string): string {
    return crypto.createHash("sha256").update(otp).digest("hex");
  }

  static async sendEmailOtp(userId: string, email: string, otp: string): Promise<boolean> {
    try {
      const info = await this.getTransporter().sendMail({
        from: '"SecureShield AI" <no-reply@secureshield.ai>',
        to: email,
        subject: "SecureShield AI - Multi-Factor Verification Code",
        text: `Your One-Time Password (OTP) is: ${otp}. This code is valid for 5 minutes.`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b1120; color: #f8fafc; padding: 40px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
            <h2 style="color: #38bdf8; text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 20px; font-weight: 800; font-size: 24px; letter-spacing: 1px;">SECURESHIELD AI</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">A login attempt was initiated for your enterprise account. Please verify your identity using the verification code below:</p>
            <div style="background-color: #0f172a; padding: 24px; border-radius: 8px; text-align: center; margin: 30px 0; border: 1px dashed #38bdf8;">
              <span style="font-size: 36px; font-weight: 800; color: #38bdf8; letter-spacing: 8px; font-family: monospace;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #94a3b8; text-align: center;">This code will expire in <strong>5 minutes</strong>. If you did not request this code, please log in and change your credentials immediately.</p>
            <hr style="border: 0; border-top: 1px solid #1e293b; margin: 30px 0;" />
            <p style="font-size: 12px; color: #64748b; text-align: center;">SecureShield AI Enterprise Authentication Engine • Automated Notification</p>
          </div>
        `,
      });

      logger.info(`📧 Sent email OTP to ${email}: ${nodemailer.getTestMessageUrl(info) || "Sent"}`);
      return true;
    } catch (error: any) {
      logger.error("❌ Failed to send email OTP: %s", error.message);
      return false;
    }
  }

  static async sendSmsOtp(userId: string, phone: string, otp: string): Promise<boolean> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const fast2smsKey = process.env.FAST2SMS_API_KEY;

    if (fast2smsKey) {
      try {
        const cleanPhone = phone.replace(/[^\d]/g, "").slice(-10);
        const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            "authorization": fast2smsKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            route: "otp",
            variables_values: otp,
            numbers: cleanPhone
          })
        });

        if (response.ok) {
          logger.info(`📱 Sent SMS OTP (via Fast2SMS) to ${phone}`);
          return true;
        }
      } catch (err: any) {
        logger.error("❌ Fast2SMS Send Failed: %s", err.message);
      }
    }

    if (accountSid && authToken && fromNumber) {
      try {
        const twilio = require("twilio");
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          body: `Your SecureShield security code is ${otp}. It expires in 5 minutes.`,
          from: fromNumber,
          to: phone,
        });
        logger.info(`📱 Sent SMS OTP (via Twilio) to ${phone}`);
        return true;
      } catch (error: any) {
        logger.error("❌ Twilio Send Failed: %s", error.message);
      }
    }

    logger.warn(`⚠️ SMS Provider not configured. Development OTP is: ${otp}`);
    return false; // Returns false, indicating we fall back to logging/showing code in response for demo convenience.
  }

  static async createOtpRecord(userId: string, type: "sms" | "email", destination: string, otp: string) {
    const codeHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    if (isMongoMock) {
      // Invalidate existing records
      mockDb.deleteMany("Otp", { userId, type });
      return mockDb.insertOne("Otp", {
        userId,
        codeHash,
        type,
        destination,
        expiresAt,
        attempts: 0,
        verified: false,
      });
    } else {
      await OtpModel.deleteMany({ userId, type });
      const record = new OtpModel({
        userId,
        codeHash,
        type,
        destination,
        expiresAt,
      });
      return await record.save();
    }
  }

  static async verifyOtp(userId: string, type: "sms" | "email", code: string): Promise<{ ok: boolean; message: string }> {
    const hashed = this.hashOtp(code);
    
    let record: any;
    if (isMongoMock) {
      record = mockDb.findOne("Otp", { userId, type });
    } else {
      record = await OtpModel.findOne({ userId, type });
    }

    if (!record) {
      return { ok: false, message: "No active OTP session found. Please request a new code." };
    }

    if (record.verified) {
      return { ok: false, message: "This code has already been verified." };
    }

    if (new Date() > new Date(record.expiresAt)) {
      if (isMongoMock) {
        mockDb.deleteMany("Otp", { userId, type });
      } else {
        await OtpModel.deleteMany({ userId, type });
      }
      return { ok: false, message: "Verification code has expired. Request a new one." };
    }

    if (record.codeHash !== hashed) {
      const newAttempts = record.attempts + 1;
      const maxAttempts = 5;

      if (newAttempts >= maxAttempts) {
        if (isMongoMock) {
          mockDb.deleteMany("Otp", { userId, type });
        } else {
          await OtpModel.deleteMany({ userId, type });
        }
        return { ok: false, message: "Too many failed attempts. Code invalidated. Request a new one." };
      }

      if (isMongoMock) {
        mockDb.updateOne("Otp", { _id: record._id }, { attempts: newAttempts });
      } else {
        record.attempts = newAttempts;
        await record.save();
      }

      return { ok: false, message: `Incorrect code. ${maxAttempts - newAttempts} attempts remaining.` };
    }

    // Mark as verified
    if (isMongoMock) {
      mockDb.updateOne("Otp", { _id: record._id }, { verified: true });
    } else {
      record.verified = true;
      await record.save();
    }

    return { ok: true, message: "OTP code successfully verified." };
  }

  static generateBackupCodes(): { rawCodes: string[]; hashedCodes: string[] } {
    const rawCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < 8; i++) {
      const raw = crypto.randomBytes(4).toString("hex"); // 8 chars code
      const hashed = crypto.createHash("sha256").update(raw).digest("hex");
      rawCodes.push(raw);
      hashedCodes.push(hashed);
    }

    return { rawCodes, hashedCodes };
  }

  static async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const hashed = crypto.createHash("sha256").update(code).digest("hex");
    let user: any;

    if (isMongoMock) {
      user = mockDb.findOne("User", { _id: userId });
    } else {
      user = await UserModel.findById(userId);
    }

    if (!user || !user.backupCodes || user.backupCodes.length === 0) {
      return false;
    }

    const codeIndex = user.backupCodes.indexOf(hashed);
    if (codeIndex === -1) {
      return false;
    }

    // Remove the used backup code (one-time use)
    const updatedCodes = [...user.backupCodes];
    updatedCodes.splice(codeIndex, 1);

    if (isMongoMock) {
      mockDb.updateOne("User", { _id: userId }, { backupCodes: updatedCodes });
    } else {
      user.backupCodes = updatedCodes;
      await user.save();
    }

    return true;
  }
}
