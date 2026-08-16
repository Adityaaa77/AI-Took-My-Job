import { Response, NextFunction } from "express";
import { Alert } from "../models/Alert.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthenticatedRequest } from "../types/index.js";

/** GET /api/v1/alerts?is_resolved=false&severity=critical&alert_type=low_stock */
export const getAllAlerts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { is_resolved, severity, alert_type } = req.query;
    const filter: Record<string, unknown> = {};
    if (is_resolved  !== undefined) filter.is_resolved  = is_resolved  === "true";
    if (severity)    filter.severity   = severity;
    if (alert_type)  filter.alert_type = alert_type;

    const alerts = await Alert.find(filter)
      .populate("drug_id", "drug_id name")
      .populate("resolved_by", "name role")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/alerts/:id */
export const getAlertById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate("drug_id", "drug_id name")
      .populate("resolved_by", "name role");
    if (!alert) throw new AppError("Alert not found", 404);
    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/alerts — admin, warehouse_manager */
export const createAlert = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { alert_type, severity, drug_id, location_id, message } = req.body;
    if (!alert_type || !severity || !message)
      throw new AppError("alert_type, severity and message are required", 400);

    const alert = await Alert.create({ alert_type, severity, drug_id, location_id, message });
    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/alerts/:id/resolve
 * Marks alert as resolved and records who resolved it.
 * Roles: admin, warehouse_manager
 */
export const resolveAlert = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          is_resolved:  true,
          resolved_by:  req.user!.userId,
          resolved_at:  new Date(),
        },
      },
      { new: true }
    );
    if (!alert) throw new AppError("Alert not found", 404);
    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/alerts/:id — admin only */
export const deleteAlert = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) throw new AppError("Alert not found", 404);
    res.json({ success: true, message: "Alert deleted" });
  } catch (err) {
    next(err);
  }
};
