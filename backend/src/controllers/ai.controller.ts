import { Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { Drug } from "../models/Drug.model.js";
import { Hospital } from "../models/Hospital.model.js";
import { Inventory } from "../models/Inventory.model.js";
import { Batch } from "../models/Batch.model.js";
import { ConsumptionRecord } from "../models/ConsumptionRecord.model.js";
import { Vendor } from "../models/Vendor.model.js";
import { PurchaseOrder } from "../models/PurchaseOrder.model.js";
import { Shipment } from "../models/Shipment.model.js";
import { AIRecommendation } from "../models/AIRecommendation.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthenticatedRequest } from "../types/index.js";

// ─── Snapshot Builder ─────────────────────────────────────────────────────────
// Assembles SupplyChainSnapshotPayload (mirrors Python Pydantic schema exactly)

async function buildSnapshot() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all operational data in parallel
  const [drugs, hospitals, inventories, consumptionRecords, vendors, purchaseOrders, shipments] =
    await Promise.all([
      Drug.find().lean(),
      Hospital.find().lean(),
      Inventory.find()
        .populate("drug_id", "drug_id name category unit is_critical min_safety_stock")
        .populate("batch_ids")
        .lean(),
      ConsumptionRecord.find({ period_end: { $gte: thirtyDaysAgo } })
        .populate("drug_id", "drug_id")
        .lean(),
      Vendor.find({ is_active: true }).lean(),
      PurchaseOrder.find({ status: { $nin: ["delivered", "cancelled"] } })
        .populate("vendor_id", "vendor_id")
        .populate("drug_id", "drug_id")
        .lean(),
      Shipment.find({ status: { $nin: ["delivered"] } })
        .populate("order_id", "order_id")
        .populate("drug_id", "drug_id")
        .lean(),
    ]);

  // Map to Python schema shape
  const drugList = drugs.map((d) => ({
    drug_id:          d.drug_id,
    name:             d.name,
    category:         d.category,
    unit:             d.unit,
    is_critical:      d.is_critical,
    min_safety_stock: d.min_safety_stock,
  }));

  const hospitalList = hospitals.map((h) => ({
    hospital_id:    h.hospital_id,
    name:           h.name,
    tier:           h.tier,
    location_zone:  h.location_zone,
  }));

  const inventoryList = inventories.map((inv) => {
    const drug = inv.drug_id as unknown as Record<string, unknown>;
    const batchDocs = (inv.batch_ids ?? []) as unknown as Array<Record<string, unknown>>;
    return {
      location_id:     inv.location_id,
      location_type:   inv.location_type,
      drug_id:         (drug?.drug_id as string) ?? "",
      available_stock: inv.available_stock,
      reserved_stock:  inv.reserved_stock,
      incoming_stock:  inv.incoming_stock,
      batches: batchDocs.map((b) => ({
        batch_id:       b.batch_id,
        drug_id:        (drug?.drug_id as string) ?? "",
        manufacturer:   b.manufacturer,
        quantity:       b.quantity,
        expiry_date:    b.expiry_date,
        quality_status: b.quality_status,
      })),
    };
  });

  const consumptionList = consumptionRecords.map((c) => {
    const drug = c.drug_id as unknown as Record<string, unknown>;
    return {
      hospital_id:           c.hospital_id,
      drug_id:               (drug?.drug_id as string) ?? "",
      period_start:          c.period_start,
      period_end:            c.period_end,
      quantity_consumed:     c.quantity_consumed,
      daily_avg_consumption: c.daily_avg_consumption,
      is_anomaly:            c.is_anomaly,
    };
  });

  const vendorList = vendors.map((v) => ({
    vendor_id:           v.vendor_id,
    name:                v.name,
    avg_lead_time_days:  v.avg_lead_time_days,
    reliability_score:   v.reliability_score,
    active_orders_count: v.active_orders_count,
  }));

  const orderList = purchaseOrders.map((o) => {
    const vendor = o.vendor_id as unknown as Record<string, unknown>;
    const drug   = o.drug_id   as unknown as Record<string, unknown>;
    return {
      order_id:          o.order_id,
      vendor_id:         (vendor?.vendor_id as string) ?? "",
      drug_id:           (drug?.drug_id     as string) ?? "",
      quantity:          o.quantity,
      status:            o.status,
      created_at:        o.createdAt,
      expected_delivery: o.expected_delivery,
    };
  });

  const shipmentList = shipments.map((s) => {
    const order = s.order_id as unknown as Record<string, unknown>;
    const drug  = s.drug_id  as unknown as Record<string, unknown>;
    return {
      shipment_id:       s.shipment_id,
      order_id:          (order?.order_id as string) ?? "",
      origin_id:         s.origin_id,
      destination_id:    s.destination_id,
      drug_id:           (drug?.drug_id as string) ?? "",
      quantity:          s.quantity,
      status:            s.status,
      estimated_arrival: s.estimated_arrival,
    };
  });

  return {
    snapshot_id:         uuidv4(),
    timestamp:           now.toISOString(),
    drugs:               drugList,
    hospitals:           hospitalList,
    inventories:         inventoryList,
    consumption_records: consumptionList,
    vendors:             vendorList,
    purchase_orders:     orderList,
    shipments:           shipmentList,
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/ai/analyze
 * 1. Builds snapshot from live MongoDB data.
 * 2. Calls Python AI FastAPI service.
 * 3. Stores the CoordinatorRecommendationResponse in AIRecommendation collection.
 * 4. Returns stored recommendation to frontend.
 * Roles: admin, warehouse_manager
 */
export const triggerAnalysis = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

    // Step 1: Build snapshot
    const snapshot = await buildSnapshot();

    // Step 2: Call AI service
    let aiResponse: Record<string, unknown>;
    try {
      const response = await fetch(`${aiServiceUrl}/api/v1/analyze`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(snapshot),
        signal:  AbortSignal.timeout(60_000), // 60s timeout for SLM inference
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppError(`AI service error (${response.status}): ${errorText}`, 502);
      }

      aiResponse = (await response.json()) as Record<string, unknown>;
    } catch (fetchErr) {
      if (fetchErr instanceof AppError) throw fetchErr;
      // AI service unreachable — return snapshot so frontend isn't blocked
      res.status(503).json({
        success: false,
        message: "AI service is not reachable. Snapshot was built successfully.",
        snapshot_id: snapshot.snapshot_id,
        snapshot,
      });
      return;
    }

    // Step 3: Persist recommendation
    const stored = await AIRecommendation.create({
      recommendation_id:    (aiResponse.recommendation_id as string) ?? uuidv4(),
      snapshot_id:          snapshot.snapshot_id,
      overall_risk_level:   aiResponse.overall_risk_level,
      agent_findings:       aiResponse.agent_findings ?? [],
      recommended_actions:  aiResponse.recommended_actions ?? [],
      requires_human_approval: aiResponse.requires_human_approval ?? true,
      approval_status:      "pending",
    });

    // Step 4: Return
    res.status(201).json({ success: true, data: stored });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/ai/recommendations */
export const getAllRecommendations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { approval_status, overall_risk_level } = req.query;
    const filter: Record<string, unknown> = {};
    if (approval_status)   filter.approval_status   = approval_status;
    if (overall_risk_level) filter.overall_risk_level = overall_risk_level;

    const recs = await AIRecommendation.find(filter)
      .populate("approved_by", "name role")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: recs.length, data: recs });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/ai/recommendations/:id */
export const getRecommendationById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rec = await AIRecommendation.findOne({
      $or: [
        { recommendation_id: req.params.id },
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
      ],
    }).populate("approved_by", "name role");

    if (!rec) throw new AppError("Recommendation not found", 404);
    res.json({ success: true, data: rec });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/ai/recommendations/:id/approve
 * Human operator approves the AI recommendation.
 * Roles: admin
 */
export const approveRecommendation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rec = await AIRecommendation.findOneAndUpdate(
      {
        $or: [
          { recommendation_id: req.params.id },
          { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
        ],
        approval_status: "pending",
      },
      {
        $set: {
          approval_status: "approved",
          approved_by:     req.user!.userId,
          approved_at:     new Date(),
        },
      },
      { new: true }
    );
    if (!rec) throw new AppError("Pending recommendation not found", 404);
    res.json({ success: true, data: rec });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/ai/recommendations/:id/reject
 * Human operator rejects the AI recommendation.
 * Roles: admin
 */
export const rejectRecommendation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rejection_reason } = req.body;
    const rec = await AIRecommendation.findOneAndUpdate(
      {
        $or: [
          { recommendation_id: req.params.id },
          { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
        ],
        approval_status: "pending",
      },
      {
        $set: {
          approval_status:  "rejected",
          rejection_reason: rejection_reason ?? "No reason provided",
        },
      },
      { new: true }
    );
    if (!rec) throw new AppError("Pending recommendation not found", 404);
    res.json({ success: true, data: rec });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/ai/snapshot (debug/dev only)
 * Returns the current snapshot without calling the AI service.
 * Useful to verify snapshot data before AI is ready.
 */
export const previewSnapshot = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const snapshot = await buildSnapshot();
    res.json({ success: true, data: snapshot });
  } catch (err) {
    next(err);
  }
};
