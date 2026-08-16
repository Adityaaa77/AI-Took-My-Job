import mongoose, { Schema, Document, Types } from "mongoose";

export interface IConsumptionRecord extends Document {
  hospital_id: string;
  drug_id: Types.ObjectId;
  period_start: Date;
  period_end: Date;
  quantity_consumed: number;
  daily_avg_consumption: number;
  is_anomaly: boolean;
  recorded_by: Types.ObjectId;
  notes?: string;
}

const ConsumptionRecordSchema = new Schema<IConsumptionRecord>(
  {
    hospital_id: { type: String, required: true },
    drug_id: { type: Schema.Types.ObjectId, ref: "Drug", required: true },
    period_start: { type: Date, required: true },
    period_end: { type: Date, required: true },
    quantity_consumed: { type: Number, required: true, min: 0 },
    daily_avg_consumption: { type: Number, required: true, min: 0 },
    is_anomaly: { type: Boolean, default: false },
    recorded_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

ConsumptionRecordSchema.index({ hospital_id: 1, drug_id: 1, period_start: -1 });

export const ConsumptionRecord = mongoose.model<IConsumptionRecord>(
  "ConsumptionRecord",
  ConsumptionRecordSchema
);
