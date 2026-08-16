import mongoose, { Schema, Document } from "mongoose";
import { getNextId } from "./Counter.model.js";

export interface IWarehouse extends Document {
  warehouse_id: string;
  name: string;
  location_zone: string;
  address?: string;
  capacity: number;
  manager_user_id?: string;
}

const WarehouseSchema = new Schema<IWarehouse>(
  {
    warehouse_id: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    location_zone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    capacity: { type: Number, required: true, min: 0 },
    manager_user_id: { type: String },
  },
  { timestamps: true }
);

WarehouseSchema.pre("validate", async function () {
  if (!this.warehouse_id) {
    this.warehouse_id = await getNextId("warehouse", "WH");
  }
});

export const Warehouse = mongoose.model<IWarehouse>(
  "Warehouse",
  WarehouseSchema
);
