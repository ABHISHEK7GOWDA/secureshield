import dotenv from "dotenv";
import path from "path";
import * as argon2 from "argon2";
import { connectDB, isMongoMock } from "./config/db";
import { mockDb } from "./config/mockDb";
import UserModel, { UserRole } from "./models/user";
import { logger } from "./config/logger";
import { OtpService } from "./services/otp.service";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function seed() {
  console.log("🌱 Seeding database with default enterprise profiles...");

  // Trigger DB connect (will toggle isMongoMock if offline)
  await connectDB();

  const usersToSeed = [
    {
      username: "admin",
      email: "admin@secureshield.ai",
      password: "admin",
      role: UserRole.ADMIN,
    },
    {
      username: "analyst",
      email: "analyst@secureshield.ai",
      password: "AnalystPassword123!",
      role: UserRole.ANALYST,
    },
    {
      username: "user_demo",
      email: "user@secureshield.ai",
      password: "UserPassword123!",
      role: UserRole.USER,
    },
  ];

  try {
    for (const userData of usersToSeed) {
      const passwordHash = await argon2.hash(userData.password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 4,
      });

      const { hashedCodes } = OtpService.generateBackupCodes();

      const seedData = {
        username: userData.username,
        email: userData.email,
        passwordHash,
        role: userData.role,
        isMfaEnabled: true,
        backupCodes: hashedCodes,
        failedAttempts: 0,
      };

      if (process.env.MOCK_DB === "true" || isMongoMock) {
        // Seed file-based DB
        const existing = mockDb.findOne("User", { username: userData.username });
        if (existing) {
          mockDb.deleteMany("User", { username: userData.username });
        }
        mockDb.insertOne("User", seedData);
        logger.info(`[MOCK DB] Seeded user: ${userData.username} (Password: ${userData.password})`);
      } else {
        // Seed MongoDB
        const existing = await UserModel.findOne({ username: userData.username });
        if (existing) {
          await UserModel.deleteOne({ username: userData.username });
        }
        await new UserModel(seedData).save();
        logger.info(`[MONGO DB] Seeded user: ${userData.username} (Password: ${userData.password})`);
      }
    }

    console.log("\n==========================================================");
    console.log("🌱 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    console.log("==========================================================\n");
    process.exit(0);
  } catch (error: any) {
    logger.error("❌ Seeding Error: %s", error.message);
    process.exit(1);
  }
}

seed();
