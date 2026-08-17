# ai_service/app/telemetry/schemas.py
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class TelemetryScenario(str, Enum):
    NORMAL = "NORMAL"
    GRADUAL_DRIFT = "GRADUAL_DRIFT"
    COMPRESSOR_FAILURE = "COMPRESSOR_FAILURE"
    DOOR_OPEN = "DOOR_OPEN"
    RECOVERY = "RECOVERY"

class ConditionStatusType(str, Enum):
    SAFE = "SAFE"
    WARNING = "WARNING"
    BREACH = "BREACH"
    CRITICAL = "CRITICAL"

class PredictiveStatusType(str, Enum):
    STABLE = "STABLE"
    DRIFTING = "DRIFTING"
    PREDICTED_BREACH = "PREDICTED_BREACH"
    RECOVERING = "RECOVERING"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"

class TelemetryReading(BaseModel):
    timestamp: str = Field(..., description="ISO 8601 timestamp string")
    shipment_id: str = Field(default="SHP-LIVE-101", description="Target reefer container or shipment ID")
    batch_id: str = Field(default="BATCH-001", description="Target batch or order ID")
    drug_id: str = Field(default="DRUG-004", description="Target drug ID")
    temperature_c: float = Field(..., description="Temperature reading in °C")
    humidity_percent: float = Field(default=45.0, description="Relative humidity %")
    vibration_g: float = Field(default=0.02, description="Vibration g-force")
    light_lux: float = Field(default=100.0, description="Ambient light level in Lux")

class TelemetrySimulationRequest(BaseModel):
    scenario: TelemetryScenario = Field(default=TelemetryScenario.NORMAL, description="Simulation scenario")
    drug_id: str = Field(default="DRUG-004", description="Target drug ID")
    batch_id: str = Field(default="BATCH-001", description="Target batch ID")
    shipment_id: str = Field(default="SHP-LIVE-101", description="Target shipment ID")
    steps: int = Field(default=10, ge=1, le=50, description="Number of sensor readings to generate")

class RiskPredictionRequest(BaseModel):
    drug_id: str = Field(default="DRUG-004", description="Target drug formulation ID")
    batch_id: str = Field(default="BATCH-001", description="Target batch ID")
    readings: List[TelemetryReading] = Field(..., description="Chronological sensor readings stream")

class RiskPredictionResponse(BaseModel):
    status: PredictiveStatusType
    current_condition: ConditionStatusType
    current_temperature: float
    current_humidity: float
    predicted_breach: bool
    predicted_breach_in_minutes: Optional[int] = None
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Statistical risk index between 0 and 1")
    risk_factors: List[str] = Field(default_factory=list)
    requires_human_review: bool = False
    usable_quantity_factor: float = Field(default=1.0, description="1.0 for safe, 0.0 for quarantined stock")
    model_used: str = "LinearRegression+ThermalInertia-v1"
    readings_count: int = 0
    recommended_action: str = "CONTINUE_MONITORING"
