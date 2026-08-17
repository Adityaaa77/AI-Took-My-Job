// backend/src/routes/traceabilityRoutes.ts
import { Router, Request, Response } from "express";

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
/POST /api/v1/traceability/verify
 * Proxy to FastAPI /api/v1/traceability/verify
 */
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/traceability/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to connect to AI Traceability Service",
      error: err.message,
    });
  }
});

/**
 * POST /api/v1/traceability/events
 * Proxy to FastAPI /api/v1/traceability/events
 */
router.post("/events", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/traceability/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to record event to AI Traceability Service",
      error: err.message,
    });
  }
});

/**
 * GET /api/v1/traceability/batch/:batchId
 * Proxy to FastAPI /api/v1/traceability/batch/:batchId
 */
router.get("/batch/:batchId", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/traceability/batch/${encodeURIComponent(batchId)}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch batch timeline from AI Traceability Service",
      error: err.message,
    });
  }
});

/**
 * GET /api/v1/traceability/batch/:batchId/timeline
 */
router.get("/batch/:batchId/timeline", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/traceability/batch/${encodeURIComponent(batchId)}/timeline`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch timeline from AI Traceability Service",
      error: err.message,
    });
  }
});

export default router;
