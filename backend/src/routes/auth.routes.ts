import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { validateRequest } from "../middlewares/validation.middleware";
import { authLimiter } from "../middlewares/rateLimit.middleware";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  verifyFaceSchema,
  verifyLocationSchema,
  verifyBackupCodeSchema,
} from "../middlewares/validation.schemas";

const router = Router();

router.post("/register", validateRequest(registerSchema), AuthController.register);
router.post("/login", authLimiter, validateRequest(loginSchema), AuthController.login);
router.post("/verify-otp", authLimiter, validateRequest(verifyOtpSchema), AuthController.verifyOtp);
router.post("/verify-face", authLimiter, validateRequest(verifyFaceSchema), AuthController.verifyFace);
router.post("/verify-location", authLimiter, validateRequest(verifyLocationSchema), AuthController.verifyLocation);
router.post("/verify-backup-code", authLimiter, validateRequest(verifyBackupCodeSchema), AuthController.verifyBackupCode);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
router.get("/me", authenticateJWT, AuthController.me);

export default router;
