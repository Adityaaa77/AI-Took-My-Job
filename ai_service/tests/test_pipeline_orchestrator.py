import asyncio
from datetime import date, datetime
from unittest.mock import AsyncMock, patch
import pytest

from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    AgentFindingSchema,
)
from app.pipeline import MultiAgentOrchestrator, SupplyChainState
from app.core import BaseSLMProvider

@pytest.fixture
def mock_slm_provider():
    provider = AsyncMock(spec=BaseSLMProvider)
    lock = asyncio.Lock()

    async def safe_generate_structured(*args, **kwargs):
        async with lock:
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
async def test_1_all_four_agents_execute_and_aggregate_findings(mock_slm_provider):
    orchestrator = MultiAgentOrchestrator(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-ORCH-1",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets", min_safety_stock=200)],
        inventories=[
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000),
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=50)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 7), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 8), period_end=date(2026, 1, 14), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    state: SupplyChainState = await orchestrator.run(snapshot)

    # 1. Preserve original snapshot
    assert state["snapshot"].snapshot_id == "SNAP-ORCH-1"

    # 2. Check findings aggregated across all 4 agents
    assert len(state["inventory_findings"]) >= 1
    assert len(state["demand_findings"]) >= 1
    assert len(state["procurement_findings"]) >= 1
    assert len(state["distribution_findings"]) >= 1

    # 3. Check execution statuses
    assert state["agent_statuses"]["InventoryAgent"] == "success"
    assert state["agent_statuses"]["DemandAgent"] == "success"
    assert state["agent_statuses"]["ProcurementAgent"] == "success"
    assert state["agent_statuses"]["DistributionAgent"] == "success"

    # 4. Check no errors recorded
    assert state["agent_errors"]["InventoryAgent"] is None
    assert state["agent_errors"]["DemandAgent"] is None
    assert state["agent_errors"]["ProcurementAgent"] is None
    assert state["agent_errors"]["DistributionAgent"] is None

@pytest.mark.asyncio
async def test_2_fault_tolerance_one_agent_failure_does_not_erase_others(mock_slm_provider):
    orchestrator = MultiAgentOrchestrator(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-ORCH-2",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets", min_safety_stock=200)],
        inventories=[
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 7), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 8), period_end=date(2026, 1, 14), quantity_consumed=100, daily_avg_consumption=14.2)
        ]
    )

    # Mock DemandAgent to raise an exception while other agents succeed
    with patch("app.pipeline.nodes.DemandAgent") as mock_demand_cls:
        mock_demand_instance = AsyncMock()
        mock_demand_instance.analyze.side_effect = RuntimeError("Demand calculation failure")
        mock_demand_cls.return_value = mock_demand_instance

        state: SupplyChainState = await orchestrator.run(snapshot)

        # DemandAgent failed
        assert state["agent_statuses"]["DemandAgent"] == "failed"
        assert "Demand calculation failure" in state["agent_errors"]["DemandAgent"]
        assert len(state["demand_findings"]) == 0

        # Other 3 agents succeeded and preserved their findings!
        assert state["agent_statuses"]["InventoryAgent"] == "success"
        assert state["agent_statuses"]["ProcurementAgent"] == "success"
        assert state["agent_statuses"]["DistributionAgent"] == "success"
        assert len(state["inventory_findings"]) >= 1

@pytest.mark.asyncio
async def test_3_empty_snapshot_handled_gracefully(mock_slm_provider):
    orchestrator = MultiAgentOrchestrator(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-EMPTY",
        drugs=[],
        inventories=[],
        consumption_records=[]
    )

    state: SupplyChainState = await orchestrator.run(snapshot)

    assert state["snapshot"].snapshot_id == "SNAP-EMPTY"
    assert len(state["inventory_findings"]) == 0
    assert len(state["demand_findings"]) == 0
    assert len(state["procurement_findings"]) == 0
    assert len(state["distribution_findings"]) == 0
    assert state["agent_statuses"]["InventoryAgent"] == "success"
