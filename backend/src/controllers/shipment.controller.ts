import { Request, Response, NextFunction } from "express";
import { Shipment } from "../models/Shipment.model.js";
import { Inventory } from "../models/Inventory.model.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * GET /api/v1/shipments
 * Query: status, destination_id, origin_id
 */
export const getAllShipments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, destination_id, origin_id } = req.query;
    const filter: Record<string, unknown> = {};
    if (status)         filter.status         = status;
    if (destination_id) filter.destination_id = destination_id;
    if (origin_id)      filter.origin_id      = origin_id;

    const shipments = await Shipment.find(filter)
      .populate("order_id", "order_id status")
      .populate("drug_id", "drug_id name unit")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: shipments.length, data: shipments });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/shipments/:id */
export const getShipmentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const shipment = await Shipment.findOne({
      $or: [
        { shipment_id: id },
        { _id: id.match(/^[a-f\d]{24}$/i) ? id : null },
      ],
    })
      .populate("order_id", "order_id quantity status")
      .populate("drug_id", "drug_id name unit");

    if (!shipment) throw new AppError("Shipment not found", 404);
    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/shipments
 * Body: { order_id(_id), origin_id, origin_type, destination_id,
 *         destination_type, drug_id(_id), quantity, estimated_arrival }
 * Roles: admin, warehouse_manager
 */
export const createShipment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      order_id, origin_id, origin_type,
      destination_id, destination_type,
      drug_id, quantity, estimated_arrival, tracking_note,
    } = req.body;

    if (!order_id || !origin_id || !origin_type || !destination_id || !destination_type || !drug_id || !quantity || !estimated_arrival)
      throw new AppError("All shipment fields are required", 400);

    const shipment = await Shipment.create({
      order_id, origin_id, origin_type,
      destination_id, destination_type,
      drug_id, quantity,
      estimated_arrival: new Date(estimated_arrival),
      tracking_note,
    });

    // Reflect incoming stock in destination inventory
    await Inventory.findOneAndUpdate(
      { location_id: destination_id, drug_id },
      { $inc: { incoming_stock: quantity } },
      { upsert: false }  // only update if inventory record already exists
    );

    res.status(201).json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/shipments/:id/status
 * Body: { status, tracking_note? }
 * When "delivered": moves incoming_stock → available_stock in inventory.
 * Roles: admin, warehouse_manager
 */
export const updateShipmentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validStatuses = ["preparing", "in_transit", "delayed", "delivered"];
    const { status, tracking_note } = req.body;

    if (!validStatuses.includes(status))
      throw new AppError(`status must be one of: ${validStatuses.join(", ")}`, 400);

    const shipment = await Shipment.findOneAndUpdate(
      { $or: [{ shipment_id: req.params.id }, { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null }] },
      {
        $set: {
          status,
          ...(tracking_note && { tracking_note }),
          ...(status === "delivered" && { actual_arrival: new Date() }),
        },
      },
      { new: true }
    );

    if (!shipment) throw new AppError("Shipment not found", 404);

    // On delivery: convert incoming_stock to available_stock
    if (status === "delivered") {
      await Inventory.findOneAndUpdate(
        { location_id: shipment.destination_id, drug_id: shipment.drug_id },
        {
          $inc: {
            available_stock: shipment.quantity,
            incoming_stock:  -shipment.quantity,
          },
        }
      );
    }

    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
};
