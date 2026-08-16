import asyncio
from datetime import date
import sys
import os

# Add root ai_service path to sys.path so script can be run directly from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.agents import DistributionAgent
from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    BatchSchema,
    AgentFindingSchema,
)

async def run_distribution_agent_real_test():
    print("=" * 75)
    print("STAGE 8: DISTRIBUTION AGENT REAL SLM INFERENCE TEST")
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

    # Step 2: Construct Real-World Operational Snapshot with 2 Hospitals
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-DIST-001",
        drugs=[
            DrugSchema(
                drug_id="DRUG-404",
                name="Ceftriaxone 1g",
                category="Antibiotic",
                unit="vials",
                is_critical=True,
                min_safety_stock=200
            )
        ],
        inventories=[
            # Hospital-A (Surplus Source): 1200 vials available / 20 vials daily usage = 60 days supply
            InventoryItemSchema(
                location_id="HOSP-CENTRAL-HUB",
                location_type="hospital",
                drug_id="DRUG-404",
                available_stock=1200,
                reserved_stock=100,
                batches=[
                    BatchSchema(
                        batch_id="BATCH-SAFE-1",
                        drug_id="DRUG-404",
                        manufacturer="GlobalPharma",
                        quantity=1200,
                        expiry_date=date(2027, 6, 30),
                        quality_status="passed"
                    )
                ]
            ),
            # Hospital-B (Deficit Destination): 60 vials available / 30 vials daily usage = 2 days supply
            InventoryItemSchema(
                location_id="HOSP-RURAL-CLINIC",
                location_type="hospital",
                drug_id="DRUG-404",
                available_stock=60,
                reserved_stock=10
            )
        ],
        consumption_records=[
            ConsumptionRecordSchema(
                hospital_id="HOSP-CENTRAL-HUB",
                drug_id="DRUG-404",
                period_start=date(2026, 7, 1),
                period_end=date(2026, 7, 30),
                quantity_consumed=600,
                daily_avg_consumption=20.0
            ),
            ConsumptionRecordSchema(
                hospital_id="HOSP-RURAL-CLINIC",
                drug_id="DRUG-404",
                period_start=date(2026, 7, 1),
                period_end=date(2026, 7, 30),
                quantity_consumed=900,
                daily_avg_consumption=30.0
            )
        ]
    )

    print("\n[Step 2] Executing DistributionAgent.analyze(snapshot)...")
    agent = DistributionAgent(
        slm_provider=slm_provider,
        surplus_threshold_days=30.0,
        deficit_threshold_days=7.0,
        target_coverage_days=14.0
    )
    findings = await agent.analyze(snapshot)

    print(f"\n[SUCCESS] DistributionAgent completed analysis! Returned {len(findings)} findings.")
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

    print("STAGE 8 DISTRIBUTION AGENT REAL INFERENCE TEST PASSED! ✅")
    print("=" * 75)

if __name__ == "__main__":
    asyncio.run(run_distribution_agent_real_test())
