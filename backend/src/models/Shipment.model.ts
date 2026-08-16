import mongoose, { Schema, Document, Types } from "mongoose";
import { getNextId } from "./Counter.model.js";

export type ShipmentStatus =
  | "preparing"
  | "in_transit"
  | "delayed"
  | "delivered";

export interface IShipment extends Document {
  shipment_id: string;
  order_id: Types.ObjectId;
  origin_id: string;
  origin_type: "vendor" | "warehouse";
  destination_id: string;
  destination_type: "hospital" | "warehouse";
  drug_id: Types.ObjectId;
  quantity: number;
  status: ShipmentStatus;
  estimated_arrival: Date;
  actual_arrival?: Date;
  tracking_note?: string;
}

const ShipmentSchema = new Schema<IShipment>(
  {
    shipment_id: { type: String, unique: true },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
    },
    origin_id: { type: String, required: true },
    origin_type: {
      type: String,
      enum: ["vendor", "warehouse"],
      required: true,
    },
    destination_id: { type: String, required: true },
    destination_type: {
      type: String,
      enum: ["hospital", "warehouse"],
      required: true,
    },
    drug_id: { type: Schema.Types.ObjectId, ref: "Drug", required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["preparing", "in_transit", "delayed", "delivered"],
      default: "preparing",
    },
    estimated_arrival: { type: Date, required: true },
    actual_arrival: { type: Date },
    tracking_note: { type: String, trim: true },
  },
  { timestamps: true }
);

ShipmentSchema.pre("validate", async function (next) {
  if (!this.shipment_id) {
    this.shipment_id = await getNextId("shipment", "SHIP");
  }
  next();
});

ShipmentSchema.index({ order_id: 1 });
ShipmentSchema.index({ destination_id: 1, status: 1 });

export const Shipment = mongoose.model<IShipment>("Shipment", ShipmentSchema);
