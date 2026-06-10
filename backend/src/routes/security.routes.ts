import { Router } from "express";
import { SecurityController } from "../controllers/security.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { UserRole } from "../models/user";

const router = Router();

// Secure security routes with authentication and either Admin or SecurityAnalyst roles
router.use(authenticateJWT);
router.use(authorizeRoles(UserRole.ADMIN, UserRole.ANALYST));

router.get("/alerts", SecurityController.getAlerts);
router.post("/alerts/:alertId/resolve", SecurityController.resolveAlert);
router.get("/audit-logs", SecurityController.getAuditLogs);
router.get("/assessments", SecurityController.getRiskAssessments);

export default router;
