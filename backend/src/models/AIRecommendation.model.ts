import mongoose, { Schema, Document, Types } from "mongoose";

// ─── Sub-schemas (mirrors ai_service/app/schemas/responses.py) ───────────────

const AgentFindingSchema = new Schema(
  {
    agent_name: { type: String, required: true },
    finding_type: { type: String, required: true },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    target_drug_id: { type: String, required: true },
    target_location_id: { type: String },
    description: { type: String, required: true },
    metrics: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const ActionRecommendationSchema = new Schema(
  {
    action_type: {
      type: String,
      enum: [
        "redistribute",
        "procure",
        "quarantine_batch",
        "expedite_shipment",
        "no_action",
      ],
      required: true,
    },
    target_drug_id: { type: String, required: true },
    source_location_id: { type: String },
    destination_location_id: { type: String, required: true },
    recommended_quantity: { type: Number, required: true, min: 0 },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    reasoning: { type: String, required: true },
    confidence: { type: Number, default: 0.85, min: 0, max: 1 },
  },
  { _id: false }
);

// ─── Main document ────────────────────────────────────────────────────────────

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface IAIRecommendation extends Document {
  recommendation_id: string;
  snapshot_id: string;
  overall_risk_level: RiskLevel;
  agent_findings: unknown[];
  recommended_actions: unknown[];
  requires_human_approval: boolean;
  approval_status: ApprovalStatus;
  approved_by?: Types.ObjectId;
  approved_at?: Date;
  rejection_reason?: string;
}

const AIRecommendationSchema = new Schema<IAIRecommendation>(
  {
    recommendation_id: { type: String, required: true, unique: true },
    snapshot_id: { type: String, required: true },
    overall_risk_level: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    agent_findings: { type: [AgentFindingSchema], default: [] },
    recommended_actions: { type: [ActionRecommendationSchema], default: [] },
    requires_human_approval: { type: Boolean, default: true },
    approval_status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approved_by: { type: Schema.Types.ObjectId, ref: "User" },
    approved_at: { type: Date },
    rejection_reason: { type: String, trim: true },
  },
  { timestamps: true }
);

AIRecommendationSchema.index({ approval_status: 1, createdAt: -1 });
AIRecommendationSchema.index({ overall_risk_level: 1 });

export const AIRecommendation = mongoose.model<IAIRecommendation>(
  "AIRecommendation",
  AIRecommendationSchema
);
