import mongoose, { Schema, Document, Types } from "mongoose";

export type AlertType =
  | "low_stock"
  | "expiry_warning"
  | "stockout"
  | "vendor_delay"
  | "anomaly"
  | "ai_recommendation";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface IAlert extends Document {
  alert_type: AlertType;
  severity: AlertSeverity;
  drug_id?: Types.ObjectId;
  location_id?: string;
  message: string;
  is_resolved: boolean;
  resolved_by?: Types.ObjectId;
  resolved_at?: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    alert_type: {
      type: String,
      enum: [
        "low_stock",
        "expiry_warning",
        "stockout",
        "vendor_delay",
        "anomaly",
        "ai_recommendation",
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    drug_id: { type: Schema.Types.ObjectId, ref: "Drug" },
    location_id: { type: String },
    message: { type: String, required: true, trim: true },
    is_resolved: { type: Boolean, default: false },
    resolved_by: { type: Schema.Types.ObjectId, ref: "User" },
    resolved_at: { type: Date },
  },
  { timestamps: true }
);

AlertSchema.index({ is_resolved: 1, severity: 1 });
AlertSchema.index({ drug_id: 1, alert_type: 1 });

export const Alert = mongoose.model<IAlert>("Alert", AlertSchema);
