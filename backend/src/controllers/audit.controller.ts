import { Response, NextFunction } from "express";
import { AuditLog } from "../models/AuditLog.model.js";
import { AuthenticatedRequest } from "../types/index.js";

/**
 * GET /api/v1/audit-logs
 * Retrieves non-repudiable audit logs from MongoDB.
 */
export const getAllAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { entity_type, action, search } = req.query;
    const filter: Record<string, unknown> = {};

    if (entity_type && entity_type !== "all") {
      filter.entity_type = entity_type;
    }
    if (action && action !== "all") {
      filter.action = { $regex: String(action), $options: "i" };
    }
    if (search) {
      filter.$or = [
        { action: { $regex: String(search), $options: "i" } },
        { entity_type: { $regex: String(search), $options: "i" } },
        { entity_id: { $regex: String(search), $options: "i" } },
      ];
    }

    const logs = await AuditLog.find(filter)
      .populate("performed_by", "name role email associated_entity_id")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
};
