// backend/src/routes/telemetry.routes.ts
import { Router, Request, Response } from "express";

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * POST /api/v1/telemetry/simulate
 * Proxies telemetry stream generation request to FastAPI
 */
router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/telemetry/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to connect to AI Telemetry Service",
      error: err.message,
    });
  }
});

/**
 * POST /api/v1/telemetry/predict-risk
 * Proxies telemetry risk evaluation request to FastAPI
 */
router.post("/predict-risk", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/telemetry/predict-risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to connect to AI Telemetry Service",
      error: err.message,
    });
  }
});

/**
 * POST /api/v1/telemetry/compliance-audit
 * Proxies compliance audit request to FastAPI ComplianceAgent
 */
router.post("/compliance-audit", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/telemetry/compliance-audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to connect to AI Compliance Service",
      error: err.message,
    });
  }
});

export default router;
