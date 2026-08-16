import mongoose, { Schema, Document } from "mongoose";
import { getNextId } from "./Counter.model.js";

export interface IDrug extends Document {
  drug_id: string;
  name: string;
  category: string;
  unit: string;
  is_critical: boolean;
  min_safety_stock: number;
  description?: string;
}

const DrugSchema = new Schema<IDrug>(
  {
    drug_id: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    is_critical: { type: Boolean, default: false },
    min_safety_stock: { type: Number, default: 100, min: 0 },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

DrugSchema.pre("validate", async function () {
  if (!this.drug_id) {
    this.drug_id = await getNextId("drug", "DRUG");
  }
});

DrugSchema.index({ name: "text", category: "text" });

export const Drug = mongoose.model<IDrug>("Drug", DrugSchema);