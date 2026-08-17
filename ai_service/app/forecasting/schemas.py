from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class SufficiencyMetadataSchema(BaseModel):
    """
    Metadata returned by Python Sufficiency Detector determining
    whether to forecast from local MongoDB hospital history or fallback to external reference data.
    """
    data_source: Literal["LOCAL_HOSPITAL_DATA", "EXTERNAL_REFERENCE_DATA"] = Field(
        ..., description="Data origin used for intelligence"
    )
    data_sufficiency: Literal["SUFFICIENT", "INSUFFICIENT_LOCAL_HISTORY"] = Field(
        ..., description="Evaluation status of local hospital history"
    )
    history_points: int = Field(..., ge=0, description="Number of historical time-series observations available")
    history_period: str = Field(..., description="Time range of historical data")
    missing_ratio: float = Field(..., ge=0.0, le=1.0, description="Ratio of missing time periods")
    fallback_used: bool = Field(..., description="True if external OECD/WHO reference data was used as fallback")
    reason: str = Field(..., description="Explanation of sufficiency evaluation decision")


class ModelEvaluationMetricsSchema(BaseModel):
    """
    Empirical validation performance metrics for candidate forecasting models.
    Used for metric-driven model selection.
    """
    mae: float = Field(..., ge=0.0, description="Mean Absolute Error")
    rmse: float = Field(..., ge=0.0, description="Root Mean Squared Error")
    mape: Optional[float] = Field(default=None, ge=0.0, description="Mean Absolute Percentage Error")
    training_samples: int = Field(..., ge=0, description="Number of training observations")
    validation_samples: int = Field(..., ge=0, description="Number of validation observations")


class ConsumptionForecastSchema(BaseModel):
    """
    Master consumption forecasting and intelligence output schema.
    Strictly maintains unit integrity and source distinction between physical hospital units and external DDD benchmarks.
    """
    drug_id: str = Field(..., description="Target drug ID e.g. DRUG-101")
    drug_name: str = Field(..., description="Target drug name e.g. Paracetamol 500mg")
    location_id: Optional[str] = Field(default=None, description="Hospital or warehouse location ID")
    data_source: Literal["LOCAL_HOSPITAL_DATA", "EXTERNAL_REFERENCE_DATA"] = Field(
        ..., description="Data source origin used for forecasting"
    )
    is_hospital_specific: bool = Field(
        ..., description="False if external population/national DDD reference data was used as fallback"
    )
    measurement_unit: str = Field(
        ..., description="Measurement unit (e.g. 'tablets', 'vials', or 'DDD per 1000 inhabitants per day')"
    )
    historical_period: str = Field(..., description="Historical time window analyzed")
    forecast_horizon: int = Field(default=6, ge=1, description="Number of future forecast periods (months/steps)")
    historical_consumption: List[float] = Field(default_factory=list, description="Historical time-series values")
    forecast_values: List[float] = Field(default_factory=list, description="Model-predicted future consumption values")
    trend: Literal["INCREASING", "DECREASING", "STABLE", "VOLATILE", "INSUFFICIENT_DATA"] = Field(
        ..., description="Calculated consumption trend pattern"
    )
    anomaly_detected: bool = Field(default=False, description="Flag indicating statistical anomaly detection")
    anomaly_type: Literal["NORMAL", "SUDDEN_SPIKE", "SUDDEN_DECREASE", "HIGH_VOLATILITY"] = Field(
        default="NORMAL", description="Type of consumption anomaly detected"
    )
    anomaly_score: float = Field(default=0.0, ge=0.0, description="Statistical z-score anomaly magnitude")
    selected_model: str = Field(..., description="Name of winning model selected by validation MAE/RMSE")
    selected_model_version: str = Field(default="v1.0", description="Model code version")
    evaluation_metrics: ModelEvaluationMetricsSchema = Field(..., description="Winning model validation metrics")
    confidence: float = Field(default=0.85, ge=0.0, le=1.0, description="Forecast confidence score")
    geographic_scope: str = Field(default="Local Hospital Ward", description="Scope of data (Local vs National)")
    sufficiency_metadata: SufficiencyMetadataSchema = Field(..., description="Sufficiency detector audit trail")
