import { Router } from "express";
import {
  getAllDrugs,
  getDrugById,
  createDrug,
  updateDrug,
  deleteDrug,
} from "../controllers/drug.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

// GET  /api/v1/drugs          — any authenticated user
// GET  /api/v1/drugs/:id      — any authenticated user
// POST /api/v1/drugs          — admin, warehouse_manager
// PATCH /api/v1/drugs/:id     — admin, warehouse_manager
// DELETE /api/v1/drugs/:id    — admin only

router
  .route("/")
  .get(protect, getAllDrugs)
  .post(protect, authorise("admin", "warehouse_manager"), createDrug);

router
  .route("/:id")
  .get(protect, getDrugById)
  .patch(protect, authorise("admin", "warehouse_manager"), updateDrug)
  .delete(protect, authorise("admin"), deleteDrug);

export default router;
