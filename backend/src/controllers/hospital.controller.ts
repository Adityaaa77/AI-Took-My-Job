import { Request, Response, NextFunction } from "express";
import { Hospital } from "../models/Hospital.model.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * GET /api/v1/hospitals
 * Query params: tier, location_zone
 */
export const getAllHospitals = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tier, location_zone } = req.query;

    const filter: Record<string, unknown> = {};
    if (tier) filter.tier = tier;
    if (location_zone) filter.location_zone = location_zone;

    const hospitals = await Hospital.find(filter).sort({ name: 1 });

    res.json({ success: true, count: hospitals.length, data: hospitals });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/hospitals/:id
 * Accepts hospital_id (HOSP-001) or MongoDB _id
 */
export const getHospitalById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const hospital = await Hospital.findOne({
      $or: [
        { hospital_id: id },
        { _id: id.match(/^[a-f\d]{24}$/i) ? id : null },
      ],
    });

    if (!hospital) throw new AppError("Hospital not found", 404);

    res.json({ success: true, data: hospital });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/hospitals
 * Body: { name, tier, location_zone, address?, contact_person?, contact_phone?, contact_email? }
 * Roles: admin
 */
export const createHospital = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      tier,
      location_zone,
      address,
      contact_person,
      contact_phone,
      contact_email,
    } = req.body;

    if (!name || !tier || !location_zone) {
      throw new AppError("name, tier and location_zone are required", 400);
    }

    const hospital = await Hospital.create({
      name,
      tier,
      location_zone,
      address,
      contact_person,
      contact_phone,
      contact_email,
    });

    res.status(201).json({ success: true, data: hospital });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/hospitals/:id
 * Roles: admin
 */
export const updateHospital = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const allowedFields = [
      "name",
      "tier",
      "location_zone",
      "address",
      "contact_person",
      "contact_phone",
      "contact_email",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const hospital = await Hospital.findOneAndUpdate(
      {
        $or: [
          { hospital_id: id },
          { _id: id.match(/^[a-f\d]{24}$/i) ? id : null },
        ],
      },
      updates,
      { new: true, runValidators: true }
    );

    if (!hospital) throw new AppError("Hospital not found", 404);

    res.json({ success: true, data: hospital });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/hospitals/:id
 * Roles: admin
 */
export const deleteHospital = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const hospital = await Hospital.findOneAndDelete({
      $or: [
        { hospital_id: id },
        { _id: id.match(/^[a-f\d]{24}$/i) ? id : null },
      ],
    });

    if (!hospital) throw new AppError("Hospital not found", 404);

    res.json({ success: true, message: "Hospital deleted successfully" });
  } catch (err) {
    next(err);
  }
};
