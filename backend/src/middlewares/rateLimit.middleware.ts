import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { logger } from "../config/logger";

// Standard API rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
  handler: (req: Request, res: Response, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on route: ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  },
});

// Strict rate limiter for auth (login, verify OTP, register)
export const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 auth attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Too many authentication attempts. Please try again after 1 minute.",
  },
  handler: (req: Request, res: Response, next, options) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip} on route: ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  },
});
