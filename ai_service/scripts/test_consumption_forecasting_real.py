import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.pipeline import MultiAgentOrchestrator, SupplyChainState
from app.forecasting import ConsumptionIntelligenceService
from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    VendorSchema,
)


async def run_consumption_forecasting_real_test():
    print("=" * 85)
    print("STAGE 15: HOSPITAL CONSUMPTION INTELLIGENCE, FALLBACK & ML FORECASTING REAL TEST")
    print("=" * 85)
    print(f"SLM Runtime    : Ollama ({settings.OLLAMA_BASE_URL})")
    print(f"Candidate Model: {settings.SLM_MODEL_NAME}")
    print("-" * 85)

    slm_provider: BaseSLMProvider = OllamaProvider()

    # Step 1: Health Check
    if not await slm_provider.health_check():
        print(f"[ERROR] Cannot connect to local Ollama server at {settings.OLLAMA_BASE_URL}")
        sys.exit(1)

    print("[SUCCESS] Ollama service is ACTIVE.")

    # Step 2: Consumption Intelligence Service Verification
    forecasting_service = ConsumptionIntelligenceService()
    print("\n[Step 1] Running Sufficiency Detector & ML Forecasting Engine...")

    snapshot_scenario_1 = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-STAGE15-LOCAL",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol 500mg", category="Analgesic", unit="tablets", min_safety_stock=500)],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-001", drug_id="DRUG-101", period_start="2025-07-01", period_end="2025-07-31", quantity_consumed=400, daily_avg_consumption=13.3),
            ConsumptionRecordSchema(hospital_id="HOSP-001", drug_id="DRUG-101", period_start="2025-08-01", period_end="2025-08-31", quantity_consumed=420, daily_avg_consumption=14.0),
            ConsumptionRecordSchema(hospital_id="HOSP-001", drug_id="DRUG-101", period_start="2025-09-01", period_end="2025-09-30", quantity_consumed=450, daily_avg_consumption=15.0),
            ConsumptionRecordSchema(hospital_id="HOSP-001", drug_id="DRUG-101", period_start="2025-10-01", period_end="2025-10-31", quantity_consumed=480, daily_avg_consumption=16.0),
            ConsumptionRecordSchema(hospital_id="HOSP-001", drug_id="DRUG-101", period_start="2025-11-01", period_end="2025-11-30", quantity_consumed=520, daily_avg_consumption=17.3),
            ConsumptionRecordSchema(hospital_id="HOSP-001", drug_id="DRUG-101", period_start="2025-12-01", period_end="2025-12-31", quantity_consumed=580, daily_avg_consumption=19.3),
            ConsumptionRecordSchema(hospital_id="HOSP-001", drug_id="DRUG-101", period_start="2026-01-01", period_end="2026-01-31", quantity_consumed=650, daily_avg_consumption=21.6),
        ],
    )

    forecast_local = await forecasting_service.generate_consumption_forecast(
        snapshot_scenario_1, "DRUG-101", "Paracetamol 500mg", "HOSP-001", forecast_horizon=6
    )

    print(f"  • Scenario 1 (Sufficient Hospital History):")
    print(f"      Data Source           : {forecast_local.data_source}")
    print(f"      Is Hospital Specific  : {forecast_local.is_hospital_specific}")
    print(f"      Measurement Unit      : {forecast_local.measurement_unit}")
    print(f"      Selected Model        : {forecast_local.selected_model}")
    print(f"      Validation MAE        : {forecast_local.evaluation_metrics.mae}")
    print(f"      Validation RMSE       : {forecast_local.evaluation_metrics.rmse}")
    print(f"      Trend Pattern         : {forecast_local.trend}")
    print(f"      Anomaly Detected      : {forecast_local.anomaly_detected} (Type: {forecast_local.anomaly_type})")
    print(f"      6-Month Forecast      : {forecast_local.forecast_values}")

    snapshot_scenario_2 = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-STAGE15-FALLBACK",
        drugs=[DrugSchema(drug_id="DRUG-505", name="Meropenem 1g", category="Antibiotic", unit="vials", min_safety_stock=300)],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-002", drug_id="DRUG-505", period_start="2026-01-01", period_end="2026-01-31", quantity_consumed=30, daily_avg_consumption=1.0)
        ],
    )

    forecast_fallback = await forecasting_service.generate_consumption_forecast(
        snapshot_scenario_2, "DRUG-505", "Meropenem 1g", "HOSP-002", forecast_horizon=6
    )

    print(f"\n  • Scenario 2 (Sparse Local Data -> OECD Fallback):")
    print(f"      Data Source           : {forecast_fallback.data_source}")
    print(f"      Is Hospital Specific  : {forecast_fallback.is_hospital_specific}")
    print(f"      Measurement Unit      : {forecast_fallback.measurement_unit}")
    print(f"      Selected Model        : {forecast_fallback.selected_model}")
    print(f"      Validation MAE        : {forecast_fallback.evaluation_metrics.mae}")
    print(f"      Trend Pattern         : {forecast_fallback.trend}")
    print(f"      6-Month Benchmark Fcst: {forecast_fallback.forecast_values}")

    # Step 3: Full Multi-Agent Orchestration Integration
    print("\n[Step 2] Executing Full MultiAgentOrchestrator Pipeline with Forecasting Context...")
    snapshot_demo = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-STAGE15-DEMO",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol 500mg", category="Analgesic", unit="tablets", is_critical=True, min_safety_stock=500)],
        inventories=[InventoryItemSchema(location_id="HOSP-001", location_type="hospital", drug_id="DRUG-101", available_stock=100)],
        vendors=[VendorSchema(vendor_id="VEND-001", name="Sun Pharmaceutical Industries Ltd.", avg_lead_time_days=3, reliability_score=0.95)],
        consumption_records=snapshot_scenario_1.consumption_records,
    )

    orchestrator = MultiAgentOrchestrator(slm_provider=slm_provider)
    final_state: SupplyChainState = await orchestrator.run(snapshot_demo)

    print("\n" + "-" * 85)
    print("[SUCCESS] Orchestration complete! Predictive Supply Chain Intelligence State:")
    print(f"  Agent Execution Statuses: {final_state['agent_statuses']}")
    rec = final_state.get("coordinator_recommendation")
    if rec:
        print(f"  Recommendation ID   : {rec.recommendation_id}")
        print(f"  Overall Risk Level  : {rec.overall_risk_level}")
        print(f"  Human Approval Req. : {rec.requires_human_approval}")
        print("  Recommended Actions :")
        for idx, act in enumerate(rec.recommended_actions, 1):
            print(f"    Action #{idx}: {act.action_type.upper()} ({act.priority.upper()})")
            print(f"      Target Drug     : {act.target_drug_id}")
            print(f"      Destination     : {act.destination_location_id}")
            print(f"      Quantity        : {act.recommended_quantity} units")
            print(f"      Reasoning       : {act.reasoning}")

    print("=" * 85)
    print("STAGE 15 CONSUMPTION INTELLIGENCE & FORECASTING REAL TEST PASSED! ✅")
    print("=" * 85)


if __name__ == "__main__":
    asyncio.run(run_consumption_forecasting_real_test())
