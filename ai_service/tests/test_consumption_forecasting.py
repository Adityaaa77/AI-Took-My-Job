import pytest
import os
import math
import asyncio
from app.forecasting import (
    ConsumptionForecastSchema,
    SufficiencyDetector,
    DataLoader,
    ForecastingEvaluator,
    BaselineMovingAverageModel,
    LinearLagRegressionModel,
    RandomForestTimeSeriesModel,
    AnomalyAndTrendDetector,
    ConsumptionIntelligenceService,
)
from app.schemas import SupplyChainSnapshotPayload, DrugSchema, InventoryItemSchema, ConsumptionRecordSchema
from app.pipeline import MultiAgentOrchestrator
from app.core import BaseSLMProvider


class DummySLMProvider(BaseSLMProvider):
    async def generate(self, prompt: str, system_prompt=None, format_json=False) -> str:
        return "Forecasting reasoning."

    async def generate_structured(self, prompt: str, response_schema, system_prompt=None, example_instance=None):
        if example_instance:
            try:
                return response_schema.model_validate(example_instance)
            except Exception:
                pass
        if hasattr(response_schema, "model_validate"):
            try:
                return response_schema(
                    agent_name="DummyAgent",
                    finding_type="insufficient_data",
                    severity="low",
                    description="Default dummy finding description.",
                    metrics={}
                )
            except Exception:
                pass
        return response_schema.model_construct()

    async def health_check(self) -> bool:
        return True


def test_1_dataset_metadata_exists():
    base_path = os.path.dirname(os.path.dirname(__file__))
    meta_path = os.path.join(base_path, "data", "external", "pharmaceutical_consumption", "metadata.json")
    assert os.path.exists(meta_path)


def test_2_data_loader_loads_external_reference():
    loader = DataLoader()
    values, unit, geo = loader.get_external_reference_series("DRUG-101", "Paracetamol 500mg")
    assert len(values) >= 10
    assert "DDD" in unit
    assert geo == "OECD Reference Benchmark"


def test_3_sufficiency_detector_local_vs_fallback():
    detector = SufficiencyDetector(min_history_points=6)
    
    # Sufficient history (6 points)
    sufficient_meta = detector.evaluate_sufficiency([10.0, 12.0, 14.0, 15.0, 18.0, 20.0])
    assert sufficient_meta.data_source == "LOCAL_HOSPITAL_DATA"
    assert sufficient_meta.data_sufficiency == "SUFFICIENT"
    assert sufficient_meta.fallback_used is False

    # Insufficient history (2 points)
    insufficient_meta = detector.evaluate_sufficiency([10.0, 12.0])
    assert insufficient_meta.data_source == "EXTERNAL_REFERENCE_DATA"
    assert insufficient_meta.data_sufficiency == "INSUFFICIENT_LOCAL_HISTORY"
    assert insufficient_meta.fallback_used is True


def test_4_models_chronological_evaluation_and_metric_driven_selection():
    evaluator = ForecastingEvaluator()
    series = [10.0, 12.0, 15.0, 18.0, 22.0, 25.0, 30.0, 35.0]
    
    win_model, predictions, metrics = evaluator.evaluate_and_select_best_model(series, forecast_horizon=4)
    assert win_model is not None
    assert len(predictions) == 4
    assert metrics.mae >= 0.0
    assert metrics.rmse >= 0.0
    assert all(not math.isnan(p) for p in predictions)


def test_5_anomaly_detector():
    detector = AnomalyAndTrendDetector()
    
    # Normal series
    trend, is_anomaly, a_type, z = detector.analyze_trend_and_anomalies([10, 11, 10, 12, 11], [12, 11])
    assert is_anomaly is False

    # Spike series
    trend_spike, is_spike, spike_type, z_spike = detector.analyze_trend_and_anomalies([10, 10, 10, 10], [50, 60])
    assert is_spike is True
    assert spike_type == "SUDDEN_SPIKE"


@pytest.mark.asyncio
async def test_6_consumption_service_unit_integrity_and_schema():
    service = ConsumptionIntelligenceService()
    
    # Snapshot with sparse local history -> triggers OECD fallback with DDD unit
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-FC-01",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol 500mg", category="Analgesic", unit="tablets")],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-001", drug_id="DRUG-101", period_start="2026-01-01", period_end="2026-01-30", quantity_consumed=40, daily_avg_consumption=1.33)
        ]
    )
    
    forecast = await service.generate_consumption_forecast(snapshot, "DRUG-101", "Paracetamol 500mg", "HOSP-001")
    assert isinstance(forecast, ConsumptionForecastSchema)
    assert forecast.data_source == "EXTERNAL_REFERENCE_DATA"
    assert forecast.is_hospital_specific is False
    assert "DDD" in forecast.measurement_unit


@pytest.mark.asyncio
async def test_7_pipeline_and_coordinator_with_forecasting():
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-FC-02",
        drugs=[DrugSchema(drug_id="DRUG-505", name="Meropenem 1g", category="Antibiotic", unit="vials", min_safety_stock=500)],
        inventories=[InventoryItemSchema(location_id="HOSP-001", location_type="hospital", drug_id="DRUG-505", available_stock=0)],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-001", drug_id="DRUG-505", period_start="2026-01-01", period_end="2026-01-30", quantity_consumed=20, daily_avg_consumption=0.66)
        ]
    )
    slm = DummySLMProvider()
    orchestrator = MultiAgentOrchestrator(slm_provider=slm)
    state = await orchestrator.run(snapshot)
    
    assert state["agent_statuses"]["CoordinatorAgent"] == "success"
    assert state["coordinator_recommendation"] is not None
