import { Router } from "express";
import {
  getAllWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../controllers/warehouse.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

router
  .route("/")
  .get(protect, getAllWarehouses)
  .post(protect, authorise("admin"), createWarehouse);

router
  .route("/:id")
  .get(protect, getWarehouseById)
  .patch(protect, authorise("admin", "warehouse_manager"), updateWarehouse)
  .delete(protect, authorise("admin"), deleteWarehouse);

export default router;
