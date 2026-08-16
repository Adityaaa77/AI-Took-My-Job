import asyncio
from datetime import datetime
import sys
import os

# Add root ai_service path to sys.path so script can be run directly from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from app.core import BaseSLMProvider, OllamaProvider
from app.agents import CoordinatorAgent
from app.schemas import (
    AgentFindingSchema,
    CoordinatorRecommendationResponse,
    SupplyChainSnapshotPayload,
)
from app.pipeline.state import SupplyChainState

async def run_coordinator_real_test():
    print("=" * 80)
    print("STAGE 10: COORDINATOR / DECISION AGENT REAL SLM TEST")
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

    # Step 2: Build Realistic Aggregated Multi-Agent Findings State
    state: SupplyChainState = {
        "snapshot": None,
        "inventory_findings": [
            AgentFindingSchema(
                agent_name="InventoryAgent",
                finding_type="stockout_risk",
                severity="high",
                target_drug_id="DRUG-505",
                target_location_id="HOSP-CLINIC-EAST",
                description="High stockout risk. 80 units available with 2.0 days of supply.",
                metrics={"days_of_supply": 2.0, "available_stock": 80}
            )
        ],
        "demand_findings": [
            AgentFindingSchema(
                agent_name="DemandAgent",
                finding_type="abnormal_consumption",
                severity="high",
                target_drug_id="DRUG-505",
                target_location_id="HOSP-CLINIC-EAST",
                description="Abnormal consumption spike detected (40 units/day vs 15.0 baseline).",
                metrics={"baseline_average": 15.0, "recent_quantity": 280, "is_spike": True}
            )
        ],
        "procurement_findings": [
            AgentFindingSchema(
                agent_name="ProcurementAgent",
                finding_type="procurement_required",
                severity="high",
                target_drug_id="DRUG-505",
                target_location_id="HOSP-CLINIC-EAST",
                description="Procurement requirement of 480 units identified for Meropenem 1g at HOSP-CLINIC-EAST.",
                metrics={"shortage_quantity": 480, "is_procurement_needed": True}
            )
        ],
        "distribution_findings": [
            AgentFindingSchema(
                agent_name="DistributionAgent",
                finding_type="redistribution_opportunity",
                severity="medium",
                target_drug_id="DRUG-505",
                target_location_id="HOSP-CLINIC-EAST",
                description="Potential redistribution opportunity: transfer 480 units from HOSP-HUB-NORTH to HOSP-CLINIC-EAST.",
                metrics={"source_location_id": "HOSP-HUB-NORTH", "destination_location_id": "HOSP-CLINIC-EAST", "potential_transfer_quantity": 480}
            )
        ],
        "coordinator_recommendation": None,
        "agent_statuses": {
            "InventoryAgent": "success",
            "DemandAgent": "success",
            "ProcurementAgent": "success",
            "DistributionAgent": "success",
        },
        "agent_errors": {
            "InventoryAgent": None,
            "DemandAgent": None,
            "ProcurementAgent": None,
            "DistributionAgent": None,
        }
    }

    print("\n[Step 2] Executing CoordinatorAgent.synthesize(state)...")
    coordinator = CoordinatorAgent(slm_provider=slm_provider)
    res: CoordinatorRecommendationResponse = await coordinator.synthesize(state)

    print("\n[SUCCESS] CoordinatorAgent completed decision synthesis!")
    print("-" * 80)
    print("Coordinator Recommendation Response")
    print("-----------------------------------")
    print(f"Recommendation ID    : {res.recommendation_id}")
    print(f"Overall Risk Level   : {res.overall_risk_level.upper()}")
    print(f"Human Approval Req.  : {res.requires_human_approval}")
    print(f"Aggregated Findings  : {len(res.agent_findings)} findings attached")

    print("\nRecommended Actions:")
    for idx, act in enumerate(res.recommended_actions, 1):
        print(f"  Action #{idx}:")
        print(f"    Action Type      : {act.action_type.upper()}")
        print(f"    Priority         : {act.priority.upper()}")
        print(f"    Target Drug ID   : {act.target_drug_id}")
        print(f"    Destination Loc  : {act.destination_location_id}")
        print(f"    Source Loc       : {act.source_location_id if act.source_location_id else 'N/A'}")
        print(f"    Recommended Qty  : {act.recommended_quantity} units")
        print(f"    Confidence       : {act.confidence * 100:.0f}%")
        print(f"    SLM Reasoning    : {act.reasoning}")
        print("-" * 80)

    print("STAGE 10 COORDINATOR REAL INFERENCE TEST PASSED! ✅")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_coordinator_real_test())
