import { Router } from "express";
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
} from "../controllers/purchaseOrder.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

router
  .route("/")
  .get(protect, getAllOrders)
  .post(protect, authorise("admin", "warehouse_manager"), createOrder);

router.get("/:id", protect, getOrderById);

// Status update is a dedicated sub-route (PATCH /purchase-orders/:id/status)
router.patch(
  "/:id/status",
  protect,
  authorise("admin", "warehouse_manager"),
  updateOrderStatus
);

export default router;
