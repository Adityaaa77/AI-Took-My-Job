import { Response, NextFunction } from "express";
import { ReplenishmentRequest, ReplenishmentStatus } from "../models/ReplenishmentRequest.model.js";
import { Drug } from "../models/Drug.model.js";
import { Hospital } from "../models/Hospital.model.js";
import { Shipment } from "../models/Shipment.model.js";
import { Inventory } from "../models/Inventory.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthenticatedRequest } from "../types/index.js";
import { logAuditEvent } from "../utils/auditLogger.js";

/**
 * GET /api/v1/replenishments
 * Query: hospital_id, status
 */
export const getAllRequests = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { hospital_id, status } = req.query;
    const filter: Record<string, unknown> = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (hospital_id && hospital_id !== "all") {
      filter.hospital_id = { $regex: String(hospital_id), $options: "i" };
    }

    // If logged in user is hospital_staff with assigned facility, restrict list to their hospital
    if (req.user?.role === "hospital_staff" && req.user?.associated_entity_id) {
      const cleanUserHospId = String(req.user.associated_entity_id).split(" ")[0].trim();
      filter.hospital_id = { $regex: cleanUserHospId, $options: "i" };
    }

    const requests = await ReplenishmentRequest.find(filter)
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
      .populate("requested_by", "name role")
      .populate("approved_by", "name role")
      .populate("shipment_id", "shipment_id status carrier_name tracking_number")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/replenishments/:id */
export const getRequestById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const request = await ReplenishmentRequest.findOne({
      $or: [
        { request_id: req.params.id },
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
      ],
    })
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
      .populate("requested_by", "name role")
      .populate("approved_by", "name role")
      .populate("shipment_id");

    if (!request) throw new AppError("Replenishment request not found", 404);
    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/replenishments
 * Body: { hospital_id, hospital_name?, drug_id, requested_quantity, urgency?, reason? }
 * Roles: admin, hospital_staff, procurement_officer
 */
export const createRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { hospital_id, hospital_name, drug_id, requested_quantity, urgency, reason } = req.body;

    if (!hospital_id || !drug_id || !requested_quantity || Number(requested_quantity) <= 0) {
      throw new AppError("hospital_id, drug_id, and positive requested_quantity are required", 400);
    }

    const cleanHospId = String(hospital_id).split(" ")[0].trim();

    // Verify hospital_staff role scope
    if (req.user?.role === "hospital_staff" && req.user?.associated_entity_id) {
      const userHospId = String(req.user.associated_entity_id).split(" ")[0].trim();
      if (cleanHospId.toLowerCase() !== userHospId.toLowerCase()) {
        throw new AppError(
          `Hospital staff assigned to '${userHospId}' cannot submit replenishment requests for facility '${cleanHospId}'`,
          403
        );
      }
    }

    // Resolve drug Mongo _id
    const drugDoc = await Drug.findOne({
      $or: [
        { drug_id: drug_id },
        { _id: /^[a-f\d]{24}$/i.test(drug_id) ? drug_id : null },
      ],
    });

    if (!drugDoc) {
      throw new AppError(`Drug '${drug_id}' not found in catalog`, 404);
    }

    // Resolve hospital_name if missing
    let resolvedHospName = hospital_name;
    if (!resolvedHospName) {
      const hospDoc = await Hospital.findOne({ hospital_id: cleanHospId });
      resolvedHospName = hospDoc ? hospDoc.name : cleanHospId;
    }

    const request = await ReplenishmentRequest.create({
      hospital_id: cleanHospId,
      hospital_name: resolvedHospName,
      drug_id: drugDoc._id,
      requested_quantity: Number(requested_quantity),
      urgency: urgency || "standard",
      reason,
      status: "pending",
      requested_by: req.user!.userId,
    });

    const populated = await ReplenishmentRequest.findById(request._id)
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
      .populate("requested_by", "name role");

    await logAuditEvent(req, "REPLENISHMENT_REQUESTED", "ReplenishmentRequest", request.request_id, {
      hospital_id: cleanHospId,
      drug_id: drugDoc.drug_id || drugDoc.name,
      requested_quantity: Number(requested_quantity),
      urgency: urgency || "standard",
    });

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/replenishments/:id/status
 * Body: { status, allocated_from?, approved_quantity? }
 * Workflow:
 * - pending → approved / rejected (procurement_officer, admin)
 * - approved → allocated (warehouse_manager, procurement_officer, admin)
 * - allocated → dispatched (warehouse_manager, admin) -> Creates linked Shipment & incoming_stock
 * - dispatched → received (hospital_staff, warehouse_manager, admin) -> Converts incoming → available_stock
 */
export const updateRequestStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validStatuses: ReplenishmentStatus[] = [
      "pending",
      "approved",
      "allocated",
      "dispatched",
      "received",
      "rejected",
    ];

    const { status, allocated_from, approved_quantity } = req.body;

    if (!status || !validStatuses.includes(status as ReplenishmentStatus)) {
      throw new AppError(`status must be one of: ${validStatuses.join(", ")}`, 400);
    }

    const existingReq = await ReplenishmentRequest.findOne({
      $or: [
        { request_id: req.params.id },
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
      ],
    });

    if (!existingReq) throw new AppError("Replenishment request not found", 404);

    const userRole = req.user?.role;

    // RBAC validation per target status transition
    if (status === "approved" || status === "rejected") {
      if (userRole !== "admin" && userRole !== "procurement_officer" && userRole !== "warehouse_manager") {
        throw new AppError("Only Procurement Officers, Warehouse Managers, or Admins can approve/reject replenishment requests", 403);
      }
    } else if (status === "allocated") {
      if (userRole !== "admin" && userRole !== "warehouse_manager" && userRole !== "procurement_officer") {
        throw new AppError("Only Warehouse Managers, Procurement Officers, or Admins can allocate stock for replenishment requests", 403);
      }
    } else if (status === "dispatched") {
      if (userRole !== "admin" && userRole !== "warehouse_manager" && userRole !== "procurement_officer") {
        throw new AppError("Only Warehouse Managers, Procurement Officers, or Admins can dispatch allocated replenishment requests", 403);
      }
    } else if (status === "received") {
      if (userRole !== "admin" && userRole !== "hospital_staff" && userRole !== "warehouse_manager" && userRole !== "procurement_officer") {
        throw new AppError("Only Hospital Staff, Procurement Officers, or Admins can confirm receipt of replenishment requests", 403);
      }
    }

    const updates: Record<string, unknown> = { status };
    if (allocated_from) updates.allocated_from = allocated_from;
    if (approved_quantity) updates.approved_quantity = Number(approved_quantity);

    if (status === "approved") {
      updates.approved_by = req.user!.userId;
      if (!updates.approved_quantity) updates.approved_quantity = existingReq.requested_quantity;
    } else if (status === "allocated") {
      updates.allocated_by = req.user!.userId;
      if (!updates.allocated_from) updates.allocated_from = existingReq.allocated_from || "WH-001 (CMSS North Hub)";
    } else if (status === "dispatched") {
      updates.dispatched_by = req.user!.userId;

      // AUTOMATIC SHIPMENT CREATION CONNECTION:
      // If a shipment has not been created for this replenishment request yet, create one now!
      if (!existingReq.shipment_id) {
        const originId = String(allocated_from || existingReq.allocated_from || "WH-001 (CMSS North Hub)").split(" ")[0].trim();
        const destId = existingReq.hospital_id.split(" ")[0].trim();
        const shipQty = Number(approved_quantity || existingReq.approved_quantity || existingReq.requested_quantity);

        const newShipment = await Shipment.create({
          origin_id: originId,
          origin_type: "warehouse",
          destination_id: destId,
          destination_type: "hospital",
          drug_id: existingReq.drug_id,
          quantity: shipQty,
          status: "dispatched",
          estimated_arrival: new Date(Date.now() + 2 * 86400000),
          carrier_name: "Central Medical Reefer Express",
          tracking_number: `TRK-REQ-${Math.floor(100000 + Math.random() * 900000)}`,
          tracking_note: `Replenishment order ${existingReq.request_id} dispatched from ${originId}.`,
        });

        updates.shipment_id = newShipment._id;

        // Reflect incoming_stock at destination hospital inventory
        await Inventory.findOneAndUpdate(
          { location_id: destId, drug_id: existingReq.drug_id },
          {
            $inc: { incoming_stock: shipQty },
            $setOnInsert: {
              location_type: "hospital",
              available_stock: 0,
              reserved_stock: 0,
              batch_ids: [],
            },
          },
          { upsert: true, new: true }
        );
      }
    } else if (status === "received") {
      // Connect to Shipment terminal receipt & inventory conversion
      if (existingReq.shipment_id) {
        const shipDoc = await Shipment.findById(existingReq.shipment_id);
        if (shipDoc && shipDoc.status !== "received" && shipDoc.status !== "delivered") {
          shipDoc.status = "received";
          shipDoc.actual_arrival = new Date();
          await shipDoc.save();

          const destId = existingReq.hospital_id.split(" ")[0].trim();
          const recQty = shipDoc.quantity;

          const invItem = await Inventory.findOne({ location_id: destId, drug_id: existingReq.drug_id });
          const currentIncoming = invItem ? invItem.incoming_stock : 0;
          const decIncoming = Math.min(currentIncoming, recQty);

          await Inventory.findOneAndUpdate(
            { location_id: destId, drug_id: existingReq.drug_id },
            {
              $inc: {
                available_stock: recQty,
                incoming_stock: -decIncoming,
              },
              $setOnInsert: {
                location_type: "hospital",
                reserved_stock: 0,
                batch_ids: [],
              },
            },
            { upsert: true, new: true }
          );
        }
      }
    }

    const updated = await ReplenishmentRequest.findByIdAndUpdate(
      existingReq._id,
      { $set: updates },
      { new: true }
    )
      .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
      .populate("requested_by", "name role")
      .populate("approved_by", "name role")
      .populate("shipment_id");

    await logAuditEvent(
      req,
      `REPLENISHMENT_${status.toUpperCase()}`,
      "ReplenishmentRequest",
      existingReq.request_id,
      {
        previous_status: existingReq.status,
        new_status: status,
        allocated_from: updated?.allocated_from,
        hospital_id: existingReq.hospital_id,
      }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};
