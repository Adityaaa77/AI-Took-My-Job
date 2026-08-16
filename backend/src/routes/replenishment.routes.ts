import { Router } from "express";
import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequestStatus,
} from "../controllers/replenishment.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

router
  .route("/")
  .get(protect, getAllRequests)
  .post(protect, authorise("admin", "hospital_staff", "procurement_officer"), createRequest);

router.get("/:id", protect, getRequestById);
router.patch("/:id/status", protect, updateRequestStatus);

export default router;
