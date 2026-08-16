import { Router } from "express";
import {
  triggerAnalysis,
  getAllRecommendations,
  getRecommendationById,
  approveRecommendation,
  rejectRecommendation,
  previewSnapshot,
} from "../controllers/ai.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

// ── Snapshot preview (dev/debug — no AI call made) ───────────────────────────
router.get("/snapshot", protect, authorise("admin"), previewSnapshot);

// ── Trigger full AI analysis ─────────────────────────────────────────────────
router.post(
  "/analyze",
  protect,
  authorise("admin", "warehouse_manager"),
  triggerAnalysis
);

// ── Recommendation management ─────────────────────────────────────────────────
router.get("/recommendations",      protect, getAllRecommendations);
router.get("/recommendations/:id",  protect, getRecommendationById);

router.patch(
  "/recommendations/:id/approve",
  protect,
  authorise("admin"),
  approveRecommendation
);

router.patch(
  "/recommendations/:id/reject",
  protect,
  authorise("admin"),
  rejectRecommendation
);

export default router;
