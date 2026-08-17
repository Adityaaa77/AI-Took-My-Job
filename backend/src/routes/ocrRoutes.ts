// backend/src/routes/ocrRoutes.ts
import { Router, Request, Response } from "express";
import { uploadImageToSupabase } from "../utils/supabase.js";

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * POST /api/v1/ocr/scan-carton
 * Uploads packaging photo to Supabase Storage and proxies to FastAPI OCR engine
 */
router.post("/scan-carton", async (req: Request, res: Response) => {
  try {
    const { image_base64 } = req.body;

    // Upload base64 image to Supabase Storage if provided
    let supabaseUrl: string | undefined = undefined;
    if (image_base64 && typeof image_base64 === "string" && image_base64.startsWith("data:image")) {
      const uploadRes = await uploadImageToSupabase(image_base64, "drug-AI");
      supabaseUrl = uploadRes.url;
    }

    const response = await fetch(`${AI_SERVICE_URL}/api/v1/ocr/scan-carton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();

    if (supabaseUrl && data && typeof data === "object") {
      data.supabase_url = supabaseUrl;
      data.attached_image = supabaseUrl;
    }

    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to connect to AI OCR Service",
      error: err.message,
    });
  }
});

export default router;
