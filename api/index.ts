import app from "../backend/src/app";
import { connectDB, connectRedis } from "../backend/src/config/db";

let isInitialized = false;

async function initialize() {
  if (!isInitialized) {
    // 1. Connect to Database & Cache fallbacks
    await connectDB();
    await connectRedis();
    isInitialized = true;
  }
}

export default async (req: any, res: any) => {
  await initialize();
  return app(req, res);
};
