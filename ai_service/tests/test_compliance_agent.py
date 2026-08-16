from datetime import date, datetime
from unittest.mock import AsyncMock
import pytest

from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    BatchSchema,
    ShipmentSchema,
    AgentFindingSchema,
)
from app.agents import ComplianceAgent
from app.core import BaseSLMProvider

@pytest.fixture
def mock_slm_provider():
    provider = AsyncMock(spec=BaseSLMProvider)

    async def safe_generate_structured(*args, **kwargs):
        return AgentFindingSchema(
            agent_name="ComplianceAgent",
            finding_type="batch_compliance_passed",
            severity="low",
            target_drug_id="DRUG-101",
            target_location_id="HOSP-A",
            description="Batch compliance verified.",
            metrics={}
        )

    provider.generate_structured.side_effect = safe_generate_structured
    return provider

@pytest.mark.asyncio
async def test_1_valid_quality_status_passed(mock_slm_provider):
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-COMP-1",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=500,
                batches=[
                    BatchSchema(
                        batch_id="BATCH-001",
                        drug_id="DRUG-101",
                        manufacturer="PharmaCorp",
                        quantity=500,
                        expiry_date=date(2028, 12, 31),
                        quality_status="passed"
                    )
                ]
            )
        ]
    )

    findings = await agent.analyze(snapshot)

    assert len(findings) == 1
    finding = findings[0]
    assert finding.finding_type == "batch_compliance_passed"
    assert finding.metrics["compliant_stock_quantity"] == 500
    assert finding.metrics["non_compliant_stock_quantity"] == 0
    assert finding.metrics["has_violations"] is False

@pytest.mark.asyncio
async def test_2_expired_batch_detected(mock_slm_provider):
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-COMP-2",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=300,
                batches=[
                    BatchSchema(
                        batch_id="BATCH-EXPIRED",
                        drug_id="DRUG-101",
                        manufacturer="PharmaCorp",
                        quantity=300,
                        expiry_date=date(2024, 1, 1), # Expired!
                        quality_status="passed"
                    )
                ]
            )
        ]
    )

    findings = await agent.analyze(snapshot)

    assert len(findings) == 1
    finding = findings[0]
    assert finding.finding_type == "batch_compliance_failed"
    assert finding.severity == "high"
    assert finding.metrics["expired_batch_count"] == 1
    assert finding.metrics["non_compliant_stock_quantity"] == 300
    assert finding.metrics["has_violations"] is True

@pytest.mark.asyncio
async def test_3_quarantined_or_failed_batch_detected(mock_slm_provider):
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-COMP-3",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=200,
                batches=[
                    BatchSchema(
                        batch_id="BATCH-QUARANTINE",
                        drug_id="DRUG-101",
                        manufacturer="PharmaCorp",
                        quantity=200,
                        expiry_date=date(2028, 1, 1),
                        quality_status="quarantine" # Unsafe status!
                    )
                ]
            )
        ]
    )

    findings = await agent.analyze(snapshot)

    finding = findings[0]
    assert finding.finding_type == "batch_compliance_failed"
    assert finding.metrics["quarantined_batch_count"] == 1
    assert finding.metrics["non_compliant_stock_quantity"] == 200

@pytest.mark.asyncio
async def test_4_missing_batch_data_returns_insufficient_data(mock_slm_provider):
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-COMP-NOBATCH",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=500,
                batches=[] # Missing batch details!
            )
        ]
    )

    findings = await agent.analyze(snapshot)

    assert len(findings) == 1
    finding = findings[0]
    assert finding.finding_type == "insufficient_data"
    assert finding.metrics["batch_count"] == 0
    mock_slm_provider.generate_structured.assert_not_called()

@pytest.mark.asyncio
async def test_5_mixed_safe_and_unsafe_batches(mock_slm_provider):
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-COMP-MIXED",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=600,
                batches=[
                    BatchSchema(batch_id="BATCH-SAFE", drug_id="DRUG-101", manufacturer="PharmaCorp", quantity=400, expiry_date=date(2028, 1, 1), quality_status="passed"),
                    BatchSchema(batch_id="BATCH-OLD", drug_id="DRUG-101", manufacturer="PharmaCorp", quantity=200, expiry_date=date(2024, 1, 1), quality_status="passed"),
                ]
            )
        ]
    )

    findings = await agent.analyze(snapshot)

    finding = findings[0]
    assert finding.finding_type == "batch_compliance_failed"
    assert finding.metrics["compliant_stock_quantity"] == 400
    assert finding.metrics["non_compliant_stock_quantity"] == 200

@pytest.mark.asyncio
async def test_6_incoming_shipments_do_not_inflate_compliant_inventory(mock_slm_provider):
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-COMP-SHIP",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=100,
                incoming_stock=500, # In transit, not yet inspected on site
                batches=[
                    BatchSchema(batch_id="BATCH-1", drug_id="DRUG-101", manufacturer="PharmaCorp", quantity=100, expiry_date=date(2028, 1, 1), quality_status="passed")
                ]
            )
        ],
        shipments=[
            ShipmentSchema(shipment_id="SHIP-99", order_id="PO-1", origin_id="VEND-1", destination_id="HOSP-A", drug_id="DRUG-101", quantity=500, status="in_transit", estimated_arrival=datetime(2026, 8, 20))
        ]
    )

    findings = await agent.analyze(snapshot)

    finding = findings[0]
    # Compliant stock quantity is strictly 100 (batch on site), NOT 600
    assert finding.metrics["compliant_stock_quantity"] == 100

@pytest.mark.asyncio
async def test_7_slm_cannot_override_python_compliance_classification(mock_slm_provider):
    # SLM tries to claim batch_compliance_passed for an expired batch
    async def bad_slm_output(*args, **kwargs):
        return AgentFindingSchema(
            agent_name="ComplianceAgent",
            finding_type="batch_compliance_passed",
            severity="low",
            target_drug_id="DRUG-101",
            target_location_id="HOSP-A",
            description="Fake passed compliance.",
            metrics={}
        )

    mock_slm_provider.generate_structured.side_effect = bad_slm_output
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-COMP-7",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=100,
                batches=[
                    BatchSchema(batch_id="BATCH-EXP", drug_id="DRUG-101", manufacturer="PharmaCorp", quantity=100, expiry_date=date(2024, 1, 1), quality_status="passed")
                ]
            )
        ]
    )

    findings = await agent.analyze(snapshot)

    finding = findings[0]
    # Python overrides SLM output to batch_compliance_failed
    assert finding.finding_type == "batch_compliance_failed"

@pytest.mark.asyncio
async def test_8_no_fabricated_regulations_or_certificates(mock_slm_provider):
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-COMP-8",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=100,
                batches=[
                    BatchSchema(batch_id="BATCH-1", drug_id="DRUG-101", manufacturer="PharmaCorp", quantity=100, expiry_date=date(2028, 1, 1), quality_status="passed")
                ]
            )
        ]
    )

    findings = await agent.analyze(snapshot)

    metrics = findings[0].metrics
    assert "fda_license_clause" not in metrics
    assert "legal_patent" not in metrics
    assert metrics["compliant_batch_count"] == 1

@pytest.mark.asyncio
async def test_9_empty_snapshot_handled_safely(mock_slm_provider):
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-EMPTY",
        drugs=[],
        inventories=[]
    )

    findings = await agent.analyze(snapshot)

    assert len(findings) == 1
    assert findings[0].finding_type == "insufficient_data"

@pytest.mark.asyncio
async def test_10_domain_boundary_isolation(mock_slm_provider):
    agent = ComplianceAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-COMP-10",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=100,
                batches=[
                    BatchSchema(batch_id="BATCH-1", drug_id="DRUG-101", manufacturer="PharmaCorp", quantity=100, expiry_date=date(2028, 1, 1), quality_status="passed")
                ]
            )
        ]
    )

    findings = await agent.analyze(snapshot)

    finding = findings[0]
    assert finding.finding_type in ["batch_compliance_passed", "batch_compliance_failed", "insufficient_data"]
    assert "shortage_quantity" not in finding.metrics
    assert "recommended_vendor_id" not in finding.metrics
