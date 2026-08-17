import { Request, Response, NextFunction } from "express";
import { Batch } from "../models/Batch.model.js";
import { Inventory } from "../models/Inventory.model.js";

// GET /api/v1/batches
// GET /api/v1/batches?drug_id=<id>&location_id=<id>&quality_status=passed
export const getAllBatches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filter: Record<string, any> = {};

    if (req.query.drug_id) filter.drug_id = req.query.drug_id;
    if (req.query.location_id) filter.location_id = req.query.location_id;
    if (req.query.location_type) filter.location_type = req.query.location_type;
    if (req.query.quality_status) filter.quality_status = req.query.quality_status;

    let batches = await Batch.find(filter)
      .populate("drug_id")
      .sort({ expiry_date: 1 });

    if (batches.length < 4 && Object.keys(filter).length === 0) {
      const defaultBatches = [
        {
          batch_id: "BATCH-001",
          location_id: "WH-001",
          location_type: "warehouse",
          manufacturer: "Sun Pharmaceutical Industries Ltd.",
          quantity: 300,
          manufacturing_date: new Date("2026-02-15"),
          expiry_date: new Date("2027-06-15"),
          quality_status: "passed",
          inspection_notes: "QA release approved. SHA-256 genesis block logged on DLT permissioned ledger.",
        },
        {
          batch_id: "BATCH-002",
          location_id: "WH-001",
          location_type: "warehouse",
          manufacturer: "Cipla Ltd.",
          quantity: 200,
          manufacturing_date: new Date("2026-03-01"),
          expiry_date: new Date("2027-08-20"),
          quality_status: "passed",
          inspection_notes: "QA batch release approved.",
        },
        {
          batch_id: "BATCH-COLD-02",
          location_id: "WH-002",
          location_type: "warehouse",
          manufacturer: "Intas Pharmaceuticals Ltd.",
          quantity: 450,
          manufacturing_date: new Date("2026-04-10"),
          expiry_date: new Date("2027-11-10"),
          quality_status: "passed",
          inspection_notes: "Reefer transit telemetry active. 2-8°C cold chain intact.",
        },
        {
          batch_id: "BATCH-AMX-09",
          location_id: "WH-001",
          location_type: "warehouse",
          manufacturer: "Lupin Ltd.",
          quantity: 650,
          manufacturing_date: new Date("2026-03-12"),
          expiry_date: new Date("2027-03-12"),
          quality_status: "passed",
          inspection_notes: "Antibiotic stability assay passed.",
        },
        {
          batch_id: "BATCH-INS-44",
          location_id: "WH-002",
          location_type: "warehouse",
          manufacturer: "Biocon Biologics Ltd.",
          quantity: 320,
          manufacturing_date: new Date("2026-01-18"),
          expiry_date: new Date("2027-01-18"),
          quality_status: "passed",
          inspection_notes: "Insulin bio-assay passed. Cold storage verified at 3.8°C.",
        },
        {
          batch_id: "BATCH-ERR-99",
          location_id: "WH-001",
          location_type: "warehouse",
          manufacturer: "Unlicensed Importer",
          quantity: 100,
          manufacturing_date: new Date("2025-10-01"),
          expiry_date: new Date("2026-10-10"),
          quality_status: "quarantined",
          inspection_notes: "Thermal excursion breach (+14.5°C) & provenance anomaly detected. Usable Qty set to 0.",
        },
      ];

      for (const b of defaultBatches) {
        await Batch.updateOne({ batch_id: b.batch_id }, { $setOnInsert: b }, { upsert: true });
      }
      batches = await Batch.find(filter).populate("drug_id").sort({ expiry_date: 1 });
    }

    res.status(200).json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/batches/:id
export const getBatchById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const batch = await Batch.findById(req.params.id).populate("drug_id");

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/batches
// Creates a batch AND keeps Inventory in sync (Drug → Batch → Inventory relationship)
export const createBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const batch = await Batch.create(req.body);

    // Keep Inventory in sync: increment available_stock, link this batch,
    // and create the Inventory record if it doesn't exist yet (upsert).
    await Inventory.findOneAndUpdate(
      { location_id: batch.location_id, drug_id: batch.drug_id },
      {
        $inc: { available_stock: batch.quantity },
        $addToSet: { batch_ids: batch._id },
        $set: {
          location_type: batch.location_type,
          last_updated: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    const populated = await batch.populate("drug_id");

    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/batches/:id
export const updateBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("drug_id");

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/batches/:id
export const deleteBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const batch = await Batch.findByIdAndDelete(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};