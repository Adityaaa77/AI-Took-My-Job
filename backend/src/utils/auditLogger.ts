import { AuditLog } from "../models/AuditLog.model.js";
import { AuthenticatedRequest } from "../types/index.js";

/**
 * Centralized Audit Event Logger
 * Helper to record non-repudiable system audit events from backend controllers.
 */
export const logAuditEvent = async (
  req: AuthenticatedRequest,
  action: string,
  entity_type: string,
  entity_id: string,
  changes?: Record<string, unknown>
): Promise<void> => {
  try {
    if (!req.user || !req.user.userId) return;

    const ip_address =
      (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || "127.0.0.1";

    await AuditLog.create({
      action,
      performed_by: req.user.userId,
      entity_type,
      entity_id: String(entity_id),
      changes: changes || {},
      ip_address,
    });
  } catch (err) {
    console.error("Failed to create audit log entry:", err);
  }
};
