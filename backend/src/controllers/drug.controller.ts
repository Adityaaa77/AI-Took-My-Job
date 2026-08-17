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

    let drugs = await Drug.find(filter).sort({ createdAt: -1 });

    if (drugs.length < 5 && Object.keys(filter).length === 0) {
      const defaultDrugs = [
        {
          drug_id: "DRUG-004",
          name: "Propofol 1% Injectable Emulsion",
          generic_name: "2,6-diisopropylphenol",
          category: "Critical Care / Anesthetics",
          unit: "vials",
          is_critical: true,
          min_safety_stock: 500,
          storage_temperature: "cold_chain_2_8",
          therapeutic_class: "General Anesthetic & ICU Sedative",
          strength: "10 mg/ml, 20ml",
          description: "Short-acting intravenous sedative-hypnotic agent. Requires continuous 2°C to 8°C cold chain.",
        },
        {
          drug_id: "DRUG-001",
          name: "Paracetamol 500mg Tablets",
          generic_name: "Acetaminophen",
          category: "Analgesics & Fever",
          unit: "tablets",
          is_critical: false,
          min_safety_stock: 1000,
          storage_temperature: "ambient",
          therapeutic_class: "Non-Opioid Analgesic & Antipyretic",
          strength: "500mg Oral Tablet",
          description: "First-line oral management of fever and mild-to-moderate pain.",
        },
        {
          drug_id: "DRUG-303",
          name: "Amoxicillin 250mg/5mL Oral Suspension",
          generic_name: "Amoxicillin Trihydrate",
          category: "Antibiotics",
          unit: "bottles",
          is_critical: true,
          min_safety_stock: 400,
          storage_temperature: "cold_chain_2_8",
          therapeutic_class: "Broad-Spectrum Penicillin Antibiotic",
          strength: "250mg/5mL, 100mL",
          description: "Broad-spectrum beta-lactam antibiotic for bacterial respiratory and systemic infections.",
        },
        {
          drug_id: "DRUG-102",
          name: "Human Insulin Regular (100 IU/ml)",
          generic_name: "Recombinant Human Insulin",
          category: "Endocrinology / ICU",
          unit: "vials",
          is_critical: true,
          min_safety_stock: 350,
          storage_temperature: "cold_chain_2_8",
          therapeutic_class: "Antidiabetic Hormone",
          strength: "100 IU/ml, 10ml",
          description: "Fast-acting recombinant human insulin. Requires continuous 2°C to 8°C cold chain.",
        },
        {
          drug_id: "DRUG-205",
          name: "Remdesivir 100mg IV Lyophilized Powder",
          generic_name: "Remdesivir for Injection",
          category: "Antivirals",
          unit: "vials",
          is_critical: true,
          min_safety_stock: 250,
          storage_temperature: "ambient",
          therapeutic_class: "Nucleotide Analog Antiviral",
          strength: "100 mg Injection",
          description: "Antiviral indicated for acute severe respiratory viral infections.",
        },
        {
          drug_id: "DRUG-401",
          name: "Adrenaline (Epinephrine) 1mg/mL Injection",
          generic_name: "Epinephrine Injection USP",
          category: "Critical Care / Resuscitation",
          unit: "ampoules",
          is_critical: true,
          min_safety_stock: 600,
          storage_temperature: "cold_chain_2_8",
          therapeutic_class: "Adrenergic Agonist Resuscitation Drug",
          strength: "1 mg/ml, 1ml",
          description: "Emergency vasopressor for cardiac arrest, anaphylaxis, and severe septic shock.",
        },
        {
          drug_id: "DRUG-505",
          name: "Heparin Sodium 5000 IU/mL Injection",
          generic_name: "Heparin Sodium",
          category: "Cardiovascular / Surgery",
          unit: "vials",
          is_critical: true,
          min_safety_stock: 300,
          storage_temperature: "ambient",
          therapeutic_class: "Anticoagulant",
          strength: "5000 IU/ml, 5ml",
          description: "Parenteral anticoagulant for deep vein thrombosis prevention and cardiac surgery.",
        },
      ];

      for (const d of defaultDrugs) {
        await Drug.updateOne({ drug_id: d.drug_id }, { $setOnInsert: d }, { upsert: true });
      }
      drugs = await Drug.find(filter).sort({ createdAt: -1 });
    }

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
