import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../config/logger";
import { isMongoMock } from "../config/db";
import { mockDb } from "../config/mockDb";
import UserModel from "../models/user";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        role: string;
      };
    }
  }
}

export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ ok: false, message: "Authentication required. Access token missing." });
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || "secureshield_default_access_secret_2026";
    const decoded = jwt.verify(token, secret) as { id: string; username: string; email: string; role: string };

    let user: any;
    if (isMongoMock) {
      user = mockDb.findOne("User", { _id: decoded.id });
    } else {
      user = await UserModel.findById(decoded.id);
    }

    if (!user) {
      return res.status(401).json({ ok: false, message: "User account no longer exists." });
    }

    // Check account lockout
    if (user.lockUntil && new Date() < new Date(user.lockUntil)) {
      return res.status(403).json({ ok: false, message: "This account is temporarily locked out." });
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error: any) {
    logger.warn(`JWT verification failed: ${error.message}`);
    return res.status(401).json({ ok: false, message: "Invalid or expired access token." });
  }
};
