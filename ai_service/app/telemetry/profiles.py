# ai_service/app/telemetry/profiles.py
from typing import Dict, Optional
from pydantic import BaseModel, Field

class StorageConditionProfile(BaseModel):
    drug_id: str
    drug_name: str
    min_temperature_c: float = Field(default=2.0, description="Minimum safe storage temperature in °C")
    max_temperature_c: float = Field(default=8.0, description="Maximum safe storage temperature in °C")
    max_humidity_percent: float = Field(default=60.0, description="Maximum allowed relative humidity %")
    max_vibration_g: float = Field(default=0.08, description="Maximum allowed g-force vibration threshold")
    max_light_lux: float = Field(default=300.0, description="Maximum allowed ambient light lux exposure")
    is_cold_chain: bool = Field(default=True, description="Requires strict refrigerated cold-chain")
    storage_category: str = Field(default="REFRIGERATED_2_TO_8C", description="WHO storage classification")

# Centralized drug formulation condition profiles registry
DRUG_CONDITION_PROFILES: Dict[str, StorageConditionProfile] = {
    "DRUG-004": StorageConditionProfile(
        drug_id="DRUG-004",
        drug_name="Propofol 1% IV Emulsion",
        min_temperature_c=2.0,
        max_temperature_c=8.0,
        max_humidity_percent=55.0,
        max_vibration_g=0.05,
        max_light_lux=200.0,
        is_cold_chain=True,
        storage_category="REFRIGERATED_2_TO_8C"
    ),
    "DRUG-001": StorageConditionProfile(
        drug_id="DRUG-001",
        drug_name="Paracetamol 500mg Tablets",
        min_temperature_c=15.0,
        max_temperature_c=25.0,
        max_humidity_percent=65.0,
        max_vibration_g=0.20,
        max_light_lux=500.0,
        is_cold_chain=False,
        storage_category="CONTROLLED_ROOM_TEMP_15_TO_25C"
    ),
    "DRUG-101": StorageConditionProfile(
        drug_id="DRUG-101",
        drug_name="Paracetamol 500mg Tablets",
        min_temperature_c=15.0,
        max_temperature_c=25.0,
        max_humidity_percent=65.0,
        max_vibration_g=0.20,
        max_light_lux=500.0,
        is_cold_chain=False,
        storage_category="CONTROLLED_ROOM_TEMP_15_TO_25C"
    ),
    "DRUG-303": StorageConditionProfile(
        drug_id="DRUG-303",
        drug_name="Amoxicillin 250mg Suspension",
        min_temperature_c=2.0,
        max_temperature_c=8.0,
        max_humidity_percent=50.0,
        max_vibration_g=0.06,
        max_light_lux=250.0,
        is_cold_chain=True,
        storage_category="REFRIGERATED_2_TO_8C"
    ),
    "DEFAULT": StorageConditionProfile(
        drug_id="DEFAULT",
        drug_name="Essential Medicine",
        min_temperature_c=2.0,
        max_temperature_c=8.0,
        max_humidity_percent=60.0,
        max_vibration_g=0.08,
        max_light_lux=300.0,
        is_cold_chain=True,
        storage_category="REFRIGERATED_2_TO_8C"
    ),
}

def get_drug_condition_profile(drug_id: str) -> StorageConditionProfile:
    """Retrieve condition profile for a given drug_id, with fallback to DEFAULT."""
    clean_id = (drug_id or "").upper().strip()
    return DRUG_CONDITION_PROFILES.get(clean_id, DRUG_CONDITION_PROFILES["DEFAULT"])
