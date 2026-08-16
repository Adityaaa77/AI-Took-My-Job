from datetime import datetime
from unittest.mock import AsyncMock
import pytest

from app.schemas import (
    SupplyChainSnapshotPayload,
    AgentFindingSchema,
    CoordinatorRecommendationResponse,
    ActionRecommendationSchema,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
)
from app.agents import CoordinatorAgent
from app.pipeline.state import SupplyChainState
from app.core import BaseSLMProvider

@pytest.fixture
def mock_slm_provider():
    provider = AsyncMock(spec=BaseSLMProvider)
    provider.generate.return_value = "Redistribution of 490 units from HOSP-A to HOSP-B is recommended immediately to resolve shortage."

    async def safe_generate_structured(*args, **kwargs):
        return AgentFindingSchema(
            agent_name="TestAgent",
            finding_type="healthy_stock",
            severity="low",
            target_drug_id="DRUG-101",
            target_location_id="HOSP-A",
            description="Test description.",
            metrics={}
        )

    provider.generate_structured.side_effect = safe_generate_structured
    return provider

@pytest.mark.asyncio
async def test_1_valid_proposed_quantity_within_authoritative_limit(mock_slm_provider):
    agent = CoordinatorAgent(slm_provider=mock_slm_provider)

    state: SupplyChainState = {
        "snapshot": None,
        "inventory_findings": [],
        "demand_findings": [],
        "procurement_findings": [],
        "distribution_findings": [
            AgentFindingSchema(agent_name="DistributionAgent", finding_type="redistribution_opportunity", severity="medium", target_drug_id="DRUG-101", target_location_id="HOSP-B", description="Transfer", metrics={"source_location_id": "HOSP-A", "potential_transfer_quantity": 490})
        ],
        "coordinator_recommendation": None,
        "agent_statuses": {},
        "agent_errors": {}
    }

    # Simulate candidate proposed action of 480 (which is <= 490 limit)
    candidate = ActionRecommendationSchema(
        action_type="redistribute",
        target_drug_id="DRUG-101",
        source_location_id="HOSP-A",
        destination_location_id="HOSP-B",
        recommended_quantity=480,
        priority="medium",
        reasoning="Redistribute 480 units from HOSP-A to HOSP-B.",
        confidence=0.9
    )

    validated_rec, requires_human = agent.validate_and_reconcile_action(candidate, state["distribution_findings"])

    # 480 is valid because 480 <= 490
    assert validated_rec.recommended_quantity == 480
    assert validated_rec.source_location_id == "HOSP-A"
    assert validated_rec.destination_location_id == "HOSP-B"

@pytest.mark.asyncio
async def test_2_exceeding_quantity_clamped_to_authoritative_limit(mock_slm_provider):
    agent = CoordinatorAgent(slm_provider=mock_slm_provider)

    state: SupplyChainState = {
        "snapshot": None,
        "inventory_findings": [],
        "demand_findings": [],
        "procurement_findings": [],
        "distribution_findings": [
            AgentFindingSchema(agent_name="DistributionAgent", finding_type="redistribution_opportunity", severity="medium", target_drug_id="DRUG-101", target_location_id="HOSP-B", description="Transfer", metrics={"source_location_id": "HOSP-A", "potential_transfer_quantity": 490})
        ],
        "coordinator_recommendation": None,
        "agent_statuses": {},
        "agent_errors": {}
    }

    # Proposed quantity 600 exceeds authoritative limit of 490!
    candidate = ActionRecommendationSchema(
        action_type="redistribute",
        target_drug_id="DRUG-101",
        source_location_id="HOSP-A",
        destination_location_id="HOSP-B",
        recommended_quantity=600,
        priority="medium",
        reasoning="Redistribute 600 units.",
        confidence=0.9
    )

    validated_rec, requires_human = agent.validate_and_reconcile_action(candidate, state["distribution_findings"])

    # 600 MUST NOT be accepted; clamped to authoritative 490 and requires human review
    assert validated_rec.recommended_quantity == 490
    assert requires_human is True

@pytest.mark.asyncio
async def test_3_slm_reasoning_text_reconciliation(mock_slm_provider):
    # SLM returns reasoning text with hallucinated number "48 units" instead of 480
    mock_slm_provider.generate.return_value = "Redistribute 48 units from HOSP-A to HOSP-B to cover emergency demand."
    agent = CoordinatorAgent(slm_provider=mock_slm_provider)

    state: SupplyChainState = {
        "snapshot": None,
        "inventory_findings": [],
        "demand_findings": [],
        "procurement_findings": [],
        "distribution_findings": [
            AgentFindingSchema(agent_name="DistributionAgent", finding_type="redistribution_opportunity", severity="medium", target_drug_id="DRUG-101", target_location_id="HOSP-B", description="Transfer", metrics={"source_location_id": "HOSP-A", "potential_transfer_quantity": 480})
        ],
        "coordinator_recommendation": None,
        "agent_statuses": {},
        "agent_errors": {}
    }

    res: CoordinatorRecommendationResponse = await agent.synthesize(state)

    action = res.recommended_actions[0]
    assert action.recommended_quantity == 480
    # Reasoning text MUST be reconciled to contain 480 units (not 48 units!)
    assert "480" in action.reasoning
    assert "48 units" not in action.reasoning

@pytest.mark.asyncio
async def test_4_invalid_location_ids_repaired(mock_slm_provider):
    agent = CoordinatorAgent(slm_provider=mock_slm_provider)

    state: SupplyChainState = {
        "snapshot": None,
        "inventory_findings": [],
        "demand_findings": [],
        "procurement_findings": [],
        "distribution_findings": [
            AgentFindingSchema(agent_name="DistributionAgent", finding_type="redistribution_opportunity", severity="medium", target_drug_id="DRUG-101", target_location_id="HOSP-B", description="Transfer", metrics={"source_location_id": "HOSP-A", "potential_transfer_quantity": 490})
        ],
        "coordinator_recommendation": None,
        "agent_statuses": {},
        "agent_errors": {}
    }

    # SLM proposes invalid location IDs "WRONG-SRC" and "WRONG-DEST"
    candidate = ActionRecommendationSchema(
        action_type="redistribute",
        target_drug_id="DRUG-101",
        source_location_id="WRONG-SRC",
        destination_location_id="WRONG-DEST",
        recommended_quantity=490,
        priority="medium",
        reasoning="Redistribute.",
        confidence=0.9
    )

    validated_rec, requires_human = agent.validate_and_reconcile_action(candidate, state["distribution_findings"])

    # Location IDs MUST be repaired to authoritative finding values
    assert validated_rec.source_location_id == "HOSP-A"
    assert validated_rec.destination_location_id == "HOSP-B"
    assert requires_human is True

@pytest.mark.asyncio
async def test_5_procurement_exceeding_shortage_clamped(mock_slm_provider):
    agent = CoordinatorAgent(slm_provider=mock_slm_provider)

    state: SupplyChainState = {
        "snapshot": None,
        "inventory_findings": [],
        "demand_findings": [],
        "procurement_findings": [
            AgentFindingSchema(agent_name="ProcurementAgent", finding_type="procurement_required", severity="high", target_drug_id="DRUG-101", target_location_id="HOSP-B", description="Procure", metrics={"shortage_quantity": 230})
        ],
        "distribution_findings": [],
        "coordinator_recommendation": None,
        "agent_statuses": {},
        "agent_errors": {}
    }

    # SLM proposes procurement of 500 (exceeding authoritative shortage of 230)
    candidate = ActionRecommendationSchema(
        action_type="procure",
        target_drug_id="DRUG-101",
        source_location_id=None,
        destination_location_id="HOSP-B",
        recommended_quantity=500,
        priority="high",
        reasoning="Procure 500 units.",
        confidence=0.9
    )

    validated_rec, requires_human = agent.validate_and_reconcile_action(candidate, state["procurement_findings"])

    # Proposed 500 MUST NOT be accepted; corrected to 230 shortage quantity
    assert validated_rec.recommended_quantity == 230
    assert requires_human is True

@pytest.mark.asyncio
async def test_6_conflicting_findings_flags_human_approval(mock_slm_provider):
    agent = CoordinatorAgent(slm_provider=mock_slm_provider)

    state: SupplyChainState = {
        "snapshot": None,
        "inventory_findings": [
            AgentFindingSchema(agent_name="InventoryAgent", finding_type="stockout_risk", severity="critical", target_drug_id="DRUG-101", target_location_id="HOSP-B", description="Stockout", metrics={})
        ],
        "demand_findings": [],
        "procurement_findings": [
            AgentFindingSchema(agent_name="ProcurementAgent", finding_type="procurement_required", severity="high", target_drug_id="DRUG-101", target_location_id="HOSP-B", description="Procure", metrics={"shortage_quantity": 230})
        ],
        "distribution_findings": [
            AgentFindingSchema(agent_name="DistributionAgent", finding_type="redistribution_opportunity", severity="medium", target_drug_id="DRUG-101", target_location_id="HOSP-B", description="Transfer", metrics={"source_location_id": "HOSP-A", "potential_transfer_quantity": 490})
        ],
        "coordinator_recommendation": None,
        "agent_statuses": {},
        "agent_errors": {}
    }

    res: CoordinatorRecommendationResponse = await agent.synthesize(state)

    # Conflicting procurement and redistribution findings MUST flag requires_human_approval = True
    assert res.requires_human_approval is True
    assert res.recommended_actions[0].action_type == "redistribute"
    assert res.recommended_actions[0].recommended_quantity == 490

@pytest.mark.asyncio
async def test_7_full_pipeline_orchestrator_integration(mock_slm_provider):
    from app.pipeline import MultiAgentOrchestrator

    orchestrator = MultiAgentOrchestrator(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-STAGE10A",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets", min_safety_stock=200)],
        inventories=[
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000),
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=50)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=datetime(2026, 1, 1), period_end=datetime(2026, 1, 7), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=datetime(2026, 1, 1), period_end=datetime(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    state: SupplyChainState = await orchestrator.run(snapshot)

    assert state["coordinator_recommendation"] is not None
    rec_res = state["coordinator_recommendation"]
    assert isinstance(rec_res, CoordinatorRecommendationResponse)
    assert len(rec_res.recommended_actions) >= 1
    assert state["agent_statuses"]["CoordinatorAgent"] == "success"
