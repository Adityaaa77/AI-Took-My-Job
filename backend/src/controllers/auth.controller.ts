import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, UserRole } from "../models/User.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthenticatedRequest } from "../types/index.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

const signToken = (
  userId: string,
  role: UserRole,
  associated_entity_id?: string,
  associated_entity_type?: string
): string => {
  return jwt.sign(
    { userId, role, associated_entity_id, associated_entity_type },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
  );
};

/** Strips password_hash before sending user object to client */
const sanitiseUser = (user: InstanceType<typeof User>) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  associated_entity_id: user.associated_entity_id,
  associated_entity_type: user.associated_entity_type,
  is_active: user.is_active,
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, role, associated_entity_id?, associated_entity_type? }
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      email,
      password,
      role,
      associated_entity_id,
      associated_entity_type,
    } = req.body;

    if (!name || !email || !password || !role) {
      throw new AppError("name, email, password and role are required", 400);
    }

    const existing = await User.findOne({ email });
    if (existing) throw new AppError("Email is already registered", 409);

    // password_hash field triggers bcrypt pre-save hook
    const user = await User.create({
      name,
      email,
      password_hash: password,
      role,
      associated_entity_id,
      associated_entity_type,
    });

    const token = signToken(
      user._id.toString(),
      user.role,
      user.associated_entity_id,
      user.associated_entity_type
    );

    res.status(201).json({ success: true, data: { token, user: sanitiseUser(user) } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    // Include password_hash for comparison (excluded by default via select)
    const user = await User.findOne({ email, is_active: true }).select(
      "+password_hash"
    );

    // Use same error message for both "not found" and "wrong password"
    // to prevent user enumeration
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError("Invalid email or password", 401);
    }

    const token = signToken(
      user._id.toString(),
      user.role,
      user.associated_entity_id,
      user.associated_entity_type
    );

    res.json({ success: true, data: { token, user: sanitiseUser(user) } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/auth/me
 * Protected — returns the currently authenticated user's profile.
 */
export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.userId).select("-password_hash");
    if (!user) throw new AppError("User not found", 404);

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
