import { Response, NextFunction } from "express";
import { Alert, AlertType, AlertSeverity } from "../models/Alert.model.js";
import { Inventory } from "../models/Inventory.model.js";
import { Batch } from "../models/Batch.model.js";
import { Shipment } from "../models/Shipment.model.js";
import { ConsumptionRecord } from "../models/ConsumptionRecord.model.js";
import { ReplenishmentRequest } from "../models/ReplenishmentRequest.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthenticatedRequest } from "../types/index.js";

/**
 * Deterministic Operational Alert Rule Engine
 * Evaluates live database states for low stock, expiry, shipment delays,
 * unusual consumption, pending approvals, and quality issues.
 * Includes idempotent duplicate prevention for active unresolved alerts.
 */
export const evaluateAlertRules = async (): Promise<void> => {
  try {
    const now = new Date();

    // 1. Low Stock & Critical Stockout Rules
    const inventoryItems = await Inventory.find().populate("drug_id", "drug_id name min_safety_stock");
    for (const item of inventoryItems) {
      const drugObj = item.drug_id as unknown as { _id: string; drug_id: string; name: string; min_safety_stock?: number } | null;
      if (!drugObj) continue;

      const minBuffer = drugObj.min_safety_stock || 500;
      const drugName = drugObj.name || drugObj.drug_id;

      if (item.available_stock === 0) {
        // Auto-resolve outdated low_stock alerts for this location & drug
        await Alert.updateMany(
          {
            location_id: item.location_id,
            drug_id: drugObj._id,
            alert_type: "low_stock",
            is_resolved: false,
          },
          { $set: { is_resolved: true, resolution_notes: "Superseded by critical stockout alert." } }
        );

        const msg = `CRITICAL STOCKOUT: ${drugName} at facility '${item.location_id}' has ZERO available units!`;
        await createAlertIfMissing("critical_stock", "critical", drugObj._id, item.location_id, msg);
      } else if (item.available_stock < minBuffer) {
        // Auto-resolve outdated critical_stockout alerts if stock replenished > 0
        await Alert.updateMany(
          {
            location_id: item.location_id,
            drug_id: drugObj._id,
            alert_type: { $in: ["critical_stock", "stockout"] },
            is_resolved: false,
          },
          { $set: { is_resolved: true, resolution_notes: "Stock replenished above zero." } }
        );

        const msg = `Low Stock Warning: ${drugName} at facility '${item.location_id}' has ${item.available_stock} units (Below safety threshold of ${minBuffer} units).`;
        
        const existingLowStock = await Alert.findOne({
          location_id: item.location_id,
          drug_id: drugObj._id,
          alert_type: "low_stock",
          is_resolved: false,
        });

        if (existingLowStock) {
          if (existingLowStock.message !== msg) {
            existingLowStock.message = msg;
            await existingLowStock.save();
          }
        } else {
          await Alert.create({
            alert_type: "low_stock",
            severity: "high",
            drug_id: drugObj._id,
            location_id: item.location_id,
            message: msg,
            is_resolved: false,
          });
        }
      } else {
        // Stock is healthy (available_stock >= minBuffer): Auto-resolve any active stock warnings
        await Alert.updateMany(
          {
            location_id: item.location_id,
            drug_id: drugObj._id,
            alert_type: { $in: ["low_stock", "critical_stock", "stockout"] },
            is_resolved: false,
          },
          { $set: { is_resolved: true, resolution_notes: `Stock restored to healthy buffer level (${item.available_stock} units).` } }
        );
      }
    }

    // 2. Expiring & Expired Batch Rules
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
    const batches = await Batch.find().populate("drug_id", "drug_id name");
    for (const batch of batches) {
      const drugObj = batch.drug_id as unknown as { _id: string; drug_id: string; name: string } | null;
      const drugName = drugObj ? drugObj.name : "Drug Batch";
      const drugId = drugObj ? drugObj._id : undefined;

      if (batch.expiry_date) {
        const expDate = new Date(batch.expiry_date);
        if (expDate < now) {
          const msg = `EXPIRED DRUG ALERT: Batch '${batch.batch_number}' (${drugName}) expired on ${expDate.toLocaleDateString()}!`;
          await createAlertIfMissing("expired_drug", "critical", drugId, batch.manufacturer_id || "HUB-001", msg);
        } else if (expDate <= thirtyDaysFromNow) {
          const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / 86400000);
          const msg = `Expiring Drug Warning: Batch '${batch.batch_number}' (${drugName}) expires in ${daysLeft} days (${expDate.toLocaleDateString()}).`;
          await createAlertIfMissing("expiry_warning", "high", drugId, batch.manufacturer_id || "HUB-001", msg);
        }
      }

      // Quality Control Rule
      const isFailed = (batch as any).qc_status === "failed" || (batch as any).is_recalled === true;
      if (isFailed) {
        const msg = `QUALITY ALERT: Batch '${batch.batch_number}' (${drugName}) failed quality control inspection!`;
        await createAlertIfMissing("quality_issue", "critical", drugId, batch.manufacturer_id || "HUB-001", msg);
      }
    }

    // 3. Shipment Delay Rules
    const delayedShipments = await Shipment.find({
      status: { $in: ["dispatched", "in_transit", "preparing"] },
      estimated_arrival: { $lt: now },
    }).populate("drug_id", "drug_id name");

    for (const ship of delayedShipments) {
      const drugObj = ship.drug_id as unknown as { _id: string; drug_id: string; name: string } | null;
      const drugName = drugObj ? drugObj.name : "Shipment Formula";
      const drugId = drugObj ? drugObj._id : undefined;
      const estDate = ship.estimated_arrival ? new Date(ship.estimated_arrival).toLocaleDateString() : "past due";

      const msg = `Shipment Delay Alert: Shipment '${ship.shipment_id}' (${drugName}) to '${ship.destination_id}' missed estimated arrival date (${estDate}).`;
      await createAlertIfMissing("vendor_delay", "high", drugId, ship.destination_id, msg);
    }

    // 4. Unusual Consumption Anomaly Rules
    const consumptionLogs = await ConsumptionRecord.find().populate("drug_id", "drug_id name").sort({ createdAt: -1 }).limit(20);
    for (const c of consumptionLogs) {
      const drugObj = c.drug_id as unknown as { _id: string; drug_id: string; name: string } | null;
      const drugName = drugObj ? drugObj.name : "Drug";
      const drugId = drugObj ? drugObj._id : undefined;
      const dailyAvg = c.daily_avg_consumption || 20;

      if (c.is_anomaly || c.quantity_consumed > 2 * dailyAvg) {
        const msg = `Unusual Consumption Alert: Dispensary surge of ${c.quantity_consumed} units logged at '${c.hospital_id}' for '${drugName}' (Baseline: ${dailyAvg} units/day).`;
        await createAlertIfMissing("unusual_consumption", "high", drugId, c.hospital_id, msg);
      }
    }

    // 5. Pending Replenishment Approval Rules
    const pendingReqs = await ReplenishmentRequest.find({ status: "pending" }).populate("drug_id", "drug_id name");
    for (const reqItem of pendingReqs) {
      const drugObj = reqItem.drug_id as unknown as { _id: string; drug_id: string; name: string } | null;
      const drugName = drugObj ? drugObj.name : "Formulation";
      const drugId = drugObj ? drugObj._id : undefined;

      const msg = `Pending Approval Alert: Requisition '${reqItem.request_id}' for ${reqItem.requested_quantity} units of '${drugName}' at '${reqItem.hospital_id}' is awaiting procurement approval.`;
      await createAlertIfMissing("pending_approval", "medium", drugId, reqItem.hospital_id, msg);
    }
  } catch (err) {
    console.error("Error evaluating alert rules:", err);
  }
};

/** Duplicate prevention helper */
const createAlertIfMissing = async (
  alert_type: AlertType,
  severity: AlertSeverity,
  drug_id: any,
  location_id: string,
  message: string
): Promise<void> => {
  const existing = await Alert.findOne({
    location_id,
    alert_type,
    message,
    is_resolved: false,
  });

  if (!existing) {
    await Alert.create({
      alert_type,
      severity,
      drug_id: drug_id || null,
      location_id,
      message,
      is_resolved: false,
    });
  }
};

/** GET /api/v1/alerts */
export const getAllAlerts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Run rule evaluation automatically before returning list
    await evaluateAlertRules();

    const { is_resolved, severity, alert_type, location_id } = req.query;
    const filter: Record<string, unknown> = {};

    if (is_resolved !== undefined && is_resolved !== "all") {
      filter.is_resolved = is_resolved === "true";
    }
    if (severity && severity !== "all") {
      filter.severity = severity;
    }
    if (alert_type && alert_type !== "all") {
      filter.alert_type = alert_type;
    }
    if (location_id && location_id !== "all") {
      filter.location_id = { $regex: String(location_id), $options: "i" };
    }

    // Role-based filtering scope: hospital_staff restricted to their hospital alerts
    if (req.user?.role === "hospital_staff" && req.user?.associated_entity_id) {
      const cleanHospId = String(req.user.associated_entity_id).split(" ")[0].trim();
      filter.location_id = { $regex: cleanHospId, $options: "i" };
    }

    const alerts = await Alert.find(filter)
      .populate("drug_id", "drug_id name category min_safety_stock")
      .populate("resolved_by", "name role")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/alerts/:id */
export const getAlertById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate("drug_id", "drug_id name category")
      .populate("resolved_by", "name role");

    if (!alert) throw new AppError("Alert incident record not found", 404);
    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/alerts */
export const createAlert = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { alert_type, severity, drug_id, location_id, message } = req.body;
    if (!alert_type || !severity || !message) {
      throw new AppError("alert_type, severity, and message are required", 400);
    }

    const alert = await Alert.create({
      alert_type,
      severity,
      drug_id: drug_id || null,
      location_id: location_id || "SYS-001",
      message,
    });

    const populated = await Alert.findById(alert._id).populate("drug_id", "drug_id name");
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/alerts/:id/resolve */
export const resolveAlert = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { resolution_notes } = req.body;

    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          is_resolved: true,
          resolved_by: req.user!.userId,
          resolved_at: new Date(),
          ...(resolution_notes && { resolution_notes }),
        },
      },
      { new: true }
    )
      .populate("drug_id", "drug_id name")
      .populate("resolved_by", "name role");

    if (!alert) throw new AppError("Alert incident record not found", 404);
    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/alerts/:id */
export const deleteAlert = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.role !== "admin") {
      throw new AppError("Only System Administrators can delete alert records", 403);
    }
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) throw new AppError("Alert record not found", 404);
    res.json({ success: true, message: "Alert incident record permanently deleted" });
  } catch (err) {
    next(err);
  }
};
