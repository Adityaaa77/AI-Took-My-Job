import mongoose, { Schema, Document, Types } from "mongoose";
import { getNextId } from "./Counter.model.js";

export type QualityStatus = "passed" | "quarantine" | "failed";
export type LocationType = "hospital" | "warehouse";

export interface IBatch extends Document {
  batch_id: string;
  drug_id: Types.ObjectId;
  location_id: string;
  location_type: LocationType;
  manufacturer: string;
  quantity: number;
  expiry_date: Date;
  quality_status: QualityStatus;
}

const BatchSchema = new Schema<IBatch>(
  {
    batch_id: { type: String, unique: true },
    drug_id: { type: Schema.Types.ObjectId, ref: "Drug", required: true },
    location_id: { type: String, required: true },
    location_type: {
      type: String,
      enum: ["hospital", "warehouse"],
      required: true,
    },
    manufacturer: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    expiry_date: { type: Date, required: true },
    quality_status: {
      type: String,
      enum: ["passed", "quarantine", "failed"],
      default: "passed",
    },
  },
  { timestamps: true }
);

BatchSchema.pre("validate", async function () {
  if (!this.batch_id) {
    this.batch_id = await getNextId("batch", "BATCH");
  }
});

BatchSchema.index({ drug_id: 1, location_id: 1 });
BatchSchema.index({ expiry_date: 1 }); // supports expiry-window queries

export const Batch = mongoose.model<IBatch>("Batch", BatchSchema);
