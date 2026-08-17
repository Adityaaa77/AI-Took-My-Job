from fastapi import APIRouter
from app.api.v1.endpoints import health, analyze, forecast, traceability, ocr, telemetry

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["Health & Status"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["Supply Chain Intelligence Analysis"])
api_router.include_router(forecast.router, prefix="/forecast", tags=["Consumption Intelligence & Forecasting"])
api_router.include_router(traceability.router, prefix="/traceability", tags=["Blockchain Batch Traceability & Provenance"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["AI Carton OCR & Vision Extraction"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["IoT Cold-Chain Telemetry & Risk Prediction"])
