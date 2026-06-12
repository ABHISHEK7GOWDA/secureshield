import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import client from "prom-client";
import { logger } from "./config/logger";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import securityRoutes from "./routes/security.routes";

const app = express();

// Enable Prometheus default metrics collection
client.collectDefaultMetrics();

// Custom Prometheus counter for login events
export const authCounter = new client.Counter({
  name: "secureshield_auth_attempts_total",
  help: "Total number of authentication attempts in SecureShield AI",
  labelNames: ["action", "status"],
});

// Security middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());

// Request logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`📡 Request: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Prometheus metrics endpoint
app.get("/metrics", async (req: Request, res: Response) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err: any) {
    res.status(500).end(err.message);
  }
});

// Swagger documentation setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SecureShield AI - Enterprise MFA & Threat Detection API Docs",
      version: "1.0.0",
      description: "API documentation for the SecureShield fullstack cybersecurity system.",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 4173}`,
        description: "Development Server",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health-check endpoint
app.get(["/health", "/api/health"], (req: Request, res: Response) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date(),
    uptime: process.uptime(),
    mockMode: process.env.MOCK_DB === "true",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/security", securityRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("💥 Unhandled App Error: %s", err.message, { stack: err.stack });
  res.status(err.status || 500).json({
    ok: false,
    message: err.message || "An unexpected error occurred on the secure shield server.",
  });
});

export default app;
