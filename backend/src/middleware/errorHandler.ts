import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

/**
 * AppError — throw this anywhere in the app to send a
 * structured error response with a specific HTTP status code.
 *
 * Example:
 *   throw new AppError("Drug not found", 404);
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * globalErrorHandler — Express error-handling middleware.
 * Must be registered LAST in server.ts (after all routes).
 */
export const globalErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Known operational error (thrown by us)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Mongoose duplicate key (e.g. duplicate email / drug_id)
  if ((err as NodeJS.ErrnoException).name === "MongoServerError") {
    const mongoErr = err as unknown as { code: number; keyValue: Record<string, unknown> };
    if (mongoErr.code === 11000) {
      const field = Object.keys(mongoErr.keyValue)[0];
      res.status(409).json({
        success: false,
        message: `Duplicate value for field: ${field}`,
      });
      return;
    }
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
    return;
  }

  // Mongoose CastError (invalid ObjectId in URL param)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      message: `Invalid value for field: ${err.path}`,
    });
    return;
  }

  // Unknown / unexpected error — hide internals in production
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
};
