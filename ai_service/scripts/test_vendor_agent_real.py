import asyncio
from datetime import datetime
import sys
import os

# Add root ai_service path to sys.path so script can be run directly from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.agents import VendorAgent
from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    VendorSchema,
    AgentFindingSchema,
)

async def run_vendor_agent_real_test():
    print("=" * 80)
    print("STAGE 11: VENDOR AGENT REAL SLM INFERENCE TEST")
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

    # Step 2: Build Realistic Operational Snapshot Payload with Multiple Vendors
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-VEND-001",
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
        vendors=[
            # Primary High-Performing Vendor: Fast lead time (3 days), high reliability (95%)
            VendorSchema(
                vendor_id="VEND-MEDPHARMA",
                name="MedPharma Supplies Ltd",
                avg_lead_time_days=3,
                reliability_score=0.95,
                active_orders_count=2
            ),
            # Secondary Alternate Vendor: Slower lead time (14 days), lower reliability (82%)
            VendorSchema(
                vendor_id="VEND-GLOBALHEALTH",
                name="GlobalHealth Logistics",
                avg_lead_time_days=14,
                reliability_score=0.82,
                active_orders_count=5
            )
        ]
    )

    print("\n[Step 2] Executing VendorAgent.analyze(snapshot)...")
    agent = VendorAgent(slm_provider=slm_provider)
    findings = await agent.analyze(snapshot)

    print(f"\n[SUCCESS] Execution complete! Returned {len(findings)} finding(s):")
    print("-" * 80)

    for idx, f in enumerate(findings, 1):
        print(f"Finding #{idx}:")
        print(f"  Agent Name      : {f.agent_name}")
        print(f"  Finding Type    : {f.finding_type}")
        print(f"  Severity        : {f.severity.upper()}")
        print(f"  Target Drug ID  : {f.target_drug_id}")
        print(f"  Selected Vendor : {f.target_location_id}")
        print(f"  Description     : {f.description}")
        print(f"  Empirical Metrics:")
        for k, v in f.metrics.items():
            print(f"    - {k}: {v}")
        print("-" * 80)

    assert len(findings) == 1
    assert findings[0].finding_type == "vendor_recommended"
    assert findings[0].target_location_id == "VEND-MEDPHARMA"
    assert findings[0].metrics["recommended_vendor_id"] == "VEND-MEDPHARMA"

    print("STAGE 11 VENDOR AGENT REAL INFERENCE TEST PASSED! ✅")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_vendor_agent_real_test())
