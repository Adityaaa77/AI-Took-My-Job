import { Request } from "express";
import { UserRole } from "../models/User.model.js";

/**
 * Extends Express Request to carry the authenticated user's
 * decoded JWT payload after the auth middleware runs.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
    associated_entity_id?: string;
    associated_entity_type?: string;
  };
}

/** Generic API error shape returned to clients */
export interface ApiError {
  success: false;
  message: string;
  errors?: unknown;
}

/** Generic API success shape returned to clients */
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}
