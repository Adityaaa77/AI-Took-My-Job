import { Router } from "express";
import {
  getAllInventory,
  getInventoryById,
  getLowStockItems,
  upsertInventory,
  updateInventory,
} from "../controllers/inventory.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

// Special report — must be defined BEFORE /:id to avoid route conflict
router.get("/low-stock", protect, getLowStockItems);

router
  .route("/")
  .get(protect, getAllInventory)
  .post(protect, authorise("admin", "warehouse_manager"), upsertInventory);

router
  .route("/:id")
  .get(protect, getInventoryById)
  .patch(protect, authorise("admin", "warehouse_manager"), updateInventory);

export default router;
