from datetime import date, datetime
from unittest.mock import AsyncMock
import pytest

from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    ShipmentSchema,
    AgentFindingSchema,
)
from app.agents import ProcurementAgent
from app.core import BaseSLMProvider

@pytest.fixture
def mock_slm_provider():
    provider = AsyncMock(spec=BaseSLMProvider)
    return provider

@pytest.mark.asyncio
async def test_1_procurement_not_required(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="ProcurementAgent",
        finding_type="procurement_not_required",
        severity="low",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Net effective stock is sufficient (50 days coverage). Procurement is not required.",
        metrics={}
    )

    agent = ProcurementAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-PROC-1",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets", min_safety_stock=200)],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=1000
            )
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.agent_name == "ProcurementAgent"
    assert finding.finding_type == "procurement_not_required"
    assert finding.severity == "low"
    assert finding.metrics["shortage_quantity"] == 0
    assert finding.metrics["is_procurement_needed"] is False

@pytest.mark.asyncio
async def test_2_procurement_required(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="ProcurementAgent",
        finding_type="procurement_required",
        severity="high",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Procurement required. Shortage gap of 300 units below minimum safety stock threshold.",
        metrics={}
    )

    agent = ProcurementAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-PROC-2",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Amoxicillin", category="Antibiotic", unit="capsules", min_safety_stock=350)],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=50
            )
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=750, daily_avg_consumption=25.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.finding_type == "procurement_required"
    assert finding.metrics["shortage_quantity"] == 300 # 350 - 50 = 300
    assert finding.metrics["is_procurement_needed"] is True
    assert finding.metrics["required_threshold"] == 350 # Preferred explicit min_safety_stock

@pytest.mark.asyncio
async def test_3_incoming_shipment_reduces_requirement(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="ProcurementAgent",
        finding_type="procurement_not_required",
        severity="low",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Incoming shipment of 500 units satisfies safety threshold. Additional procurement is not required.",
        metrics={}
    )

    agent = ProcurementAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-PROC-3",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Insulin", category="Hormones", unit="vials", min_safety_stock=300)],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=50,
                incoming_stock=500
            )
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ],
        shipments=[
            ShipmentSchema(
                shipment_id="SHIP-10",
                order_id="PO-10",
                origin_id="WAREHOUSE-1",
                destination_id="HOSP-A",
                drug_id="DRUG-101",
                quantity=500,
                status="in_transit",
                estimated_arrival=datetime(2026, 8, 18, 10, 0)
            )
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.metrics["net_effective_stock"] == 550 # 50 + 500 = 550
    assert finding.metrics["shortage_quantity"] == 0 # 550 >= 300 safety stock
    assert finding.metrics["is_procurement_needed"] is False

@pytest.mark.asyncio
async def test_4_insufficient_information_anti_hallucination(mock_slm_provider):
    agent = ProcurementAgent(slm_provider=mock_slm_provider)

    # Drug without min_safety_stock and no consumption record
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-PROC-4",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Unknown Drug", category="General", unit="units", min_safety_stock=0)],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=100
            )
        ],
        consumption_records=[]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.finding_type == "insufficient_data"
    assert finding.severity == "low"
    assert finding.metrics["shortage_quantity"] is None
    assert finding.metrics["daily_avg_consumption"] is None
    mock_slm_provider.generate_structured.assert_not_called()

@pytest.mark.asyncio
async def test_5_no_fabrication_of_vendor_or_price(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="ProcurementAgent",
        finding_type="procurement_required",
        severity="medium",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Procurement requirement identified for 150 units gap.",
        metrics={}
    )

    agent = ProcurementAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-PROC-5",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Ibuprofen", category="Analgesic", unit="tablets", min_safety_stock=300)],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=150
            )
        ],
        consumption_records=[]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    # Verify no vendor, lead time, or price fields exist in metrics
    assert "vendor_name" not in finding.metrics
    assert "lead_time_days" not in finding.metrics
    assert "purchase_price" not in finding.metrics
    assert finding.metrics["shortage_quantity"] == 150
