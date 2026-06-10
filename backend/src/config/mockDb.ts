import fs from "fs";
import path from "path";
import { logger } from "./logger";

// Detect Vercel environment
const isVercel = !!process.env.VERCEL;

// Resolve the directory where mock data is stored in the project
const PROJECT_SEED_DIR = path.join(__dirname, "../../mock_db_data");

// Resolve the active directory where files will be read/written
const MOCK_DB_DIR = isVercel ? "/tmp/mock_db_data" : (
  fs.existsSync(path.join(process.cwd(), "backend", "mock_db_data"))
    ? path.join(process.cwd(), "backend", "mock_db_data")
    : path.join(process.cwd(), "mock_db_data")
);

// Create directory if it doesn't exist
if (!fs.existsSync(MOCK_DB_DIR)) {
  fs.mkdirSync(MOCK_DB_DIR, { recursive: true });
}

// Copy seed files if they exist in project seed directory and aren't in the active directory
if (fs.existsSync(PROJECT_SEED_DIR)) {
  try {
    const seedFiles = fs.readdirSync(PROJECT_SEED_DIR);
    for (const file of seedFiles) {
      if (file.endsWith(".json")) {
        const destPath = path.join(MOCK_DB_DIR, file);
        if (!fs.existsSync(destPath)) {
          const srcPath = path.join(PROJECT_SEED_DIR, file);
          fs.copyFileSync(srcPath, destPath);
          logger.info(`[MOCK DB] Seeded ${file} to active directory: ${destPath}`);
        }
      }
    }
  } catch (err) {
    logger.error("Failed to pre-seed mock DB directory:", err);
  }
}

class MockDb {
  private getFilePath(collectionName: string): string {
    return path.join(MOCK_DB_DIR, `${collectionName}.json`);
  }

  read<T>(collectionName: string): T[] {
    const filePath = this.getFilePath(collectionName);
    if (!fs.existsSync(filePath)) {
      this.write(collectionName, []);
      return [];
    }
    try {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content || "[]") as T[];
    } catch (error) {
      logger.error(`Error reading mock db file for ${collectionName}:`, error);
      return [];
    }
  }

  write<T>(collectionName: string, data: T[]): void {
    const filePath = this.getFilePath(collectionName);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
      logger.error(`Error writing mock db file for ${collectionName}:`, error);
    }
  }

  // Helper CRUD methods
  find<T = any>(
    collectionName: string,
    query: any = {}
  ): T[] {
    const items = this.read<T>(collectionName);
    return items.filter((item: any) => {
      for (const key in query) {
        if (item[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
  }

  findOne<T = any>(
    collectionName: string,
    query: any
  ): T | null {
    const results = this.find<T>(collectionName, query);
    return results.length > 0 ? results[0] : null;
  }

  insertOne<T = any>(
    collectionName: string,
    item: any
  ): T {
    const items = this.read<any>(collectionName);
    const newItem = {
      ...item,
      _id: item._id || item.id || Math.random().toString(36).substring(2, 11),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    };
    items.push(newItem);
    this.write(collectionName, items);
    return newItem as T;
  }

  updateOne<T = any>(
    collectionName: string,
    query: any,
    updates: any
  ): T | null {
    const items = this.read<any>(collectionName);
    const index = items.findIndex((item: any) => {
      for (const key in query) {
        if (item[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });

    if (index === -1) return null;

    items[index] = {
      ...items[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.write(collectionName, items);
    return items[index] as T;
  }

  deleteMany(
    collectionName: string,
    query: any
  ): number {
    const items = this.read<any>(collectionName);
    const initialCount = items.length;
    const remaining = items.filter((item: any) => {
      for (const key in query) {
        if (item[key] !== query[key]) {
          return true;
        }
      }
      return false;
    });
    this.write(collectionName, remaining);
    return initialCount - remaining.length;
  }
}

export const mockDb = new MockDb();
