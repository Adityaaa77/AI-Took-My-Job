import mongoose, { Schema, Document, Types } from "mongoose";

export type LocationType = "hospital" | "warehouse";

export interface IInventory extends Document {
  location_id: string;       // human-readable hospital_id or warehouse_id
  location_type: LocationType;
  drug_id: Types.ObjectId;
  available_stock: number;
  reserved_stock: number;
  incoming_stock: number;
  batch_ids: Types.ObjectId[]; // references to Batch collection
  last_updated: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    location_id: { type: String, required: true },
    location_type: {
      type: String,
      enum: ["hospital", "warehouse"],
      required: true,
    },
    drug_id: { type: Schema.Types.ObjectId, ref: "Drug", required: true },
    available_stock: { type: Number, default: 0, min: 0 },
    reserved_stock: { type: Number, default: 0, min: 0 },
    incoming_stock: { type: Number, default: 0, min: 0 },
    batch_ids: [{ type: Schema.Types.ObjectId, ref: "Batch" }],
    last_updated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Enforce one inventory record per (drug, location) pair
InventorySchema.index({ location_id: 1, drug_id: 1 }, { unique: true });

InventorySchema.pre("save", function () {
  this.last_updated = new Date();
});

export const Inventory = mongoose.model<IInventory>(
  "Inventory",
  InventorySchema
);
