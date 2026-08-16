import asyncio
from datetime import date, datetime
import sys
import os

# Add root ai_service path to sys.path so script can be run directly from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.agents import ComplianceAgent
from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    BatchSchema,
    AgentFindingSchema,
)

async def run_compliance_agent_real_test():
    print("=" * 80)
    print("STAGE 12: COMPLIANCE AGENT REAL SLM INFERENCE TEST")
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

    # Step 2: Construct Realistic Operational Snapshot Payload with Valid and Violation Batches
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-COMP-001",
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
            InventoryItemSchema(
                location_id="HOSP-HUB-NORTH",
                location_type="hospital",
                drug_id="DRUG-505",
                available_stock=1150,
                batches=[
                    # 1. Compliant batch (800 vials)
                    BatchSchema(
                        batch_id="BATCH-MERO-PASS",
                        drug_id="DRUG-505",
                        manufacturer="MedPharma",
                        quantity=800,
                        expiry_date=date(2028, 6, 30),
                        quality_status="passed"
                    ),
                    # 2. Expired batch violation (200 vials)
                    BatchSchema(
                        batch_id="BATCH-MERO-EXPIRED",
                        drug_id="DRUG-505",
                        manufacturer="MedPharma",
                        quantity=200,
                        expiry_date=date(2024, 1, 15), # Expired date!
                        quality_status="passed"
                    ),
                    # 3. Quarantined quality violation (150 vials)
                    BatchSchema(
                        batch_id="BATCH-MERO-QUARANTINE",
                        drug_id="DRUG-505",
                        manufacturer="MedPharma",
                        quantity=150,
                        expiry_date=date(2027, 12, 31),
                        quality_status="quarantine" # Quality quarantine!
                    )
                ]
            )
        ]
    )

    print("\n[Step 2] Executing ComplianceAgent.analyze(snapshot)...")
    agent = ComplianceAgent(slm_provider=slm_provider)
    findings = await agent.analyze(snapshot)

    print(f"\n[SUCCESS] Execution complete! Returned {len(findings)} finding(s):")
    print("-" * 80)

    for idx, f in enumerate(findings, 1):
        print(f"Finding #{idx}:")
        print(f"  Agent Name      : {f.agent_name}")
        print(f"  Finding Type    : {f.finding_type}")
        print(f"  Severity        : {f.severity.upper()}")
        print(f"  Target Drug ID  : {f.target_drug_id}")
        print(f"  Location ID     : {f.target_location_id}")
        print(f"  Description     : {f.description}")
        print(f"  Empirical Metrics:")
        for k, v in f.metrics.items():
            print(f"    - {k}: {v}")
        print("-" * 80)

    assert len(findings) == 1
    assert findings[0].finding_type == "batch_compliance_failed"
    assert findings[0].metrics["expired_batch_count"] == 1
    assert findings[0].metrics["quarantined_batch_count"] == 1
    assert findings[0].metrics["non_compliant_stock_quantity"] == 350

    print("STAGE 12 COMPLIANCE AGENT REAL INFERENCE TEST PASSED! ✅")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_compliance_agent_real_test())
