import { Request, Response, NextFunction } from "express";
import { Warehouse } from "../models/Warehouse.model.js";
import { AppError } from "../middleware/errorHandler.js";

/** GET /api/v1/warehouses?location_zone=Zone-North */
export const getAllWarehouses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.location_zone) filter.location_zone = req.query.location_zone;

    const warehouses = await Warehouse.find(filter).sort({ name: 1 });
    res.json({ success: true, count: warehouses.length, data: warehouses });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/warehouses/:id  (warehouse_id or _id) */
export const getWarehouseById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const warehouse = await Warehouse.findOne({
      $or: [
        { warehouse_id: id },
        { _id: id.match(/^[a-f\d]{24}$/i) ? id : null },
      ],
    });
    if (!warehouse) throw new AppError("Warehouse not found", 404);
    res.json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/warehouses — admin only */
export const createWarehouse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, location_zone, capacity, address, manager_user_id } = req.body;

    if (!name || !location_zone || capacity === undefined)
      throw new AppError("name, location_zone and capacity are required", 400);

    const warehouse = await Warehouse.create({
      name,
      location_zone,
      capacity,
      address,
      manager_user_id,
    });
    res.status(201).json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/warehouses/:id — admin, warehouse_manager */
export const updateWarehouse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const allowed = ["name", "location_zone", "capacity", "address", "manager_user_id"];
    const updates: Record<string, unknown> = {};
    for (const f of allowed) if (req.body[f] !== undefined) updates[f] = req.body[f];

    const warehouse = await Warehouse.findOneAndUpdate(
      { $or: [{ warehouse_id: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }] },
      updates,
      { new: true, runValidators: true }
    );
    if (!warehouse) throw new AppError("Warehouse not found", 404);
    res.json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/warehouses/:id — admin only */
export const deleteWarehouse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const warehouse = await Warehouse.findOneAndDelete({
      $or: [{ warehouse_id: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }],
    });
    if (!warehouse) throw new AppError("Warehouse not found", 404);
    res.json({ success: true, message: "Warehouse deleted successfully" });
  } catch (err) {
    next(err);
  }
};
