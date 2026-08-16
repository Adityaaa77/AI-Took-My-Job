import { Request, Response, NextFunction } from "express";
import { Vendor } from "../models/Vendor.model.js";
import { AppError } from "../middleware/errorHandler.js";

/** GET /api/v1/vendors?is_active=true */
export const getAllVendors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.is_active !== undefined)
      filter.is_active = req.query.is_active === "true";

    const vendors = await Vendor.find(filter).sort({ name: 1 });
    res.json({ success: true, count: vendors.length, data: vendors });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/vendors/:id  (vendor_id or _id) */
export const getVendorById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findOne({
      $or: [
        { vendor_id: id },
        { _id: id.match(/^[a-f\d]{24}$/i) ? id : null },
      ],
    });
    if (!vendor) throw new AppError("Vendor not found", 404);
    res.json({ success: true, data: vendor });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/vendors — admin only */
export const createVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      avg_lead_time_days,
      reliability_score,
      contact_email,
      contact_phone,
      address,
    } = req.body;

    if (!name || avg_lead_time_days === undefined || reliability_score === undefined)
      throw new AppError("name, avg_lead_time_days and reliability_score are required", 400);

    const vendor = await Vendor.create({
      name,
      avg_lead_time_days,
      reliability_score,
      contact_email,
      contact_phone,
      address,
    });
    res.status(201).json({ success: true, data: vendor });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/vendors/:id — admin only */
export const updateVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const allowed = [
      "name", "avg_lead_time_days", "reliability_score",
      "contact_email", "contact_phone", "address", "is_active",
    ];
    const updates: Record<string, unknown> = {};
    for (const f of allowed) if (req.body[f] !== undefined) updates[f] = req.body[f];

    const vendor = await Vendor.findOneAndUpdate(
      { $or: [{ vendor_id: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }] },
      updates,
      { new: true, runValidators: true }
    );
    if (!vendor) throw new AppError("Vendor not found", 404);
    res.json({ success: true, data: vendor });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/vendors/:id — admin only */
export const deleteVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findOneAndDelete({
      $or: [{ vendor_id: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }],
    });
    if (!vendor) throw new AppError("Vendor not found", 404);
    res.json({ success: true, message: "Vendor deleted successfully" });
  } catch (err) {
    next(err);
  }
};
