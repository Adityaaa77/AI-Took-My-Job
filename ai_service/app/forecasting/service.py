import logging
from typing import Optional, List, Dict, Any
from app.schemas import SupplyChainSnapshotPayload
from app.forecasting.schemas import ConsumptionForecastSchema, SufficiencyMetadataSchema
from app.forecasting.sufficiency import SufficiencyDetector
from app.forecasting.data_loader import DataLoader
from app.forecasting.evaluator import ForecastingEvaluator
from app.forecasting.anomaly import AnomalyAndTrendDetector

logger = logging.getLogger(__name__)


class ConsumptionIntelligenceService:
    """
    Decoupled Consumption Intelligence & ML Forecasting Service managing
    local hospital sufficiency evaluation, OECD/WHO external reference fallback,
    chronological model training, metric-driven model selection, and anomaly detection.
    """

    def __init__(
        self,
        sufficiency_detector: Optional[SufficiencyDetector] = None,
        data_loader: Optional[DataLoader] = None,
        evaluator: Optional[ForecastingEvaluator] = None,
        anomaly_detector: Optional[AnomalyAndTrendDetector] = None,
    ):
        self.sufficiency_detector = sufficiency_detector or SufficiencyDetector()
        self.data_loader = data_loader or DataLoader()
        self.evaluator = evaluator or ForecastingEvaluator()
        self.anomaly_detector = anomaly_detector or AnomalyAndTrendDetector()

    async def generate_consumption_forecast(
        self,
        snapshot: Optional[SupplyChainSnapshotPayload],
        drug_id: str,
        drug_name: str,
        location_id: Optional[str] = None,
        forecast_horizon: int = 6,
    ) -> ConsumptionForecastSchema:
        """
        Generate validated ConsumptionForecastSchema with transparent local vs external source tracking
        and strict measurement unit integrity.
        """
        # 1. Extract local hospital consumption history
        local_history, local_unit = self.data_loader.get_local_hospital_history(
            snapshot, drug_id, location_id
        )

        # 2. Evaluate sufficiency deterministically in Python
        sufficiency_meta = self.sufficiency_detector.evaluate_sufficiency(
            local_history, location_id, drug_id
        )

        # 3. Determine time-series dataset to pass to model
        if sufficiency_meta.data_source == "LOCAL_HOSPITAL_DATA":
            active_series = local_history
            active_unit = local_unit
            is_hosp_specific = True
            geo_scope = "Local Hospital Ward"
        else:
            # Fall back to external OECD/WHO reference time series
            ext_series, ext_unit, ext_geo = self.data_loader.get_external_reference_series(
                drug_id, drug_name
            )
            active_series = ext_series
            active_unit = ext_unit
            is_hosp_specific = False
            geo_scope = ext_geo

        # 4. Train candidate models & select best model strictly by validation MAE/RMSE
        winning_model, forecast_values, eval_metrics = self.evaluator.evaluate_and_select_best_model(
            active_series, forecast_horizon
        )

        # 5. Calculate trend and statistical anomaly z-score in Python
        trend, anomaly_detected, anomaly_type, anomaly_score = (
            self.anomaly_detector.analyze_trend_and_anomalies(active_series, forecast_values)
        )

        # Calculate model confidence score based on MAE and data sufficiency
        hist_mean = sum(active_series) / float(len(active_series)) if active_series else 1.0
        relative_error = min(1.0, eval_metrics.mae / hist_mean) if hist_mean > 0 else 0.2
        base_conf = 0.92 if is_hosp_specific else 0.78
        confidence = round(max(0.50, min(0.98, base_conf - (relative_error * 0.3))), 2)

        return ConsumptionForecastSchema(
            drug_id=drug_id,
            drug_name=drug_name,
            location_id=location_id,
            data_source=sufficiency_meta.data_source,
            is_hospital_specific=is_hosp_specific,
            measurement_unit=active_unit,
            historical_period=sufficiency_meta.history_period,
            forecast_horizon=forecast_horizon,
            historical_consumption=active_series,
            forecast_values=forecast_values,
            trend=trend,
            anomaly_detected=anomaly_detected,
            anomaly_type=anomaly_type,
            anomaly_score=anomaly_score,
            selected_model=winning_model.name,
            selected_model_version="v1.0",
            evaluation_metrics=eval_metrics,
            confidence=confidence,
            geographic_scope=geo_scope,
            sufficiency_metadata=sufficiency_meta,
        )
