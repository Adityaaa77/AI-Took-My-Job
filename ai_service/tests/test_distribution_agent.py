from datetime import date, datetime
from unittest.mock import AsyncMock
import pytest

from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    ShipmentSchema,
    BatchSchema,
    AgentFindingSchema,
)
from app.agents import DistributionAgent
from app.core import BaseSLMProvider

@pytest.fixture
def mock_slm_provider():
    provider = AsyncMock(spec=BaseSLMProvider)
    return provider

@pytest.mark.asyncio
async def test_1_no_redistribution_required(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="DistributionAgent",
        finding_type="distribution_not_required",
        severity="low",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Stock coverage is balanced at HOSP-A. Redistribution is not required.",
        metrics={}
    )

    agent = DistributionAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-1",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        inventories=[
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=400),
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=500)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) >= 1
    for f in findings:
        assert f.agent_name == "DistributionAgent"
        assert f.finding_type == "distribution_not_required"
        assert f.metrics["potential_transfer_quantity"] == 0

@pytest.mark.asyncio
async def test_2_valid_surplus_to_deficit_redistribution(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="DistributionAgent",
        finding_type="redistribution_opportunity",
        severity="medium",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-B",
        description="Potential redistribution opportunity: transfer 200 units from HOSP-A to HOSP-B.",
        metrics={}
    )

    agent = DistributionAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-2",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Amoxicillin", category="Antibiotic", unit="capsules", min_safety_stock=200)],
        inventories=[
            # HOSP-A: 1000 stock / 20 usage = 50 days (Surplus = 1000 - 280 = 720 units)
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000),
            # HOSP-B: 50 stock / 25 usage = 2 days (Deficit = 350 - 50 = 300 units)
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=50)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=750, daily_avg_consumption=25.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.finding_type == "redistribution_opportunity"
    assert finding.target_location_id == "HOSP-B" # Destination
    assert finding.metrics["source_location_id"] == "HOSP-A" # Source
    assert finding.metrics["potential_transfer_quantity"] == 300 # min(720 surplus, 300 deficit)

@pytest.mark.asyncio
async def test_3_deficit_with_no_suitable_source(mock_slm_provider):
    agent = DistributionAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-3",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Ibuprofen", category="Analgesic", unit="tablets")],
        inventories=[
            # HOSP-A: 100 stock / 20 usage = 5 days (Low coverage, no surplus)
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=100),
            # HOSP-B: 30 stock / 20 usage = 1.5 days (Deficit)
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=30)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) >= 1
    for finding in findings:
        assert finding.finding_type == "distribution_not_required"
        assert finding.metrics["potential_transfer_quantity"] == 0
        assert finding.finding_type != "procurement_required"

@pytest.mark.asyncio
async def test_4_reserved_stock_protection(mock_slm_provider):
    agent = DistributionAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-4",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Insulin", category="Hormones", unit="vials")],
        inventories=[
            # HOSP-A: 1000 total, but 800 are reserved! Unreserved = 200 (10 days supply -> No surplus)
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000, reserved_stock=800),
            # HOSP-B: 30 stock / 20 usage = 1.5 days (Deficit)
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=30)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    assert findings[0].metrics["potential_transfer_quantity"] == 0

@pytest.mark.asyncio
async def test_5_expired_unsafe_batch_protection(mock_slm_provider):
    agent = DistributionAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-5",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Vaccine", category="Biologicals", unit="vials")],
        inventories=[
            # HOSP-A: 1000 stock, but batch is expired!
            InventoryItemSchema(
                location_id="HOSP-A", 
                location_type="hospital", 
                drug_id="DRUG-101", 
                available_stock=1000,
                batches=[
                    BatchSchema(batch_id="B-EXPIRED", drug_id="DRUG-101", manufacturer="Pharma", quantity=1000, expiry_date=date(2025, 1, 1), quality_status="passed")
                ]
            ),
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=30)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) >= 1
    for finding in findings:
        assert finding.metrics["potential_transfer_quantity"] == 0

@pytest.mark.asyncio
async def test_6_incoming_shipment_timing(mock_slm_provider):
    agent = DistributionAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-6",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Cipro", category="Antibiotic", unit="tablets")],
        inventories=[
            # HOSP-A: 50 current stock + 1000 incoming stock. Available stock is ONLY 50 (no current surplus!)
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=50, incoming_stock=1000),
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=30)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) >= 1
    for finding in findings:
        assert finding.metrics["potential_transfer_quantity"] == 0

@pytest.mark.asyncio
async def test_7_multiple_hospitals_same_drug(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="DistributionAgent",
        finding_type="redistribution_opportunity",
        severity="medium",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-C",
        description="Transfer surplus from HOSP-A to HOSP-C.",
        metrics={}
    )

    agent = DistributionAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-7",
        drugs=[DrugSchema(drug_id="DRUG-101", name="MultiHospDrug", category="General", unit="tablets")],
        inventories=[
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000), # Surplus
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=400),  # Balanced
            InventoryItemSchema(location_id="HOSP-C", location_type="hospital", drug_id="DRUG-101", available_stock=50)    # Deficit
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-C", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    assert findings[0].target_location_id == "HOSP-C"
    assert findings[0].metrics["source_location_id"] == "HOSP-A"

@pytest.mark.asyncio
async def test_8_multiple_drugs_remain_isolated(mock_slm_provider):
    agent = DistributionAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-8",
        drugs=[
            DrugSchema(drug_id="DRUG-101", name="Drug A", category="General", unit="tablets"),
            DrugSchema(drug_id="DRUG-202", name="Drug B", category="General", unit="vials")
        ],
        inventories=[
            # HOSP-A has surplus of DRUG-101
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000),
            # HOSP-B has deficit of DRUG-202 (different drug!)
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-202", available_stock=30)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-202", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    # Different drugs are isolated, so DRUG-101 surplus cannot be transferred to DRUG-202 deficit
    for f in findings:
        assert f.metrics["potential_transfer_quantity"] == 0

@pytest.mark.asyncio
async def test_9_insufficient_consumption_data(mock_slm_provider):
    agent = DistributionAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-9",
        drugs=[DrugSchema(drug_id="DRUG-101", name="NoDataDrug", category="General", unit="tablets")],
        inventories=[
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000)
        ],
        consumption_records=[] # No consumption data
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    assert findings[0].finding_type == "insufficient_data"
    assert findings[0].metrics["potential_transfer_quantity"] == 0
    mock_slm_provider.generate_structured.assert_not_called()

@pytest.mark.asyncio
async def test_10_source_retains_safety_requirement(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="DistributionAgent",
        finding_type="redistribution_opportunity",
        severity="medium",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-B",
        description="Transfer 700 units from HOSP-A to HOSP-B.",
        metrics={}
    )

    agent = DistributionAgent(slm_provider=mock_slm_provider, target_coverage_days=15)

    # HOSP-A usage = 20/day. 15 days coverage requirement = 300 units retained safety requirement.
    # HOSP-A available = 1000. Surplus = 1000 - 300 = 700 units.
    # HOSP-B deficit = 1000 units.
    # Max transfer MUST be capped at 700 units so HOSP-A retains 300 units!
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DIST-10",
        drugs=[DrugSchema(drug_id="DRUG-101", name="SafetyRetainedDrug", category="General", unit="tablets")],
        inventories=[
            InventoryItemSchema(location_id="HOSP-A", location_type="hospital", drug_id="DRUG-101", available_stock=1000),
            InventoryItemSchema(location_id="HOSP-B", location_type="hospital", drug_id="DRUG-101", available_stock=0)
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=600, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-B", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 30), quantity_consumed=1500, daily_avg_consumption=50.0)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.metrics["potential_transfer_quantity"] == 700 # Capped at 700!
    assert finding.metrics["source_retained_stock"] == 300 # Source retains 300 units safety stock!
