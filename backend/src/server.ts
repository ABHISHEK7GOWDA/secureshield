import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

import app from "./app";
import { connectDB, connectRedis } from "./config/db";
import { logger } from "./config/logger";

const PORT = Number(process.env.PORT || 4173);

async function startServer() {
  console.log("\n==========================================================");
  console.log("🛡️  SECURESHIELD AI - ENTERPRISE SECURITY PLATFORM BOOTING  🛡️");
  console.log("==========================================================\n");

  // 1. Connect to Database & Cache
  await connectDB();
  await connectRedis();

  // 2. Start HTTP Server
  app.listen(PORT, () => {
    logger.info(`✨ SecureShield Engine running at http://localhost:${PORT}`);
    logger.info(`📖 Swagger interactive API docs: http://localhost:${PORT}/api-docs`);
    logger.info(`📊 Prometheus metrics exporter: http://localhost:${PORT}/metrics`);
    console.log("\n----------------------------------------------------------");
    console.log("🛡️  System Status: OPERATIONAL");
    console.log(`🛡️  Database Fallbacks: ${process.env.MOCK_DB === "true" ? "ACTIVE (JSON Database fallback)" : "CONNECTED (Mongoose)"}`);
    console.log(`🛡️  Cache Fallbacks: ${process.env.MOCK_REDIS === "true" ? "ACTIVE (Memory Cache fallback)" : "CONNECTED (Redis)"}`);
    console.log("----------------------------------------------------------\n");
  });
}

// Global exception handling
process.on("unhandledRejection", (reason: any) => {
  logger.error("💥 Unhandled Rejection at Promise: %s", reason.message || reason, { stack: reason.stack });
});

process.on("uncaughtException", (error: Error) => {
  logger.error("💥 Uncaught Exception: %s", error.message, { stack: error.stack });
  process.exit(1);
});

startServer();
