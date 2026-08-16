import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../types/index.js";
import { UserRole } from "../models/User.model.js";

interface JwtPayload {
  userId: string;
  role: UserRole;
  associated_entity_id?: string;
  associated_entity_type?: string;
}

/**
 * protect — verifies the Bearer JWT in Authorization header.
 * Attaches decoded payload to req.user on success.
 */
export const protect = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      associated_entity_id: decoded.associated_entity_id,
      associated_entity_type: decoded.associated_entity_type,
    };

    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/**
 * authorise — restricts route access to specific roles.
 * Must be used AFTER protect middleware.
 *
 * Usage:
 *   router.post("/", protect, authorise("admin", "warehouse_manager"), handler)
 */
export const authorise = (...roles: UserRole[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
      return;
    }
    next();
  };
};
