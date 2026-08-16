import asyncio
from datetime import date, datetime
import sys
import os

# Add root ai_service path to sys.path so script can be run directly from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.agents import ProcurementAgent
from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    ShipmentSchema,
    AgentFindingSchema,
)

async def run_procurement_agent_real_test():
    print("=" * 75)
    print("STAGE 7: PROCUREMENT AGENT REAL SLM INFERENCE TEST")
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

    # Step 2: Construct Real-World Operational Snapshot for Procurement Requirement
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-PROC-001",
        drugs=[
            DrugSchema(
                drug_id="DRUG-303",
                name="Ciprofloxacin 500mg",
                category="Antibiotic",
                unit="tablets",
                is_critical=True,
                min_safety_stock=500 # Explicit safety stock threshold
            )
        ],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-TERTIARY-SOUTH",
                location_type="hospital",
                drug_id="DRUG-303",
                available_stock=150,
                reserved_stock=30,
                incoming_stock=100 # In-transit shipment
            )
        ],
        consumption_records=[
            ConsumptionRecordSchema(
                hospital_id="HOSP-TERTIARY-SOUTH",
                drug_id="DRUG-303",
                period_start=date(2026, 7, 1),
                period_end=date(2026, 7, 30),
                quantity_consumed=1200,
                daily_avg_consumption=40.0
            )
        ],
        shipments=[
            ShipmentSchema(
                shipment_id="SHIP-808",
                order_id="PO-404",
                origin_id="WAREHOUSE-CENTRAL",
                destination_id="HOSP-TERTIARY-SOUTH",
                drug_id="DRUG-303",
                quantity=100,
                status="in_transit",
                estimated_arrival=datetime(2026, 8, 19, 11, 0)
            )
        ]
    )

    print("\n[Step 2] Executing ProcurementAgent.analyze(snapshot)...")
    agent = ProcurementAgent(slm_provider=slm_provider, target_coverage_days=14)
    findings = await agent.analyze(snapshot)

    print(f"\n[SUCCESS] ProcurementAgent completed analysis! Returned {len(findings)} findings.")
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

    print("STAGE 7 PROCUREMENT AGENT REAL INFERENCE TEST PASSED! ✅")
    print("=" * 75)

if __name__ == "__main__":
    asyncio.run(run_procurement_agent_real_test())
