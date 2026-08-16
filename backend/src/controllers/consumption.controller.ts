import { Response, NextFunction } from "express";
import { ConsumptionRecord } from "../models/ConsumptionRecord.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthenticatedRequest } from "../types/index.js";

/**
 * GET /api/v1/consumption
 * Query: hospital_id, drug_id(_id), is_anomaly
 */
export const getAllConsumption = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { hospital_id, is_anomaly } = req.query;
    const filter: Record<string, unknown> = {};
    if (hospital_id) filter.hospital_id = hospital_id;
    if (is_anomaly !== undefined) filter.is_anomaly = is_anomaly === "true";

    const records = await ConsumptionRecord.find(filter)
      .populate("drug_id", "drug_id name unit")
      .populate("recorded_by", "name role")
      .sort({ period_end: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/consumption/:id */
export const getConsumptionById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const record = await ConsumptionRecord.findById(req.params.id)
      .populate("drug_id", "drug_id name unit")
      .populate("recorded_by", "name role");

    if (!record) throw new AppError("Consumption record not found", 404);
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/consumption/hospital/:hospital_id
 * All consumption records for a specific hospital, newest first.
 */
export const getConsumptionByHospital = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const records = await ConsumptionRecord.find({
      hospital_id: req.params.hospital_id,
    })
      .populate("drug_id", "drug_id name unit is_critical")
      .sort({ period_end: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/consumption
 * Body: { hospital_id, drug_id(_id), period_start, period_end,
 *         quantity_consumed, daily_avg_consumption, is_anomaly?, notes? }
 * Roles: admin, hospital_staff
 *
 * Simple anomaly auto-flag: if current daily_avg is > 2× the hospital's
 * recent average for this drug, mark is_anomaly = true.
 */
export const createConsumption = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      hospital_id, drug_id,
      period_start, period_end,
      quantity_consumed, daily_avg_consumption,
      is_anomaly, notes,
    } = req.body;

    if (!hospital_id || !drug_id || !period_start || !period_end || quantity_consumed === undefined || daily_avg_consumption === undefined)
      throw new AppError(
        "hospital_id, drug_id, period_start, period_end, quantity_consumed and daily_avg_consumption are required",
        400
      );

    // Auto-detect anomaly if not explicitly set
    let flagged = is_anomaly ?? false;
    if (!flagged) {
      const recent = await ConsumptionRecord.find({ hospital_id, drug_id })
        .sort({ period_end: -1 })
        .limit(5);

      if (recent.length >= 2) {
        const avgHistoric =
          recent.reduce((sum, r) => sum + r.daily_avg_consumption, 0) / recent.length;
        flagged = daily_avg_consumption > avgHistoric * 2;
      }
    }

    const record = await ConsumptionRecord.create({
      hospital_id, drug_id,
      period_start: new Date(period_start),
      period_end:   new Date(period_end),
      quantity_consumed,
      daily_avg_consumption,
      is_anomaly: flagged,
      recorded_by: req.user!.userId,
      notes,
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
};
