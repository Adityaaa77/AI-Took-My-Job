import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Query
from app.schemas import SupplyChainSnapshotPayload
from app.forecasting.schemas import ConsumptionForecastSchema
from app.forecasting.service import ConsumptionIntelligenceService

logger = logging.getLogger(__name__)

router = APIRouter()
_forecasting_service = ConsumptionIntelligenceService()


@router.post("", response_model=ConsumptionForecastSchema)
@router.post("/", response_model=ConsumptionForecastSchema, include_in_schema=False)
async def generate_forecast(
    drug_id: str = Query(..., description="Drug identifier e.g. DRUG-101"),
    drug_name: Optional[str] = Query(default="Paracetamol 500mg", description="Drug generic/brand name"),
    location_id: Optional[str] = Query(default=None, description="Hospital or Warehouse location ID"),
    forecast_horizon: int = Query(default=6, ge=1, le=24, description="Forecast period horizon"),
    snapshot: Optional[SupplyChainSnapshotPayload] = None,
) -> ConsumptionForecastSchema:
    """
    Generate Machine Learning Consumption Forecast and Trend Intelligence.
    Uses local hospital history if sufficient data exists, or falls back to
    authoritative OECD/WHO ATC/DDD reference benchmarks.
    """
    try:
        forecast = await _forecasting_service.generate_consumption_forecast(
            snapshot=snapshot,
            drug_id=drug_id,
            drug_name=drug_name or drug_id,
            location_id=location_id,
            forecast_horizon=forecast_horizon,
        )
        return forecast
    except Exception as err:
        logger.error(f"Error generating consumption forecast for drug {drug_id}: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Consumption forecasting failed: {str(err)}",
        )
