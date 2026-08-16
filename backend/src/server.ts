import crypto from "node:crypto";

// Polyfill Web Crypto API for older Node.js runtime environments
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = crypto.webcrypto;
}

import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import authRoutes          from "./routes/auth.routes.js";
import drugRoutes          from "./routes/drug.routes.js";
import batchRoutes from "./routes/batch.routes.js";
import hospitalRoutes      from "./routes/hospital.routes.js";
import vendorRoutes        from "./routes/vendor.routes.js";
import warehouseRoutes     from "./routes/warehouse.routes.js";
import inventoryRoutes     from "./routes/inventory.routes.js";
import purchaseOrderRoutes from "./routes/purchaseOrder.routes.js";
import shipmentRoutes      from "./routes/shipment.routes.js";
import consumptionRoutes   from "./routes/consumption.routes.js";
import alertRoutes         from "./routes/alert.routes.js";
import aiRoutes            from "./routes/ai.routes.js";

dotenv.config();

const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Drug Supply Chain API is running",
    version: "1.0.0",
  });
});

// ─── API Routes (mounted here in future stages) ───────────────────────────────
app.use("/api/v1/auth",             authRoutes);
app.use("/api/v1/drugs",            drugRoutes);
app.use("/api/v1/batches",          batchRoutes);
app.use("/api/v1/hospitals",        hospitalRoutes);
app.use("/api/v1/vendors",          vendorRoutes);
app.use("/api/v1/warehouses",       warehouseRoutes);
app.use("/api/v1/inventory",        inventoryRoutes);
app.use("/api/v1/purchase-orders",  purchaseOrderRoutes);
app.use("/api/v1/shipments",        shipmentRoutes);
app.use("/api/v1/consumption",      consumptionRoutes);
app.use("/api/v1/alerts",           alertRoutes);
app.use("/api/v1/ai",              aiRoutes);

// ─── 404 Fallback ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global Error Handler (must be last) ──────────────────────────────────────
app.use(globalErrorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
