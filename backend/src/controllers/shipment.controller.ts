import { Response, NextFunction } from "express";
import { Shipment, ShipmentStatus } from "../models/Shipment.model.js";
import { Inventory } from "../models/Inventory.model.js";
import { Drug } from "../models/Drug.model.js";
import { PurchaseOrder } from "../models/PurchaseOrder.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthenticatedRequest } from "../types/index.js";
import { logAuditEvent } from "../utils/auditLogger.js";

/**
 * GET /api/v1/shipments
 * Query: status, destination_id, origin_id
 * Protected route
 */
export const getAllShipments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, destination_id, origin_id } = req.query;
    const filter: Record<string, unknown> = {};
    if (status && status !== "all") filter.status = status;
    if (destination_id) filter.destination_id = { $regex: String(destination_id), $options: "i" };
    if (origin_id) filter.origin_id = { $regex: String(origin_id), $options: "i" };

    const shipments = await Shipment.find(filter)
      .populate("order_id", "order_id status vendor_id")
      .populate("drug_id", "drug_id name unit min_safety_stock")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: shipments.length, data: shipments });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/shipments/:id */
export const getShipmentById = async (
  req: AuthenticatedRequest,
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
 * Body: { order_id?, origin_id, origin_type, destination_id,
 *         destination_type, drug_id, quantity, estimated_arrival, carrier_name?, tracking_note? }
 * Roles: admin, warehouse_manager, vendor
 */
export const createShipment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      order_id, origin_id, origin_type,
      destination_id, destination_type,
      drug_id, quantity, estimated_arrival, tracking_note, carrier_name, tracking_number
    } = req.body;

    if (!origin_id || !origin_type || !destination_id || !destination_type || !drug_id || !quantity) {
      throw new AppError("origin_id, origin_type, destination_id, destination_type, drug_id, and quantity are required", 400);
    }

    // Resolve drug ObjectId if human-readable drug_id code passed
    let resolvedDrugId = drug_id;
    const drugDoc = await Drug.findOne({
      $or: [
        { drug_id: drug_id },
        { _id: drug_id.match(/^[a-f\d]{24}$/i) ? drug_id : null },
      ],
    });
    if (drugDoc) {
      resolvedDrugId = drugDoc._id;
    } else {
      throw new AppError(`Drug '${drug_id}' not found in system catalog`, 404);
    }

    // Resolve order ObjectId if passed
    let resolvedOrderId = null;
    if (order_id) {
      const orderDoc = await PurchaseOrder.findOne({
        $or: [
          { order_id: order_id },
          { _id: order_id.match(/^[a-f\d]{24}$/i) ? order_id : null },
        ],
      });
      if (orderDoc) {
        resolvedOrderId = orderDoc._id;
      }
    }

    const estArrivalDate = estimated_arrival ? new Date(estimated_arrival) : new Date(Date.now() + 2 * 86400000);
    const trackingNum = tracking_number || `TRK-${Math.floor(1000000 + Math.random() * 9000000)}`;

    const shipment = await Shipment.create({
      ...(resolvedOrderId && { order_id: resolvedOrderId }),
      origin_id,
      origin_type: origin_type || "warehouse",
      destination_id,
      destination_type: destination_type || "hospital",
      drug_id: resolvedDrugId,
      quantity: Number(quantity),
      status: "preparing",
      estimated_arrival: estArrivalDate,
      carrier_name: carrier_name || "Express Logistics Service",
      tracking_number: trackingNum,
      tracking_note: tracking_note || "Shipment created and registered for dispatch.",
      temperature_log: [4.2, 4.3, 4.1],
      milestones: [
        {
          stage: "Shipment Created & Dock Assigned",
          location: origin_id,
          timestamp: new Date(),
          status: "completed",
        },
        {
          stage: "Carrier Picked Up / Dispatched",
          location: origin_id,
          timestamp: new Date(),
          status: "current",
        },
        {
          stage: "Destination Receiving & Verification",
          location: destination_id,
          timestamp: estArrivalDate,
          status: "pending",
        },
      ],
    });

    // Populate resolved drug info before returning
    const populatedShipment = await Shipment.findById(shipment._id)
      .populate("drug_id", "drug_id name unit")
      .populate("order_id", "order_id status");

    // Reflect incoming stock in destination inventory with clean location code (e.g. "HOSP-001")
    const cleanDestId = String(destination_id || "").split(" ")[0].trim();
    const cleanLocType = (String(destination_type || "hospital").toLowerCase() as "hospital" | "warehouse");

    await Inventory.findOneAndUpdate(
      { location_id: cleanDestId, drug_id: resolvedDrugId },
      {
        $inc: { incoming_stock: Number(quantity) },
        $setOnInsert: {
          location_type: cleanLocType,
          available_stock: 0,
          reserved_stock: 0,
          batch_ids: [],
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await logAuditEvent(req, "SHIPMENT_CREATED", "Shipment", shipment.shipment_id, {
      origin: shipment.origin_id,
      destination: shipment.destination_id,
      quantity: shipment.quantity,
      status: shipment.status,
    });

    res.status(201).json({ success: true, data: populatedShipment });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/shipments/:id/status
 * Body: { status, tracking_note? }
 * When "delivered" or "received": moves incoming_stock → available_stock in inventory.
 * Roles: admin, warehouse_manager, vendor
 */
export const updateShipmentStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validStatuses: ShipmentStatus[] = [
      "preparing",
      "dispatched",
      "in_transit",
      "delayed",
      "delivered",
      "received",
    ];
    const { status, tracking_note } = req.body;

    if (!status || !validStatuses.includes(status as ShipmentStatus)) {
      throw new AppError(
        `status must be one of: ${validStatuses.join(", ")}`,
        400
      );
    }

    const existingShipment = await Shipment.findOne({
      $or: [
        { shipment_id: req.params.id },
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
      ],
    });

    if (!existingShipment) throw new AppError("Shipment not found", 404);

    const isTerminalState = status === "delivered" || status === "received";
    const wasAlreadyTerminal =
      existingShipment.status === "delivered" || existingShipment.status === "received";

    const updatedShipment = await Shipment.findOneAndUpdate(
      { _id: existingShipment._id },
      {
        $set: {
          status,
          ...(tracking_note && { tracking_note }),
          ...(isTerminalState && { actual_arrival: new Date() }),
        },
        $push: {
          milestones: {
            stage: `Status Updated to ${status.toUpperCase().replace("_", " ")}`,
            location: status === "delivered" || status === "received" ? existingShipment.destination_id : existingShipment.origin_id,
            timestamp: new Date(),
            status: isTerminalState ? "completed" : "current",
            ...(tracking_note && { note: tracking_note }),
          },
        },
      },
      { new: true }
    )
      .populate("drug_id", "drug_id name unit")
      .populate("order_id", "order_id status");

    // Extract clean location ID (e.g. "HOSP-001 (AIIMS New Delhi)" -> "HOSP-001")
    const cleanDestId = String(existingShipment.destination_id || "").split(" ")[0].trim();
    const cleanLocType = (String(existingShipment.destination_type || "hospital").toLowerCase() as "hospital" | "warehouse");

    // Check if an inventory record already exists for (cleanDestId, drug_id)
    const existingInv = await Inventory.findOne({
      location_id: cleanDestId,
      drug_id: existingShipment.drug_id,
    });

    const needsInitialDeliverySync = !existingInv || (existingInv.available_stock === 0 && existingShipment.quantity > 0);

    // On delivery/receipt: convert incoming_stock to available_stock (idempotent, only once unless initial sync needed)
    if (isTerminalState && (!wasAlreadyTerminal || needsInitialDeliverySync) && updatedShipment) {
      const currentIncoming = existingInv ? existingInv.incoming_stock : 0;
      const decIncoming = Math.min(currentIncoming, existingShipment.quantity);

      await Inventory.findOneAndUpdate(
        {
          location_id: cleanDestId,
          drug_id: existingShipment.drug_id,
        },
        {
          $inc: {
            available_stock: existingShipment.quantity,
            incoming_stock: -decIncoming,
          },
          $setOnInsert: {
            location_type: cleanLocType,
            reserved_stock: 0,
            batch_ids: [],
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    }

    await logAuditEvent(
      req,
      status === "received" ? "SHIPMENT_RECEIVED" : `SHIPMENT_${status.toUpperCase()}`,
      "Shipment",
      existingShipment.shipment_id,
      {
        previous_status: existingShipment.status,
        new_status: status,
        destination: existingShipment.destination_id,
        quantity: existingShipment.quantity,
      }
    );

    res.json({ success: true, data: updatedShipment });
  } catch (err) {
    next(err);
  }
};
