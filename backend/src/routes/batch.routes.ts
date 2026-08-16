import { Router } from "express";
import {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} from "../controllers/batch.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

router
  .route("/")
  .get(protect, getAllBatches)
  .post(protect, authorise("admin", "warehouse_manager"), createBatch);

router
  .route("/:id")
  .get(protect, getBatchById)
  .patch(protect, authorise("admin", "warehouse_manager", "compliance_officer"), updateBatch)
  .delete(protect, authorise("admin"), deleteBatch);

export default router;