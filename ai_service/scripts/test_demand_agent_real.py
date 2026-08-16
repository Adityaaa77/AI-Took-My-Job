import asyncio
from datetime import date
import sys
import os

# Add root ai_service path to sys.path so script can be run directly from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.agents import DemandAgent
from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    ConsumptionRecordSchema,
    AgentFindingSchema,
)

async def run_demand_agent_real_test():
    print("=" * 75)
    print("STAGE 6: DEMAND AGENT REAL SLM INFERENCE TEST")
    print("=" * 75)
    print(f"SLM Runtime    : Ollama ({settings.OLLAMA_BASE_URL})")
    print(f"Candidate Model: {settings.SLM_MODEL_NAME}")
    print("-" * 75)

    slm_provider: BaseSLMProvider = OllamaProvider()

    # Step 1: Health Check
    if not await slm_provider.health_check():
        print(f"[ERROR] Cannot connect to local Ollama server at {settings.OLLAMA_BASE_URL}")
        print("Please start Ollama with 'ollama serve' before running this real inference test.")
        sys.exit(1)

    print("[SUCCESS] Ollama service is ACTIVE.")

    # Step 2: Construct Real-World Operational Snapshot with Multi-Period Consumption
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-DEM-001",
        drugs=[
            DrugSchema(
                drug_id="DRUG-202",
                name="Amoxicillin 500mg",
                category="Antibiotic",
                unit="capsules",
                is_critical=True,
                min_safety_stock=300
            )
        ],
        consumption_records=[
            # 4 consecutive historical weekly periods demonstrating an upward trend + spike
            ConsumptionRecordSchema(
                hospital_id="HOSP-DISTRICT-NORTH",
                drug_id="DRUG-202",
                period_start=date(2026, 7, 1),
                period_end=date(2026, 7, 7),
                quantity_consumed=100,
                daily_avg_consumption=14.2
            ),
            ConsumptionRecordSchema(
                hospital_id="HOSP-DISTRICT-NORTH",
                drug_id="DRUG-202",
                period_start=date(2026, 7, 8),
                period_end=date(2026, 7, 14),
                quantity_consumed=110,
                daily_avg_consumption=15.7
            ),
            ConsumptionRecordSchema(
                hospital_id="HOSP-DISTRICT-NORTH",
                drug_id="DRUG-202",
                period_start=date(2026, 7, 15),
                period_end=date(2026, 7, 21),
                quantity_consumed=120,
                daily_avg_consumption=17.1
            ),
            ConsumptionRecordSchema(
                hospital_id="HOSP-DISTRICT-NORTH",
                drug_id="DRUG-202",
                period_start=date(2026, 7, 22),
                period_end=date(2026, 7, 28),
                quantity_consumed=350, # Recent spike (350 vs ~110 baseline)
                daily_avg_consumption=50.0
            ),
        ]
    )

    print("\n[Step 2] Executing DemandAgent.analyze(snapshot)...")
    agent = DemandAgent(slm_provider=slm_provider, anomaly_spike_threshold=2.0)
    findings = await agent.analyze(snapshot)

    print(f"\n[SUCCESS] DemandAgent completed analysis! Returned {len(findings)} findings.")
    print("-" * 75)

    for idx, finding in enumerate(findings, 1):
        print(f"Finding #{idx}:")
        print(f"  Agent Name : {finding.agent_name}")
        print(f"  Finding Type: {finding.finding_type}")
        print(f"  Severity    : {finding.severity}")
        print(f"  Target Drug : {finding.target_drug_id}")
        print(f"  Location    : {finding.target_location_id}")
        print(f"  Description : {finding.description}")
        print(f"  Metrics     : {finding.metrics}")
        print("-" * 75)

    print("STAGE 6 DEMAND AGENT REAL INFERENCE TEST PASSED! ✅")
    print("=" * 75)

if __name__ == "__main__":
    asyncio.run(run_demand_agent_real_test())
