const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const app = require("../../backend/dist/app").default;
const { connectDB, connectRedis } = require("../../backend/dist/config/db");

// Connect to databases
connectDB();
connectRedis();

module.exports = app;
