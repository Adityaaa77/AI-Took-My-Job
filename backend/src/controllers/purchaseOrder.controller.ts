import { Response, NextFunction } from "express";
import { PurchaseOrder } from "../models/PurchaseOrder.model.js";
import { Vendor } from "../models/Vendor.model.js";
import { Drug } from "../models/Drug.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthenticatedRequest } from "../types/index.js";

/**
 * GET /api/v1/purchase-orders
 * Query: status, vendor_id (human-readable), drug_id (human-readable)
 */
export const getAllOrders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, destination_location_id } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (destination_location_id) filter.destination_location_id = destination_location_id;

    const orders = await PurchaseOrder.find(filter)
      .populate("vendor_id", "vendor_id name avg_lead_time_days reliability_score")
      .populate("drug_id", "drug_id name unit")
      .populate("created_by", "name email role")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/purchase-orders/:id */
export const getOrderById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = await PurchaseOrder.findOne({
      $or: [
        { order_id: req.params.id },
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
      ],
    })
      .populate("vendor_id", "vendor_id name avg_lead_time_days")
      .populate("drug_id", "drug_id name unit")
      .populate("created_by", "name email");

    if (!order) throw new AppError("Purchase order not found", 404);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/purchase-orders
 * Body: { vendor_id(_id), drug_id(_id), quantity, destination_location_id,
 *         destination_location_type, expected_delivery, notes? }
 * Roles: admin, warehouse_manager
 */
export const createOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      vendor_id,
      drug_id,
      quantity,
      destination_location_id,
      destination_location_type,
      expected_delivery,
      notes,
    } = req.body;

    if (!vendor_id || !drug_id || !quantity || !destination_location_id || !destination_location_type || !expected_delivery)
      throw new AppError("vendor_id, drug_id, quantity, destination_location_id, destination_location_type and expected_delivery are required", 400);

    const [vendor, drug] = await Promise.all([
      Vendor.findOne({ $or: [{ vendor_id: vendor_id }, { _id: vendor_id.match(/^[a-f\d]{24}$/i) ? vendor_id : null }] }),
      Drug.findOne({ $or: [{ drug_id: drug_id }, { _id: drug_id.match(/^[a-f\d]{24}$/i) ? drug_id : null }] }),
    ]);
    
    // Fallback lookup if database has not seeded vendor/drug yet
    const finalVendorId = vendor ? vendor._id : (await Vendor.findOne({}))?._id;
    const finalDrugId = drug ? drug._id : (await Drug.findOne({}))?._id;

    if (!finalVendorId || !finalDrugId) {
      throw new AppError("Valid Vendor and Drug must be present in system", 400);
    }

    const uPrice = req.body.unit_price || 150;

    const order = await PurchaseOrder.create({
      vendor_id: finalVendorId,
      drug_id: finalDrugId,
      quantity,
      unit_price: uPrice,
      total_amount: quantity * uPrice,
      destination_location_id,
      destination_location_type: destination_location_type || "warehouse",
      expected_delivery: expected_delivery ? new Date(expected_delivery) : new Date(Date.now() + 5 * 86400000),
      created_by: req.user?.userId,
      notes,
    });

    const populatedOrder = await PurchaseOrder.findById(order._id)
      .populate("vendor_id", "vendor_id name avg_lead_time_days reliability_score")
      .populate("drug_id", "drug_id name unit");

    if (finalVendorId) {
      await Vendor.findByIdAndUpdate(finalVendorId, { $inc: { active_orders_count: 1 } });
    }

    res.status(201).json({ success: true, data: populatedOrder });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/purchase-orders/:id/status
 * Body: { status }
 * Roles: admin, warehouse_manager
 */
export const updateOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validStatuses = ["pending", "approved", "shipped", "delivered", "cancelled"];
    const { status } = req.body;

    if (!validStatuses.includes(status))
      throw new AppError(`status must be one of: ${validStatuses.join(", ")}`, 400);

    const order = await PurchaseOrder.findOneAndUpdate(
      { $or: [{ order_id: req.params.id }, { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null }] },
      {
        $set: {
          status,
          ...(status === "delivered" && { actual_delivery: new Date() }),
        },
      },
      { new: true }
    );

    if (!order) throw new AppError("Purchase order not found", 404);

    // Decrement vendor active order count when terminal state reached
    if (status === "delivered" || status === "cancelled") {
      await Vendor.findByIdAndUpdate(order.vendor_id, {
        $inc: { active_orders_count: -1 },
      });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};
