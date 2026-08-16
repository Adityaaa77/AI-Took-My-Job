import { Router } from "express";
import {
  getAllVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
} from "../controllers/vendor.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

router
  .route("/")
  .get(protect, getAllVendors)
  .post(protect, authorise("admin", "procurement_officer"), createVendor);

router
  .route("/:id")
  .get(protect, getVendorById)
  .patch(protect, authorise("admin", "procurement_officer"), updateVendor)
  .delete(protect, authorise("admin"), deleteVendor);

export default router;