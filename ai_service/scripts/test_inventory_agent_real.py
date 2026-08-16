import asyncio
from datetime import date, datetime
import sys
import os

# Add root ai_service path to sys.path so script can be run directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.agents import InventoryAgent
from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    ShipmentSchema,
    BatchSchema,
    AgentFindingSchema,
)

async def run_inventory_agent_real_test():
    print("=" * 75)
    print("STAGE 5: INVENTORY AGENT REAL SLM INFERENCE TEST")
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

    # Step 2: Construct Real-World Operational Snapshot
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-INV-001",
        drugs=[
            DrugSchema(
                drug_id="DRUG-101",
                name="Paracetamol 500mg",
                category="Analgesic",
                unit="tablets",
                is_critical=True,
                min_safety_stock=200
            )
        ],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-CITY-GEN",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=300,
                reserved_stock=50,
                incoming_stock=200,
                batches=[
                    BatchSchema(
                        batch_id="BATCH-99",
                        drug_id="DRUG-101",
                        manufacturer="PharmaCorp",
                        quantity=300,
                        expiry_date=date(2026, 9, 15), # Expiring soon
                        quality_status="passed"
                    )
                ]
            )
        ],
        consumption_records=[
            ConsumptionRecordSchema(
                hospital_id="HOSP-CITY-GEN",
                drug_id="DRUG-101",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 1, 30),
                quantity_consumed=1500,
                daily_avg_consumption=50.0 # 300 / 50 = 6 days of available supply!
            )
        ],
        shipments=[
            ShipmentSchema(
                shipment_id="SHIP-501",
                order_id="PO-101",
                origin_id="WAREHOUSE-NORTH",
                destination_id="HOSP-CITY-GEN",
                drug_id="DRUG-101",
                quantity=200,
                status="in_transit",
                estimated_arrival=datetime(2026, 8, 18, 14, 0)
            )
        ]
    )

    print("\n[Step 2] Executing InventoryAgent.analyze(snapshot)...")
    agent = InventoryAgent(slm_provider=slm_provider)
    findings = await agent.analyze(snapshot)

    print(f"\n[SUCCESS] InventoryAgent completed analysis! Returned {len(findings)} findings.")
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

    print("STAGE 5 INVENTORY AGENT REAL INFERENCE TEST PASSED! ✅")
    print("=" * 75)

if __name__ == "__main__":
    asyncio.run(run_inventory_agent_real_test())
