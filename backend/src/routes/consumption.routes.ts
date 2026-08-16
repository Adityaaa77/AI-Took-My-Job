import { Router } from "express";
import {
  getAllConsumption,
  getConsumptionById,
  getConsumptionByHospital,
  createConsumption,
} from "../controllers/consumption.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

// Hospital-specific sub-route — must be before /:id
router.get("/hospital/:hospital_id", protect, getConsumptionByHospital);

router
  .route("/")
  .get(protect, getAllConsumption)
  .post(protect, authorise("admin", "hospital_staff"), createConsumption);

router.get("/:id", protect, getConsumptionById);

export default router;
