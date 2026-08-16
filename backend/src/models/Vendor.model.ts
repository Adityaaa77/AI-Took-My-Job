import mongoose, { Schema, Document } from "mongoose";
import { getNextId } from "./Counter.model.js";

export interface IVendor extends Document {
  vendor_id: string;
  name: string;
  avg_lead_time_days: number;
  reliability_score: number;
  active_orders_count: number;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  is_active: boolean;
}

const VendorSchema = new Schema<IVendor>(
  {
    vendor_id: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    avg_lead_time_days: { type: Number, required: true, min: 0 },
    reliability_score: { type: Number, required: true, min: 0, max: 1 },
    active_orders_count: { type: Number, default: 0, min: 0 },
    contact_email: { type: String, trim: true, lowercase: true },
    contact_phone: { type: String, trim: true },
    address: { type: String, trim: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

VendorSchema.pre("validate", async function (next) {
  if (!this.vendor_id) {
    this.vendor_id = await getNextId("vendor", "VEND");
  }
  next();
});

export const Vendor = mongoose.model<IVendor>("Vendor", VendorSchema);
