from datetime import date
from unittest.mock import AsyncMock
import pytest

from app.schemas import (
    SupplyChainSnapshotPayload,
    DrugSchema,
    ConsumptionRecordSchema,
    AgentFindingSchema,
)
from app.agents import DemandAgent
from app.core import BaseSLMProvider

@pytest.fixture
def mock_slm_provider():
    provider = AsyncMock(spec=BaseSLMProvider)
    return provider

@pytest.mark.asyncio
async def test_1_stable_demand(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="DemandAgent",
        finding_type="stable_demand",
        severity="low",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Consumption has remained stable across all 4 periods.",
        metrics={}
    )

    agent = DemandAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DEM-1",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Paracetamol", category="Analgesic", unit="tablets")],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 7), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 8), period_end=date(2026, 1, 14), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 15), period_end=date(2026, 1, 21), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 22), period_end=date(2026, 1, 28), quantity_consumed=100, daily_avg_consumption=14.2),
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.agent_name == "DemandAgent"
    assert finding.finding_type == "stable_demand"
    assert finding.severity == "low"
    assert finding.metrics["observation_count"] == 4
    assert finding.metrics["baseline_average"] == 100.0
    assert finding.metrics["recent_quantity"] == 100
    assert finding.metrics["trend_percentage"] == 0.0
    assert finding.metrics["is_spike"] is False

@pytest.mark.asyncio
async def test_2_increasing_demand(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="DemandAgent",
        finding_type="demand_increase",
        severity="medium",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Consumption increased by 33.33% compared to baseline.",
        metrics={}
    )

    agent = DemandAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DEM-2",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Amoxicillin", category="Antibiotic", unit="capsules")],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 7), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 8), period_end=date(2026, 1, 14), quantity_consumed=120, daily_avg_consumption=17.1),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 15), period_end=date(2026, 1, 21), quantity_consumed=140, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 22), period_end=date(2026, 1, 28), quantity_consumed=160, daily_avg_consumption=22.8),
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.metrics["observation_count"] == 4
    assert finding.metrics["baseline_average"] == 120.0 # (100+120+140)/3 = 120
    assert finding.metrics["recent_quantity"] == 160
    assert finding.metrics["trend_percentage"] == 33.33 # ((160-120)/120)*100

@pytest.mark.asyncio
async def test_3_decreasing_demand(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="DemandAgent",
        finding_type="demand_decrease",
        severity="low",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Consumption decreased by 35.29% compared to baseline.",
        metrics={}
    )

    agent = DemandAgent(slm_provider=mock_slm_provider)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DEM-3",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Ibuprofen", category="Analgesic", unit="tablets")],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 7), quantity_consumed=200, daily_avg_consumption=28.5),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 8), period_end=date(2026, 1, 14), quantity_consumed=170, daily_avg_consumption=24.2),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 15), period_end=date(2026, 1, 21), quantity_consumed=140, daily_avg_consumption=20.0),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 22), period_end=date(2026, 1, 28), quantity_consumed=110, daily_avg_consumption=15.7),
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.metrics["baseline_average"] == 170.0 # (200+170+140)/3 = 170
    assert finding.metrics["recent_quantity"] == 110
    assert finding.metrics["trend_percentage"] == -35.29

@pytest.mark.asyncio
async def test_4_abnormal_consumption_spike(mock_slm_provider):
    mock_slm_provider.generate_structured.return_value = AgentFindingSchema(
        agent_name="DemandAgent",
        finding_type="abnormal_consumption",
        severity="high",
        target_drug_id="DRUG-101",
        target_location_id="HOSP-A",
        description="Abnormal consumption spike detected (400 units vs 105 baseline).",
        metrics={}
    )

    agent = DemandAgent(slm_provider=mock_slm_provider, anomaly_spike_threshold=2.0)

    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DEM-4",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Insulin", category="Hormones", unit="vials")],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 7), quantity_consumed=100, daily_avg_consumption=14.2),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 8), period_end=date(2026, 1, 14), quantity_consumed=105, daily_avg_consumption=15.0),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 15), period_end=date(2026, 1, 21), quantity_consumed=110, daily_avg_consumption=15.7),
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 22), period_end=date(2026, 1, 28), quantity_consumed=400, daily_avg_consumption=57.1),
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.metrics["baseline_average"] == 105.0 # (100+105+110)/3 = 105
    assert finding.metrics["recent_quantity"] == 400
    assert finding.metrics["is_spike"] is True # 400 >= 2.0 * 105 (210)

@pytest.mark.asyncio
async def test_5_insufficient_data_anti_hallucination(mock_slm_provider):
    agent = DemandAgent(slm_provider=mock_slm_provider)

    # Snapshot with only 1 observation period
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-DEM-5",
        drugs=[DrugSchema(drug_id="DRUG-101", name="Aspirin", category="Analgesic", unit="tablets")],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-A", drug_id="DRUG-101", period_start=date(2026, 1, 1), period_end=date(2026, 1, 7), quantity_consumed=100, daily_avg_consumption=14.2)
        ]
    )

    findings = await agent.analyze(snapshot)
    assert len(findings) == 1
    finding = findings[0]

    assert finding.finding_type == "insufficient_data"
    assert finding.severity == "low"
    assert finding.metrics["observation_count"] == 1
    assert finding.metrics["baseline_average"] is None
    assert finding.metrics["trend_percentage"] is None
    mock_slm_provider.generate_structured.assert_not_called() # Zero SLM call if insufficient data!
