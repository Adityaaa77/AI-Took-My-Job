import { Router } from "express";
import { getAllAuditLogs } from "../controllers/audit.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", protect, getAllAuditLogs);

export default router;
