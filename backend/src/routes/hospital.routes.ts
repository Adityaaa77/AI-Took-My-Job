import { Router } from "express";
import {
  getAllHospitals,
  getHospitalById,
  createHospital,
  updateHospital,
  deleteHospital,
} from "../controllers/hospital.controller.js";
import { protect, authorise } from "../middleware/auth.middleware.js";

const router = Router();

// GET  /api/v1/hospitals        — any authenticated user
// GET  /api/v1/hospitals/:id    — any authenticated user
// POST /api/v1/hospitals        — admin only
// PATCH /api/v1/hospitals/:id   — admin only
// DELETE /api/v1/hospitals/:id  — admin only

router
  .route("/")
  .get(protect, getAllHospitals)
  .post(protect, authorise("admin"), createHospital);

router
  .route("/:id")
  .get(protect, getHospitalById)
  .patch(protect, authorise("admin"), updateHospital)
  .delete(protect, authorise("admin"), deleteHospital);

export default router;
