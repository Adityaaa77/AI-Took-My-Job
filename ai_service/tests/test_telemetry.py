# ai_service/tests/test_telemetry.py
import pytest
from app.telemetry.schemas import (
    TelemetrySimulationRequest,
    TelemetryScenario,
    RiskPredictionRequest,
    TelemetryReading,
    ConditionStatusType,
    PredictiveStatusType,
)
from app.telemetry.simulator import generate_telemetry_stream
from app.telemetry.risk_engine import analyze_telemetry_risk
from app.telemetry.profiles import get_drug_condition_profile

def test_drug_condition_profile_resolution():
    profile_propofol = get_drug_condition_profile("DRUG-004")
    assert profile_propofol.min_temperature_c == 2.0
    assert profile_propofol.max_temperature_c == 8.0
    assert profile_propofol.is_cold_chain is True

    profile_paracetamol = get_drug_condition_profile("DRUG-001")
    assert profile_paracetamol.min_temperature_c == 15.0
    assert profile_paracetamol.max_temperature_c == 25.0

    profile_unknown = get_drug_condition_profile("UNKNOWN-999")
    assert profile_unknown.min_temperature_c == 2.0
    assert profile_unknown.max_temperature_c == 8.0

def test_telemetry_simulator_scenarios():
    req_normal = TelemetrySimulationRequest(scenario=TelemetryScenario.NORMAL, drug_id="DRUG-004", steps=10)
    stream_normal = generate_telemetry_stream(req_normal)
    assert len(stream_normal) == 10
    for r in stream_normal:
        assert 2.0 <= r.temperature_c <= 8.0

    req_drift = TelemetrySimulationRequest(scenario=TelemetryScenario.GRADUAL_DRIFT, drug_id="DRUG-004", steps=10)
    stream_drift = generate_telemetry_stream(req_drift)
    assert stream_drift[-1].temperature_c > stream_drift[0].temperature_c

    req_compressor = TelemetrySimulationRequest(scenario=TelemetryScenario.COMPRESSOR_FAILURE, drug_id="DRUG-004", steps=10)
    stream_compressor = generate_telemetry_stream(req_compressor)
    assert stream_compressor[-1].temperature_c > 12.0

def test_risk_engine_normal():
    req_normal = TelemetrySimulationRequest(scenario=TelemetryScenario.NORMAL, drug_id="DRUG-004", steps=10)
    stream_normal = generate_telemetry_stream(req_normal)

    risk_req = RiskPredictionRequest(drug_id="DRUG-004", batch_id="BATCH-COLD-02", readings=stream_normal)
    analysis = analyze_telemetry_risk(risk_req)

    assert analysis.current_condition == ConditionStatusType.SAFE
    assert analysis.status == PredictiveStatusType.STABLE
    assert analysis.usable_quantity_factor == 1.0
    assert analysis.requires_human_review is False

def test_risk_engine_compressor_failure():
    req_compressor = TelemetrySimulationRequest(scenario=TelemetryScenario.COMPRESSOR_FAILURE, drug_id="DRUG-004", steps=10)
    stream_compressor = generate_telemetry_stream(req_compressor)

    risk_req = RiskPredictionRequest(drug_id="DRUG-004", batch_id="BATCH-COLD-02", readings=stream_compressor)
    analysis = analyze_telemetry_risk(risk_req)

    assert analysis.current_condition in [ConditionStatusType.BREACH, ConditionStatusType.CRITICAL]
    assert analysis.usable_quantity_factor == 0.0
    assert analysis.requires_human_review is True
    assert "QUARANTINE" in analysis.recommended_action

def test_risk_engine_insufficient_data():
    risk_req = RiskPredictionRequest(drug_id="DRUG-004", batch_id="BATCH-COLD-02", readings=[])
    analysis = analyze_telemetry_risk(risk_req)

    assert analysis.status == PredictiveStatusType.INSUFFICIENT_DATA
    assert analysis.readings_count == 0

def test_risk_engine_gradual_drift():
    req_drift = TelemetrySimulationRequest(scenario=TelemetryScenario.GRADUAL_DRIFT, drug_id="DRUG-004", steps=6)
    stream_drift = generate_telemetry_stream(req_drift)

    risk_req = RiskPredictionRequest(drug_id="DRUG-004", batch_id="BATCH-COLD-02", readings=stream_drift)
    analysis = analyze_telemetry_risk(risk_req)

    assert analysis.status in [PredictiveStatusType.DRIFTING, PredictiveStatusType.PREDICTED_BREACH]
    assert analysis.risk_score > 0.3
