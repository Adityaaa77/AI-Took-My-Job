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
  .post(protect, authorise("admin", "procurement_officer"), createOrder);

router.get("/:id", protect, getOrderById);

// Status update is a dedicated sub-route (PATCH /purchase-orders/:id/status)
router.patch(
  "/:id/status",
  protect,
  authorise("admin", "procurement_officer"),
  updateOrderStatus
);

export default router;