import asyncio
import sys
import os

# Add root ai_service path to sys.path so script can be run directly from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.pipeline import MultiAgentOrchestrator, SupplyChainState
from app.market_intelligence import MarketIntelligenceService, NPPAProvider
from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    ShipmentSchema,
    BatchSchema,
    VendorSchema,
)


async def run_market_intelligence_real_test():
    print("=" * 80)
    print("STAGE 14: REAL-WORLD DRUG MARKET INTELLIGENCE / RIGHT COST REAL TEST")
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

    # Step 2: Direct Market Intelligence Service Verification
    market_service = MarketIntelligenceService(providers=[NPPAProvider()])
    print("\n[Step 1] Querying Market Intelligence Provider (NPPA Registry)...")

    drugs_to_check = [
        ("DRUG-505", "Meropenem 1g"),
        ("DRUG-101", "Paracetamol 500mg"),
        ("DRUG-004", "Propofol 1% IV Emulsion"),
        ("DRUG-999", "Experimental Compound 99"),
    ]

    for d_id, d_name in drugs_to_check:
        ctx = await market_service.get_drug_market_context(d_id, d_name)
        print(f"  • {d_name} ({d_id}):")
        print(f"      Status: {ctx.data_status} | Price Available: {ctx.price_available}")
        if ctx.price_available:
            print(f"      Reference Price : {ctx.reference_price} {ctx.currency} ({ctx.reference_price_unit})")
            print(f"      Price Type      : {ctx.price_type}")
            print(f"      Source          : {ctx.source}")
            print(f"      Source Timestamp: {ctx.source_timestamp.strftime('%Y-%m-%d') if ctx.source_timestamp else 'N/A'}")
        else:
            print(f"      Notes           : {ctx.notes}")

    # Step 3: Operational Pipeline Integration
    print("\n[Step 2] Executing MultiAgentOrchestrator with Market Context...")
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-REAL-STAGE14-001",
        drugs=[
            DrugSchema(
                drug_id="DRUG-505",
                name="Meropenem 1g",
                category="Critical Antibiotic",
                unit="vials",
                is_critical=True,
                min_safety_stock=300,
            ),
            DrugSchema(
                drug_id="DRUG-101",
                name="Paracetamol 500mg",
                category="Analgesic",
                unit="tablets",
                is_critical=True,
                min_safety_stock=1000,
            ),
        ],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-CLINIC-EAST",
                location_type="hospital",
                drug_id="DRUG-505",
                available_stock=0,
                reserved_stock=0,
                incoming_stock=0,
            ),
            InventoryItemSchema(
                location_id="HOSP-CLINIC-EAST",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=0,
                reserved_stock=0,
                incoming_stock=0,
            ),
        ],
        vendors=[
            VendorSchema(
                vendor_id="VEND-MEDPHARMA",
                name="MedPharma Supplies Ltd",
                avg_lead_time_days=3,
                reliability_score=0.95,
                active_orders_count=1,
            )
        ],
    )

    orchestrator = MultiAgentOrchestrator(slm_provider=slm_provider, market_service=market_service)
    final_state: SupplyChainState = await orchestrator.run(snapshot)

    print("\n" + "-" * 80)
    print("[SUCCESS] Orchestration complete! Right Cost Market Intelligence State:")
    print(f"  Snapshot Reference ID: {final_state['snapshot'].snapshot_id}")
    print(f"  Agent Execution Statuses: {final_state['agent_statuses']}")
    print("-" * 80)

    print("\nMARKET INTELLIGENCE CONTEXT ATTACHED TO STATE:")
    for drug_id, m_ctx in final_state["market_context"].items():
        print(f"  [{drug_id}] {m_ctx.drug_name}:")
        print(f"      Reference Price : {m_ctx.reference_price} {m_ctx.currency}")
        print(f"      Price Available : {m_ctx.price_available}")
        print(f"      Data Status     : {m_ctx.data_status}")

    rec = final_state.get("coordinator_recommendation")
    if rec:
        print("\n" + "-" * 80)
        print("FINAL COORDINATOR RECOMMENDATION RESPONSE WITH RIGHT COST:")
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

    print("=" * 80)
    print("STAGE 14 MARKET INTELLIGENCE REAL INFERENCE TEST PASSED! ✅")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_market_intelligence_real_test())
