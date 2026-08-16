import { Response, NextFunction } from "express";
import { ConsumptionRecord } from "../models/ConsumptionRecord.model.js";
import { Inventory } from "../models/Inventory.model.js";
import { Drug } from "../models/Drug.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthenticatedRequest } from "../types/index.js";
import { logAuditEvent } from "../utils/auditLogger.js";

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
    if (hospital_id && hospital_id !== "all") {
      filter.hospital_id = { $regex: String(hospital_id), $options: "i" };
    }
    if (is_anomaly !== undefined) {
      filter.is_anomaly = is_anomaly === "true";
    }

    const records = await ConsumptionRecord.find(filter)
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
      .populate("recorded_by", "name role")
      .sort({ period_end: -1, createdAt: -1 });

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
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
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
    const cleanHospId = String(req.params.hospital_id).split(" ")[0].trim();
    const records = await ConsumptionRecord.find({
      hospital_id: { $regex: cleanHospId, $options: "i" },
    })
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
      .populate("recorded_by", "name role")
      .sort({ period_end: -1, createdAt: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/consumption
 * Body: { hospital_id, drug_id, period_start?, period_end?,
 *         quantity_consumed, daily_avg_consumption?, is_anomaly?, notes? }
 * Roles: admin, hospital_staff
 *
 * Business logic:
 * 1. Verifies hospital_staff role scope (cannot record consumption for another hospital).
 * 2. Resolves drug_id code string (e.g. "DRUG-001") to Drug ObjectId.
 * 3. Checks available_stock in Inventory collection. Rejects if available_stock < quantity_consumed.
 * 4. Atomically decrements available_stock in Inventory collection.
 * 5. Creates ConsumptionRecord document.
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

    if (!hospital_id || !drug_id || quantity_consumed === undefined || Number(quantity_consumed) <= 0) {
      throw new AppError("hospital_id, drug_id, and a positive quantity_consumed are required", 400);
    }

    const cleanHospId = String(hospital_id).split(" ")[0].trim();

    // Verify hospital_staff role scope (if associated_entity_id is configured)
    if (req.user?.role === "hospital_staff" && req.user?.associated_entity_id) {
      const userHospId = String(req.user.associated_entity_id).split(" ")[0].trim();
      if (cleanHospId.toLowerCase() !== userHospId.toLowerCase()) {
        throw new AppError(
          `Hospital staff assigned to '${userHospId}' cannot record consumption for facility '${cleanHospId}'`,
          403
        );
      }
    }

    // Resolve drug Mongo _id (supports "DRUG-001" code string or ObjectId string)
    const drugDoc = await Drug.findOne({
      $or: [
        { drug_id: drug_id },
        { _id: /^[a-f\d]{24}$/i.test(drug_id) ? drug_id : null },
      ],
    });

    if (!drugDoc) {
      throw new AppError(`Drug '${drug_id}' not found in catalog`, 404);
    }

    const qty = Number(quantity_consumed);
    const dailyAvg = daily_avg_consumption !== undefined ? Number(daily_avg_consumption) : qty;

    // Check available stock in Inventory collection before attempting reduction
    const invRecord = await Inventory.findOne({
      location_id: cleanHospId,
      drug_id: drugDoc._id,
    });

    const currentStock = invRecord ? invRecord.available_stock : 0;
    if (currentStock < qty) {
      throw new AppError(
        `Insufficient available stock at facility '${cleanHospId}' for '${drugDoc.name}'. Current stock: ${currentStock} ${drugDoc.unit || 'units'}, Requested: ${qty} ${drugDoc.unit || 'units'}.`,
        400
      );
    }

    // Atomically decrement available stock in MongoDB
    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        location_id: cleanHospId,
        drug_id: drugDoc._id,
        available_stock: { $gte: qty },
      },
      {
        $inc: { available_stock: -qty },
        $set: { last_updated: new Date() },
      },
      { new: true, runValidators: true }
    );

    if (!updatedInventory) {
      throw new AppError(
        `Stock reduction failed due to concurrent update or insufficient inventory balance.`,
        400
      );
    }

    const pEnd = period_end ? new Date(period_end) : new Date();
    const pStart = period_start ? new Date(period_start) : new Date(Date.now() - 86400000);

    // Auto-detect anomaly if not explicitly set
    let flagged = is_anomaly ?? false;
    if (!flagged) {
      const recent = await ConsumptionRecord.find({ hospital_id: cleanHospId, drug_id: drugDoc._id })
        .sort({ period_end: -1 })
        .limit(5);

      if (recent.length >= 2) {
        const avgHistoric =
          recent.reduce((sum, r) => sum + r.daily_avg_consumption, 0) / recent.length;
        flagged = dailyAvg > avgHistoric * 2;
      }
    }

    const record = await ConsumptionRecord.create({
      hospital_id: cleanHospId,
      drug_id: drugDoc._id,
      period_start: pStart,
      period_end: pEnd,
      quantity_consumed: qty,
      daily_avg_consumption: dailyAvg,
      is_anomaly: flagged,
      recorded_by: req.user!.userId,
      notes,
    });

    const populatedRecord = await ConsumptionRecord.findById(record._id)
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
      .populate("recorded_by", "name role");

    await logAuditEvent(req, "HOSPITAL_CONSUMPTION_RECORDED", "ConsumptionRecord", String(record._id), {
      hospital_id: cleanHospId,
      drug_id: drugDoc.drug_id || drugDoc.name,
      quantity_consumed: qty,
      is_anomaly: flagged,
    });

    res.status(201).json({ success: true, data: populatedRecord });
  } catch (err) {
    next(err);
  }
};
