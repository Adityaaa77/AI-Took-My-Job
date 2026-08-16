import { Router } from "express";
import {
  getAllShipments,
  getShipmentById,
  createShipment,
  updateShipmentStatus,
} from "../controllers/shipment.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

router
  .route("/")
  .get(protect, getAllShipments)
  .post(protect, authorise("admin", "warehouse_manager", "vendor"), createShipment);

router.get("/:id", protect, getShipmentById);

router.patch(
  "/:id/status",
  protect,
  authorise("admin", "warehouse_manager", "vendor"),
  updateShipmentStatus
);

export default router;