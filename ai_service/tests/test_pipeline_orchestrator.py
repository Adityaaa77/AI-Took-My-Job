import asyncio
from datetime import date, datetime
from unittest.mock import AsyncMock, patch
import pytest

from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    VendorSchema,
    BatchSchema,
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
    provider.generate.return_value = "Test reasoning statement."
    return provider

@pytest.mark.asyncio
async def test_1_all_six_agents_execute_and_aggregate_findings(mock_slm_provider):
    orchestrator = MultiAgentOrchestrator(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-ORCH-1",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets", min_safety_stock=200)],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=1000,
                batches=[BatchSchema(batch_id="B1", drug_id="DRUG-101", manufacturer="P", quantity=1000, expiry_date=date(2028, 1, 1), quality_status="passed")]
            ),
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=50)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 7), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ],
        vendors=[
            VendorSchema(vendor_id="VEND-1", name="Vendor 1", avg_lead_time_days=5, reliability_score=0.95)
        ]
    )

    state: SupplyChainState = await orchestrator.run(snapshot)

    # 1. Preserve original snapshot
    assert state["snapshot"].snapshot_id == "SNAP-ORCH-1"

    # 2. Check findings aggregated across all 6 specialized agents
    assert len(state["inventory_findings"]) >= 1
    assert len(state["demand_findings"]) >= 1
    assert len(state["procurement_findings"]) >= 1
    assert len(state["distribution_findings"]) >= 1
    assert len(state["vendor_findings"]) >= 1
    assert len(state["compliance_findings"]) >= 1
    assert state["coordinator_recommendation"] is not None

    # 3. Check execution statuses for all 7 components
    assert state["agent_statuses"]["InventoryAgent"] == "success"
    assert state["agent_statuses"]["DemandAgent"] == "success"
    assert state["agent_statuses"]["ProcurementAgent"] == "success"
    assert state["agent_statuses"]["DistributionAgent"] == "success"
    assert state["agent_statuses"]["VendorAgent"] == "success"
    assert state["agent_statuses"]["ComplianceAgent"] == "success"
    assert state["agent_statuses"]["CoordinatorAgent"] == "success"

@pytest.mark.asyncio
async def test_2_vendor_agent_failure_does_not_break_pipeline(mock_slm_provider):
    orchestrator = MultiAgentOrchestrator(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-ORCH-VEND-FAIL",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets", min_safety_stock=200)],
        inventories=[InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000)]
    )

    with patch("app.pipeline.nodes.VendorAgent") as mock_vend_cls:
        mock_vend_instance = AsyncMock()
        mock_vend_instance.analyze.side_effect = RuntimeError("Vendor service timeout")
        mock_vend_cls.return_value = mock_vend_instance

        state: SupplyChainState = await orchestrator.run(snapshot)

        # VendorAgent failed, but other agents succeeded!
        assert state["agent_statuses"]["VendorAgent"] == "failed"
        assert "Vendor service timeout" in state["agent_errors"]["VendorAgent"]
        assert state["agent_statuses"]["InventoryAgent"] == "success"
        assert state["agent_statuses"]["CoordinatorAgent"] == "success"

@pytest.mark.asyncio
async def test_3_compliance_agent_failure_does_not_break_pipeline(mock_slm_provider):
    orchestrator = MultiAgentOrchestrator(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-ORCH-COMP-FAIL",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets", min_safety_stock=200)],
        inventories=[InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000)]
    )

    with patch("app.pipeline.nodes.ComplianceAgent") as mock_comp_cls:
        mock_comp_instance = AsyncMock()
        mock_comp_instance.analyze.side_effect = RuntimeError("Compliance service error")
        mock_comp_cls.return_value = mock_comp_instance

        state: SupplyChainState = await orchestrator.run(snapshot)

        # ComplianceAgent failed, but other agents succeeded!
        assert state["agent_statuses"]["ComplianceAgent"] == "failed"
        assert "Compliance service error" in state["agent_errors"]["ComplianceAgent"]
        assert state["agent_statuses"]["InventoryAgent"] == "success"
        assert state["agent_statuses"]["CoordinatorAgent"] == "success"

@pytest.mark.asyncio
async def test_4_empty_snapshot_handled_gracefully(mock_slm_provider):
    orchestrator = MultiAgentOrchestrator(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-EMPTY",
        drugs=[],
        inventories=[],
        consumption_records=[],
        vendors=[]
    )

    state: SupplyChainState = await orchestrator.run(snapshot)

    assert state["snapshot"].snapshot_id == "SNAP-EMPTY"
    assert state["agent_statuses"]["InventoryAgent"] == "success"
    assert state["agent_statuses"]["CoordinatorAgent"] == "success"
