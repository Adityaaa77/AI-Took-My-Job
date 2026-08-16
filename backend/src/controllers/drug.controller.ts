import { Request, Response, NextFunction } from "express";
import { Drug } from "../models/Drug.model.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * GET /api/v1/drugs
 * Query params: category, is_critical, search (text search on name/category)
 */
export const getAllDrugs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category, is_critical, search } = req.query;

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (is_critical !== undefined) filter.is_critical = is_critical === "true";
    if (search) filter.$text = { $search: search as string };

    const drugs = await Drug.find(filter).sort({ createdAt: -1 });

    res.json({ success: true, count: drugs.length, data: drugs });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/drugs/:id
 * Accepts human-readable drug_id (DRUG-001) or MongoDB _id
 */
export const getDrugById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const drug = await Drug.findOne({
      $or: [{ drug_id: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }],
    });

    if (!drug) throw new AppError("Drug not found", 404);

    res.json({ success: true, data: drug });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/drugs
 * Body: { name, category, unit, is_critical?, min_safety_stock?, description? }
 * Roles: admin, warehouse_manager
 */
export const createDrug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, category, unit, is_critical, min_safety_stock, description } =
      req.body;

    if (!name || !category || !unit) {
      throw new AppError("name, category and unit are required", 400);
    }

    const drug = await Drug.create({
      name,
      category,
      unit,
      is_critical,
      min_safety_stock,
      description,
    });

    res.status(201).json({ success: true, data: drug });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/drugs/:id
 * Partial update — only provided fields are changed.
 * Roles: admin, warehouse_manager
 */
export const updateDrug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const allowedFields = [
      "name",
      "category",
      "unit",
      "is_critical",
      "min_safety_stock",
      "description",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const drug = await Drug.findOneAndUpdate(
      { $or: [{ drug_id: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }] },
      updates,
      { new: true, runValidators: true }
    );

    if (!drug) throw new AppError("Drug not found", 404);

    res.json({ success: true, data: drug });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/drugs/:id
 * Roles: admin only
 */
export const deleteDrug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const drug = await Drug.findOneAndDelete({
      $or: [{ drug_id: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }],
    });

    if (!drug) throw new AppError("Drug not found", 404);

    res.json({ success: true, message: "Drug deleted successfully" });
  } catch (err) {
    next(err);
  }
};
