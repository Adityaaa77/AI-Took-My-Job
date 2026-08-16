from unittest.mock import AsyncMock
import pytest

from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    VendorSchema,
    AgentFindingSchema,
)
from app.agents import VendorAgent
from app.core import BaseSLMProvider

@pytest.fixture
def mock_slm_provider():
    provider = AsyncMock(spec=BaseSLMProvider)

    async def safe_generate_structured(*args, **kwargs):
        return AgentFindingSchema(
            agent_name="VendorAgent",
            finding_type="vendor_recommended",
            severity="low",
            target_drug_id="DRUG-101",
            target_location_id="VEND-001",
            description="Vendor VEND-001 evaluated as optimal source.",
            metrics={}
        )

    provider.generate_structured.side_effect = safe_generate_structured
    return provider

@pytest.mark.asyncio
async def test_1_best_vendor_selected_from_multiple_vendors(mock_slm_provider):
    agent = VendorAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-VEND-1",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        vendors=[
            VendorSchema(vendor_id="VEND-SLOW", name="SlowPharma", avg_lead_time_days=20, reliability_score=0.70),
            VendorSchema(vendor_id="VEND-FAST", name="FastPharma", avg_lead_time_days=3, reliability_score=0.95),
        ]
    )

    findings = await agent.analyze(snapshot)

    assert len(findings) == 1
    finding = findings[0]
    assert finding.finding_type == "vendor_recommended"
    assert finding.target_location_id == "VEND-FAST"
    assert finding.metrics["recommended_vendor_id"] == "VEND-FAST"
    assert finding.metrics["reliability_score"] == 0.95

@pytest.mark.asyncio
async def test_2_vendor_with_higher_reliability_selected(mock_slm_provider):
    agent = VendorAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-VEND-2",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        vendors=[
            VendorSchema(vendor_id="VEND-UNRELIABLE", name="RiskPharma", avg_lead_time_days=2, reliability_score=0.50),
            VendorSchema(vendor_id="VEND-RELIABLE", name="ReliableMed", avg_lead_time_days=5, reliability_score=0.98),
        ]
    )

    findings = await agent.analyze(snapshot)

    finding = findings[0]
    # ReliableMed (0.98 * 0.6 + 0.833 * 0.4 = 0.921) beats RiskPharma (0.50 * 0.6 + 0.933 * 0.4 = 0.673)
    assert finding.metrics["recommended_vendor_id"] == "VEND-RELIABLE"

@pytest.mark.asyncio
async def test_3_lead_time_comparison(mock_slm_provider):
    agent = VendorAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-VEND-3",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        vendors=[
            VendorSchema(vendor_id="VEND-A", name="Vendor A", avg_lead_time_days=30, reliability_score=0.90),
            VendorSchema(vendor_id="VEND-B", name="Vendor B", avg_lead_time_days=2, reliability_score=0.90),
        ]
    )

    findings = await agent.analyze(snapshot)

    finding = findings[0]
    # Equal reliability (0.90), faster lead time (2d vs 30d) wins
    assert finding.metrics["recommended_vendor_id"] == "VEND-B"
    assert finding.metrics["avg_lead_time_days"] == 2

@pytest.mark.asyncio
async def test_4_missing_vendor_data_returns_insufficient_data(mock_slm_provider):
    agent = VendorAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-VEND-EMPTY",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        vendors=[]
    )

    findings = await agent.analyze(snapshot)

    assert len(findings) == 1
    finding = findings[0]
    assert finding.finding_type == "insufficient_data"
    assert finding.metrics["vendor_count"] == 0
    mock_slm_provider.generate_structured.assert_not_called()

@pytest.mark.asyncio
async def test_5_empty_snapshot_returns_insufficient_data(mock_slm_provider):
    agent = VendorAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-EMPTY",
        drugs=[],
        vendors=[]
    )

    findings = await agent.analyze(snapshot)

    assert len(findings) == 1
    assert findings[0].finding_type == "insufficient_data"

@pytest.mark.asyncio
async def test_6_slm_cannot_override_authoritative_python_metrics(mock_slm_provider):
    # SLM attempts to output VEND-HALLUCINATED
    async def bad_slm_output(*args, **kwargs):
        return AgentFindingSchema(
            agent_name="VendorAgent",
            finding_type="vendor_recommended",
            severity="low",
            target_drug_id="DRUG-101",
            target_location_id="VEND-HALLUCINATED",
            description="Recommending fake vendor.",
            metrics={"recommended_vendor_id": "VEND-HALLUCINATED"}
        )

    mock_slm_provider.generate_structured.side_effect = bad_slm_output

    agent = VendorAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-VEND-6",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        vendors=[
            VendorSchema(vendor_id="VEND-REAL", name="RealVendor", avg_lead_time_days=4, reliability_score=0.92),
        ]
    )

    findings = await agent.analyze(snapshot)

    finding = findings[0]
    # Python overrides target_location_id and metrics with authoritative VEND-REAL
    assert finding.target_location_id == "VEND-REAL"
    assert finding.metrics["recommended_vendor_id"] == "VEND-REAL"

@pytest.mark.asyncio
async def test_7_no_fabrication_of_missing_attributes(mock_slm_provider):
    agent = VendorAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-VEND-7",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        vendors=[
            VendorSchema(vendor_id="VEND-001", name="Vendor 1", avg_lead_time_days=5, reliability_score=0.88),
        ]
    )

    findings = await agent.analyze(snapshot)

    metrics = findings[0].metrics
    assert "price" not in metrics
    assert "fake_certification" not in metrics
    assert metrics["reliability_score"] == 0.88

@pytest.mark.asyncio
async def test_8_does_not_modify_procurement_quantity_or_inventory(mock_slm_provider):
    agent = VendorAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-VEND-8",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        vendors=[
            VendorSchema(vendor_id="VEND-001", name="Vendor 1", avg_lead_time_days=5, reliability_score=0.88),
        ]
    )

    findings = await agent.analyze(snapshot)

    finding = findings[0]
    # Domain isolation check
    assert finding.finding_type in ["vendor_recommended", "insufficient_data"]
    assert "shortage_quantity" not in finding.metrics
    assert "days_of_supply" not in finding.metrics
