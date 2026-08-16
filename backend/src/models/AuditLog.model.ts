import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  action: string;              // e.g. CREATE_ORDER, UPDATE_INVENTORY, APPROVE_RECOMMENDATION
  performed_by: Types.ObjectId;
  entity_type: string;         // e.g. "Drug", "PurchaseOrder", "Shipment"
  entity_id: string;
  changes?: Record<string, unknown>; // { before: {...}, after: {...} }
  ip_address?: string;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true },
    performed_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    entity_type: { type: String, required: true },
    entity_id: { type: String, required: true },
    changes: { type: Schema.Types.Mixed },
    ip_address: { type: String },
  },
  {
    timestamps: true,
    // Audit logs must never be mutated — disable update ops at schema level
    strict: true,
  }
);

AuditLogSchema.index({ performed_by: 1, createdAt: -1 });
AuditLogSchema.index({ entity_type: 1, entity_id: 1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
