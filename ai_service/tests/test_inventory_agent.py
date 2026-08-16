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
from app.agents import InventoryAgent
from app.core import BaseSLMProvider

@pytest.fixture
def mock_slm_provider():
    provider = AsyncMock(spec=BaseSLMProvider)
    return provider

@pytest.mark.asyncio
async def test_1_healthy_inventory(mock_slm_provider):
    # Mock SLM structured response for healthy inventory
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="InventoryAgent",
        finding_type="healthy_stock",
        severity="low",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Current stock is healthy and sufficient for 50 days of operation.",
        metrics={}
    )

    agent = InventoryAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-1",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=1000
            )
        ],
        consumption_records=[
            ConsumptionRecordSchema(
                hospital_id="HOSP-A",
                drug_id="DRUG-101",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 1, 30),
                quantity_consumed=600,
                daily_avg_consumption=20.0
            )
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.agent_name == "InventoryAgent"
    assert finding.severity == "low"
    assert finding.metrics["available_stock"] == 1000
    assert finding.metrics["daily_avg_consumption"] == 20.0
    assert finding.metrics["days_of_available_supply"] == 50.0

@pytest.mark.asyncio
async def test_2_high_stockout_risk(mock_slm_provider):
    # Mock SLM response for high stockout risk
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="InventoryAgent",
        finding_type="stockout_risk",
        severity="high",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="High stockout risk. Available stock will deplete in 2 days.",
        metrics={}
    )

    agent = InventoryAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-2",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Amoxicillin", category="Antibiotic", unit="capsules")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=50
            )
        ],
        consumption_records=[
            ConsumptionRecordSchema(
                hospital_id="HOSP-A",
                drug_id="DRUG-101",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 1, 30),
                quantity_consumed=750,
                daily_avg_consumption=25.0
            )
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.severity in ["high", "critical"]
    assert finding.metrics["available_stock"] == 50
    assert finding.metrics["daily_avg_consumption"] == 25.0
    assert finding.metrics["days_of_available_supply"] == 2.0

@pytest.mark.asyncio
async def test_3_incoming_shipment_mitigation(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="InventoryAgent",
        finding_type="incoming_shipment_mitigation",
        severity="medium",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Low available stock (2.5 days), but incoming shipment of 500 units mitigates stockout risk.",
        metrics={}
    )

    agent = InventoryAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-3",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Insulin", category="Hormones", unit="vials")],
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
            ConsumptionRecordSchema(
                hospital_id="HOSP-A",
                drug_id="DRUG-101",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 1, 30),
                quantity_consumed=600,
                daily_avg_consumption=20.0
            )
        ],
        shipments=[
            ShipmentSchema(
                shipment_id="SHIP-01",
                order_id="PO-01",
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

    assert finding.metrics["available_stock"] == 50
    assert finding.metrics["incoming_stock"] == 500
    assert finding.metrics["net_effective_stock"] == 550
    assert finding.metrics["days_of_available_supply"] == 2.5
    assert finding.metrics["days_of_effective_supply"] == 27.5

@pytest.mark.asyncio
async def test_4_missing_consumption_data_anti_hallucination(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="InventoryAgent",
        finding_type="insufficient_data",
        severity="low",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Daily consumption rate is unavailable. Cannot calculate days of supply.",
        metrics={}
    )

    agent = InventoryAgent(slm_provider=mock_slm_provider)

    # Snapshot without consumption record
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-4",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Ibuprofen", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-A",
                location_type="hospital",
                drug_id="DRUG-101",
                available_stock=500
            )
        ],
        consumption_records=[] # Empty consumption records
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.finding_type == "insufficient_data"
    assert finding.metrics["daily_avg_consumption"] is None
    assert finding.metrics["days_of_available_supply"] is None
    assert finding.metrics["available_stock"] == 500
