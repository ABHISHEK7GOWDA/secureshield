import mongoose from "mongoose";
import { createClient } from "redis";
import { logger } from "./logger";

export let isMongoMock = false;
export let isRedisMock = false;

// Mock Redis implementation for in-memory caching
class MockRedisClient {
  private store = new Map<string, string>();

  async connect() {
    logger.warn("⚠️ Using Mock In-Memory Redis client.");
    return this;
  }
  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }
  async set(key: string, value: string, options?: any): Promise<string> {
    this.store.set(key, value);
    if (options && options.EX) {
      setTimeout(() => this.store.delete(key), options.EX * 1000);
    }
    return "OK";
  }
  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }
  on(event: string, callback: any) {
    // No-op for mock
    return this;
  }
}

export let redisClient: any = new MockRedisClient();

export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/secureshield";
  
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    });
    logger.info("📡 MongoDB connected successfully.");
  } catch (error: any) {
    logger.error("❌ MongoDB connection failed: %s", error.message);
    logger.warn("⚠️ Toggling Mock Database Mode (Data will persist in-memory/JSON mock layers).");
    isMongoMock = true;
    process.env.MOCK_DB = "true";
  }
}

export async function connectRedis() {
  const redisUri = process.env.REDIS_URI || "redis://127.0.0.1:6379";
  
  try {
    const client = createClient({
      url: redisUri,
      socket: {
        connectTimeout: 4000,
        reconnectStrategy: (retries) => {
          if (retries > 2) {
            return new Error("Redis connection retry threshold reached");
          }
          return 1000;
        }
      }
    });

    client.on("error", (err) => {
      logger.error("❌ Redis Error: %s", err.message);
    });

    await client.connect();
    redisClient = client;
    logger.info("🚀 Redis connected successfully.");
  } catch (error: any) {
    logger.error("❌ Redis connection failed: %s", error.message);
    logger.warn("⚠️ Toggling Mock Redis Mode (Caching & sessions will run in-memory).");
    isRedisMock = true;
    process.env.MOCK_REDIS = "true";
    redisClient = new MockRedisClient();
    await redisClient.connect();
  }
}
