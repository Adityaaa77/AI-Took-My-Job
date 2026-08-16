import { Router } from "express";
import {
  getAllAlerts,
  getAlertById,
  createAlert,
  resolveAlert,
  deleteAlert,
} from "../controllers/alert.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

router
  .route("/")
  .get(protect, getAllAlerts)
  .post(protect, authorise("admin", "warehouse_manager"), createAlert);

router.get("/:id",                         protect, getAlertById);
router.patch("/:id/resolve", protect, authorise("admin", "warehouse_manager"), resolveAlert);
router.delete("/:id",        protect, authorise("admin"),                      deleteAlert);

export default router;
