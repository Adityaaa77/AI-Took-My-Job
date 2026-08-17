"""
Hospital Consumption Intelligence, Data Sufficiency, External Reference Fallback & ML Forecasting Module.
"""

from app.forecasting.schemas import (
    ConsumptionForecastSchema,
    SufficiencyMetadataSchema,
    ModelEvaluationMetricsSchema,
)
from app.forecasting.sufficiency import SufficiencyDetector
from app.forecasting.data_loader import DataLoader
from app.forecasting.evaluator import ForecastingEvaluator, BaselineMovingAverageModel, LinearLagRegressionModel, RandomForestTimeSeriesModel
from app.forecasting.anomaly import AnomalyAndTrendDetector
from app.forecasting.service import ConsumptionIntelligenceService

__all__ = [
    "ConsumptionForecastSchema",
    "SufficiencyMetadataSchema",
    "ModelEvaluationMetricsSchema",
    "SufficiencyDetector",
    "DataLoader",
    "ForecastingEvaluator",
    "BaselineMovingAverageModel",
    "LinearLagRegressionModel",
    "RandomForestTimeSeriesModel",
    "AnomalyAndTrendDetector",
    "ConsumptionIntelligenceService",
]
