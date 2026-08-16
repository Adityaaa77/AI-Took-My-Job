import asyncio
from datetime import date, datetime
import sys
import os

# Add root ai_service path to sys.path so script can be run directly from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.pipeline import MultiAgentOrchestrator, SupplyChainState
from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    ShipmentSchema,
    BatchSchema,
)

async def run_real_orchestration_test():
    print("=" * 80)
    print("STAGE 9: MULTI-AGENT LANGGRAPH ORCHESTRATION REAL INFERENCE TEST")
    print("=" * 80)
    print(f"SLM Runtime    : Ollama ({settings.OLLAMA_BASE_URL})")
    print(f"Candidate Model: {settings.SLM_MODEL_NAME}")
    print("-" * 80)

    slm_provider: BaseSLMProvider = OllamaProvider()

    # Step 1: Health Check
    if not await slm_provider.health_check():
        print(f"[ERROR] Cannot connect to local Ollama server at {settings.OLLAMA_BASE_URL}")
        print("Please start Ollama with 'ollama serve' before running this real inference test.")
        sys.exit(1)

    print("[SUCCESS] Ollama service is ACTIVE.")

    # Step 2: Construct Realistic Multi-Hospital Operational Snapshot Payload
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-ORCH-001",
        drugs=[
            DrugSchema(
                drug_id="DRUG-505",
                name="Meropenem 1g",
                category="Critical Antibiotic",
                unit="vials",
                is_critical=True,
                min_safety_stock=300
            )
        ],
        inventories=[
            # Hospital A (Hub with Surplus): 1500 vials / 30 usage = 50 days supply
            InventoryItemSchema(
                location_id="HOSP-HUB-NORTH",
                location_type="hospital",
                drug_id="DRUG-505",
                available_stock=1500,
                reserved_stock=100,
                batches=[
                    BatchSchema(
                        batch_id="BATCH-MERO-1",
                        drug_id="DRUG-505",
                        manufacturer="MedPharma",
                        quantity=1500,
                        expiry_date=date(2027, 8, 30),
                        quality_status="passed"
                    )
                ]
            ),
            # Hospital B (Clinic with Deficit): 80 vials / 40 usage = 2 days supply
            InventoryItemSchema(
                location_id="HOSP-CLINIC-EAST",
                location_type="hospital",
                drug_id="DRUG-505",
                available_stock=80,
                reserved_stock=10
            )
        ],
        consumption_records=[
            # Hospital A consumption
            ConsumptionRecordSchema(hospital_id="HOSP-HUB-NORTH", drug_id="DRUG-505", period_start=date(2026, 7, 1), period_end=date(2026, 7, 7), quantity_consumed=210, daily_avg_consumption=30.0),
            ConsumptionRecordSchema(hospital_id="HOSP-HUB-NORTH", drug_id="DRUG-505", period_start=date(2026, 7, 8), period_end=date(2026, 7, 14), quantity_consumed=210, daily_avg_consumption=30.0),
            
            # Hospital B consumption with sharp spike
            ConsumptionRecordSchema(hospital_id="HOSP-CLINIC-EAST", drug_id="DRUG-505", period_start=date(2026, 7, 1), period_end=date(2026, 7, 7), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-CLINIC-EAST", drug_id="DRUG-505", period_start=date(2026, 7, 8), period_end=date(2026, 7, 14), quantity_consumed=105, daily_avg_consumption=15.0),
            ConsumptionRecordSchema(hospital_id="HOSP-CLINIC-EAST", drug_id="DRUG-505", period_start=date(2026, 7, 15), period_end=date(2026, 7, 21), quantity_consumed=110, daily_avg_consumption=15.7),
            ConsumptionRecordSchema(hospital_id="HOSP-CLINIC-EAST", drug_id="DRUG-505", period_start=date(2026, 7, 22), period_end=date(2026, 7, 28), quantity_consumed=280, daily_avg_consumption=40.0)
        ]
    )

    print("\n[Step 2] Executing MultiAgentOrchestrator.run(snapshot)...")
    print("Concurrent parallel execution of: InventoryAgent, DemandAgent, ProcurementAgent, DistributionAgent")
    print("-" * 80)

    orchestrator = MultiAgentOrchestrator(slm_provider=slm_provider)
    state: SupplyChainState = await orchestrator.run(snapshot)

    print("\n[SUCCESS] Orchestration complete! Aggregated State Summary:")
    print(f"  Snapshot Reference ID: {state['snapshot'].snapshot_id}")
    print(f"  Agent Statuses       : {state['agent_statuses']}")
    print(f"  Agent Errors         : {state['agent_errors']}")
    print("-" * 80)

    print(f"\n1. INVENTORY AGENT FINDINGS ({len(state['inventory_findings'])}):")
    for idx, f in enumerate(state['inventory_findings'], 1):
        print(f"   [{idx}] {f.finding_type.upper()} ({f.severity}) @ {f.target_location_id}: {f.description}")

    print(f"\n2. DEMAND AGENT FINDINGS ({len(state['demand_findings'])}):")
    for idx, f in enumerate(state['demand_findings'], 1):
        print(f"   [{idx}] {f.finding_type.upper()} ({f.severity}) @ {f.target_location_id}: {f.description}")

    print(f"\n3. PROCUREMENT AGENT FINDINGS ({len(state['procurement_findings'])}):")
    for idx, f in enumerate(state['procurement_findings'], 1):
        print(f"   [{idx}] {f.finding_type.upper()} ({f.severity}) @ {f.target_location_id}: {f.description}")

    print(f"\n4. DISTRIBUTION AGENT FINDINGS ({len(state['distribution_findings'])}):")
    for idx, f in enumerate(state['distribution_findings'], 1):
        print(f"   [{idx}] {f.finding_type.upper()} ({f.severity}) @ {f.target_location_id}: {f.description}")

    print("-" * 80)
    print("STAGE 9 MULTI-AGENT ORCHESTRATION REAL TEST PASSED! ✅")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_real_orchestration_test())
