import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { UserRole } from "../models/user";

const router = Router();

// Secure all admin routes with authentication and Admin RBAC role check
router.use(authenticateJWT);
router.use(authorizeRoles(UserRole.ADMIN));

router.get("/users", AdminController.getUsers);
router.put("/users/:userId/role", AdminController.changeUserRole);
router.post("/users/:userId/unlock", AdminController.unlockUser);
router.delete("/sessions/:sessionId", AdminController.revokeSession);
router.get("/policy", AdminController.getPolicy);
router.put("/policy", AdminController.updatePolicy);

export default router;
