import { Request, Response, NextFunction } from "express";
import { Inventory } from "../models/Inventory.model.js";
import { Drug } from "../models/Drug.model.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * GET /api/v1/inventory
 * Query: location_id, drug_id (human-readable), location_type
 */
export const getAllInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { location_id, location_type } = req.query;
    const filter: Record<string, unknown> = {};
    if (location_id && location_id !== "all") filter.location_id = location_id;
    if (location_type) filter.location_type = location_type;

    const items = await Inventory.find(filter)
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
      .populate("batch_ids", "batch_id manufacturer quantity expiry_date quality_status")
      .sort({ location_id: 1 });

    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/inventory/low-stock
 * Returns inventory items where available_stock < drug.min_safety_stock.
 * Uses aggregation to join Drug collection.
 */
export const getLowStockItems = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const results = await Inventory.aggregate([
      {
        $lookup: {
          from: "drugs",
          localField: "drug_id",
          foreignField: "_id",
          as: "drug",
        },
      },
      { $unwind: "$drug" },
      {
        $match: {
          $expr: { $lt: ["$available_stock", "$drug.min_safety_stock"] },
        },
      },
      {
        $project: {
          location_id: 1,
          location_type: 1,
          available_stock: 1,
          reserved_stock: 1,
          incoming_stock: 1,
          "drug.drug_id": 1,
          "drug.name": 1,
          "drug.is_critical": 1,
          "drug.min_safety_stock": 1,
          shortage: {
            $subtract: ["$drug.min_safety_stock", "$available_stock"],
          },
        },
      },
      { $sort: { "drug.is_critical": -1, shortage: -1 } },
    ]);

    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/inventory/:id */
export const getInventoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const item = await Inventory.findById(req.params.id)
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
      .populate("batch_ids");
    if (!item) throw new AppError("Inventory record not found", 404);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/inventory
 * Upserts: if a record for (location_id, drug_id) already exists, updates it.
 * Body: { location_id, location_type, drug_id (human-readable code OR MongoDB _id),
 *         available_stock, reserved_stock?, incoming_stock? }
 * Roles: admin, warehouse_manager
 */
export const upsertInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      location_id,
      location_type,
      drug_id,
      available_stock,
      reserved_stock,
      incoming_stock,
    } = req.body;

    if (!location_id || !location_type || !drug_id || available_stock === undefined)
      throw new AppError(
        "location_id, location_type, drug_id and available_stock are required",
        400
      );

    // drug_id from the frontend may be the human-readable code (e.g. "DRUG-002")
    // or the Mongo _id — accept either, same pattern as drug.controller.ts.
    const drug = await Drug.findOne({
      $or: [{ drug_id }, { _id: /^[a-f\d]{24}$/i.test(drug_id) ? drug_id : null }],
    });
    if (!drug) throw new AppError("Drug not found", 404);

    const item = await Inventory.findOneAndUpdate(
      { location_id, drug_id: drug._id },
      {
        $set: {
          location_type,
          available_stock,
          ...(reserved_stock  !== undefined && { reserved_stock }),
          ...(incoming_stock  !== undefined && { incoming_stock }),
          last_updated: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true }
    ).populate("drug_id", "drug_id name category unit");

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/inventory/:id
 * Adjusts stock numbers on an existing record.
 * Roles: admin, warehouse_manager
 */
export const updateInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const allowed = ["available_stock", "reserved_stock", "incoming_stock"];
    const updates: Record<string, unknown> = {};
    for (const f of allowed) if (req.body[f] !== undefined) updates[f] = req.body[f];
    updates.last_updated = new Date();

    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate("drug_id", "drug_id name category unit");

    if (!item) throw new AppError("Inventory record not found", 404);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};