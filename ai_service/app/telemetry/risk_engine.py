# ai_service/app/telemetry/risk_engine.py
import math
from typing import List, Tuple
from app.telemetry.schemas import (
    TelemetryReading,
    RiskPredictionRequest,
    RiskPredictionResponse,
    ConditionStatusType,
    PredictiveStatusType,
)
from app.telemetry.profiles import get_drug_condition_profile, StorageConditionProfile

def calculate_linear_slope(temps: List[float]) -> float:
    """Calculates temperature rate of change (slope per step) using linear regression."""
    n = len(temps)
    if n < 2:
        return 0.0
    x_mean = (n - 1) / 2.0
    y_mean = sum(temps) / float(n)
    numerator = sum((i - x_mean) * (temps[i] - y_mean) for i in range(n))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    if denominator == 0:
        return 0.0
    return float(numerator / denominator)

def analyze_telemetry_risk(req: RiskPredictionRequest) -> RiskPredictionResponse:
    """
    Evaluates telemetry stream using statistical feature extraction and deterministic safety interlocks.
    """
    profile = get_drug_condition_profile(req.drug_id)
    readings = req.readings

    if not readings or len(readings) == 0:
        return RiskPredictionResponse(
            status=PredictiveStatusType.INSUFFICIENT_DATA,
            current_condition=ConditionStatusType.SAFE,
            current_temperature=5.0,
            current_humidity=45.0,
            predicted_breach=False,
            predicted_breach_in_minutes=None,
            risk_score=0.0,
            risk_factors=["No telemetry readings provided."],
            requires_human_review=False,
            usable_quantity_factor=1.0,
            readings_count=0,
            recommended_action="AWAITING_TELEMETRY",
        )

    if len(readings) < 2:
        latest = readings[-1]
        is_safe = profile.min_temperature_c <= latest.temperature_c <= profile.max_temperature_c
        return RiskPredictionResponse(
            status=PredictiveStatusType.INSUFFICIENT_DATA,
            current_condition=ConditionStatusType.SAFE if is_safe else ConditionStatusType.BREACH,
            current_temperature=latest.temperature_c,
            current_humidity=latest.humidity_percent,
            predicted_breach=False,
            predicted_breach_in_minutes=None,
            risk_score=0.1 if is_safe else 0.9,
            risk_factors=["Single sensor reading available; baseline trend requires 2+ points."],
            requires_human_review=not is_safe,
            usable_quantity_factor=1.0 if is_safe else 0.0,
            readings_count=len(readings),
            recommended_action="CONTINUE_MONITORING" if is_safe else "QUARANTINE_BATCH",
        )

    # Extract time-series feature metrics using standard library math
    temps = [r.temperature_c for r in readings]
    humidities = [r.humidity_percent for r in readings]
    latest_temp = temps[-1]
    latest_humidity = humidities[-1]
    latest_vibration = readings[-1].vibration_g
    latest_light = readings[-1].light_lux

    slope = calculate_linear_slope(temps)

    risk_factors: List[str] = []

    # -------------------------------------------------------------------------
    # 1. Deterministic Current Condition Classification (Authoritative)
    # -------------------------------------------------------------------------
    temp_excursion = (latest_temp < profile.min_temperature_c) or (latest_temp > profile.max_temperature_c)
    humidity_excursion = latest_humidity > profile.max_humidity_percent
    vibration_excursion = latest_vibration > profile.max_vibration_g
    light_excursion = latest_light > profile.max_light_lux

    if temp_excursion or humidity_excursion:
        if latest_temp > (profile.max_temperature_c + 5.0) or latest_temp < (profile.min_temperature_c - 3.0):
            current_cond = ConditionStatusType.CRITICAL
            risk_factors.append(f"EXTREME_TEMP_EXCURSION: Current {latest_temp}°C exceeds boundary ({profile.min_temperature_c}°C - {profile.max_temperature_c}°C)")
        else:
            current_cond = ConditionStatusType.BREACH
            risk_factors.append(f"TEMP_OR_HUMIDITY_BREACH: Temp {latest_temp}°C, Humidity {latest_humidity}%")
    elif (latest_temp >= profile.max_temperature_c - 1.0) or (latest_temp <= profile.min_temperature_c + 0.5):
        current_cond = ConditionStatusType.WARNING
        risk_factors.append(f"BOUNDARY_APPROACH: Temp {latest_temp}°C is near threshold boundary")
    else:
        current_cond = ConditionStatusType.SAFE

    # -------------------------------------------------------------------------
    # 2. Predictive Condition Status & Risk Modeling (Advisory)
    # -------------------------------------------------------------------------
    predicted_breach = False
    predicted_breach_min = None
    pred_status = PredictiveStatusType.STABLE

    # Check recovery pattern
    if len(temps) >= 4 and temps[0] > profile.max_temperature_c and slope < -0.3 and current_cond == ConditionStatusType.SAFE:
        pred_status = PredictiveStatusType.RECOVERING
        risk_factors.append("THERMAL_RECOVERY_DETECTED: Temperature returning towards safe baseline")

    elif current_cond in [ConditionStatusType.BREACH, ConditionStatusType.CRITICAL]:
        pred_status = PredictiveStatusType.PREDICTED_BREACH
        predicted_breach = True
        predicted_breach_min = 0

    elif slope > 0.15:  # Temperature rising rapidly
        distance_to_boundary = profile.max_temperature_c - latest_temp
        if distance_to_boundary > 0 and slope > 0:
            steps_to_breach = distance_to_boundary / slope
            minutes_to_breach = int(max(1, round(steps_to_breach * 0.5)))
            if minutes_to_breach <= 15:
                pred_status = PredictiveStatusType.PREDICTED_BREACH
                predicted_breach = True
                predicted_breach_min = minutes_to_breach
                risk_factors.append(f"PREDICTED_THERMAL_EXCURSION: Rate +{slope:.2f}°C/step, predicted breach in ~{minutes_to_breach} mins")
            else:
                pred_status = PredictiveStatusType.DRIFTING
                risk_factors.append(f"UPWARD_THERMAL_DRIFT: Temp rising at +{slope:.2f}°C/step")
        else:
            pred_status = PredictiveStatusType.DRIFTING
            risk_factors.append("UPWARD_THERMAL_DRIFT: Temperature rising trend")

    elif slope < -0.15 and latest_temp < profile.min_temperature_c + 1.5:  # Cooling towards freezing
        distance_to_lower = latest_temp - profile.min_temperature_c
        if distance_to_lower > 0:
            steps_to_freeze = distance_to_lower / abs(slope)
            minutes_to_freeze = int(max(1, round(steps_to_freeze * 0.5)))
            if minutes_to_freeze <= 15:
                pred_status = PredictiveStatusType.PREDICTED_BREACH
                predicted_breach = True
                predicted_breach_min = minutes_to_freeze
                risk_factors.append(f"PREDICTED_FREEZE_EXCURSION: Rate {slope:.2f}°C/step, predicted freeze in ~{minutes_to_freeze} mins")
            else:
                pred_status = PredictiveStatusType.DRIFTING
                risk_factors.append("DOWNWARD_FREEZE_DRIFT: Temperature dropping towards freezing threshold")

    # Calculate Statistical Risk Score (0.0 to 1.0)
    norm_dist = abs(latest_temp - (profile.min_temperature_c + profile.max_temperature_c) / 2.0) / (profile.max_temperature_c - profile.min_temperature_c)
    base_risk = min(1.0, norm_dist * 1.2)
    slope_penalty = min(0.3, max(0.0, abs(slope) * 0.5))
    hum_penalty = 0.2 if humidity_excursion else 0.0
    vib_penalty = 0.1 if vibration_excursion else 0.0

    risk_score = round(min(1.0, max(0.0, base_risk + slope_penalty + hum_penalty + vib_penalty)), 2)

    # -------------------------------------------------------------------------
    # 3. Deterministic Safety Interlock Decision (Authoritative)
    # -------------------------------------------------------------------------
    if current_cond in [ConditionStatusType.BREACH, ConditionStatusType.CRITICAL]:
        usable_qty_factor = 0.0
        requires_human = True
        recommended_action = "QUARANTINE_BATCH_AND_REROUTE"
    elif pred_status == PredictiveStatusType.PREDICTED_BREACH:
        usable_qty_factor = 1.0
        requires_human = True
        recommended_action = "PREVENTIVE_COOLING_AND_HUMAN_REVIEW"
    elif current_cond == ConditionStatusType.WARNING or pred_status == PredictiveStatusType.DRIFTING:
        usable_qty_factor = 1.0
        requires_human = False
        recommended_action = "INCREASE_MONITORING_FREQUENCY"
    else:
        usable_qty_factor = 1.0
        requires_human = False
        recommended_action = "CONTINUE_NORMAL_OPERATIONS"

    return RiskPredictionResponse(
        status=pred_status,
        current_condition=current_cond,
        current_temperature=latest_temp,
        current_humidity=latest_humidity,
        predicted_breach=predicted_breach,
        predicted_breach_in_minutes=predicted_breach_min,
        risk_score=risk_score,
        risk_factors=risk_factors if risk_factors else ["All telemetry parameters within WHO cold-chain boundaries."],
        requires_human_review=requires_human,
        usable_quantity_factor=usable_qty_factor,
        model_used="LinearRegression+ThermalInertia-v1",
        readings_count=len(readings),
        recommended_action=recommended_action,
    )
