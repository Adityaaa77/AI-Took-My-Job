import mongoose, { Schema, Document, Types } from "mongoose";
import { getNextId } from "./Counter.model.js";

export type OrderStatus =
  | "pending"
  | "approved"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface IPurchaseOrder extends Document {
  order_id: string;
  vendor_id: Types.ObjectId;
  drug_id: Types.ObjectId;
  destination_location_id: string;
  destination_location_type: "hospital" | "warehouse";
  quantity: number;
  status: OrderStatus;
  created_by: Types.ObjectId;
  expected_delivery: Date;
  actual_delivery?: Date;
  notes?: string;
}

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    order_id: { type: String, unique: true },
    vendor_id: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    drug_id: { type: Schema.Types.ObjectId, ref: "Drug", required: true },
    destination_location_id: { type: String, required: true },
    destination_location_type: {
      type: String,
      enum: ["hospital", "warehouse"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "approved", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expected_delivery: { type: Date, required: true },
    actual_delivery: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

PurchaseOrderSchema.pre("validate", async function () {
  if (!this.order_id) {
    this.order_id = await getNextId("purchaseOrder", "PO");
  }
});

PurchaseOrderSchema.index({ vendor_id: 1, status: 1 });
PurchaseOrderSchema.index({ drug_id: 1, status: 1 });

export const PurchaseOrder = mongoose.model<IPurchaseOrder>(
  "PurchaseOrder",
  PurchaseOrderSchema
);
