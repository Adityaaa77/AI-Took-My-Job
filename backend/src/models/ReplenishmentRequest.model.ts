import mongoose, { Schema, Document, Types } from "mongoose";
import { getNextId } from "./Counter.model.js";

export type ReplenishmentStatus =
  | "pending"
  | "approved"
  | "allocated"
  | "dispatched"
  | "received"
  | "rejected";

export type UrgencyLevel = "standard" | "urgent" | "critical";

export interface IReplenishmentRequest extends Document {
  request_id: string;
  hospital_id: string;
  hospital_name?: string;
  drug_id: Types.ObjectId;
  requested_quantity: number;
  approved_quantity?: number;
  urgency: UrgencyLevel;
  reason?: string;
  attached_image?: string;
  image_hash?: string;
  status: ReplenishmentStatus;
  allocated_from?: string;
  shipment_id?: Types.ObjectId;
  requested_by: Types.ObjectId;
  approved_by?: Types.ObjectId;
  allocated_by?: Types.ObjectId;
  dispatched_by?: Types.ObjectId;
}

const ReplenishmentRequestSchema = new Schema<IReplenishmentRequest>(
  {
    request_id: { type: String, unique: true },
    hospital_id: { type: String, required: true },
    hospital_name: { type: String },
    drug_id: { type: Schema.Types.ObjectId, ref: "Drug", required: true },
    requested_quantity: { type: Number, required: true, min: 1 },
    approved_quantity: { type: Number, min: 1 },
    urgency: {
      type: String,
      enum: ["standard", "urgent", "critical"],
      default: "standard",
    },
    reason: { type: String, trim: true },
    attached_image: { type: String },
    image_hash: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "allocated", "dispatched", "received", "rejected"],
      default: "pending",
    },
    allocated_from: { type: String, trim: true },
    shipment_id: { type: Schema.Types.ObjectId, ref: "Shipment" },
    requested_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approved_by: { type: Schema.Types.ObjectId, ref: "User" },
    allocated_by: { type: Schema.Types.ObjectId, ref: "User" },
    dispatched_by: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ReplenishmentRequestSchema.pre("validate", async function () {
  if (!this.request_id) {
    this.request_id = await getNextId("replenishment", "REQ");
  }
});

export const ReplenishmentRequest = mongoose.model<IReplenishmentRequest>(
  "ReplenishmentRequest",
  ReplenishmentRequestSchema
);
