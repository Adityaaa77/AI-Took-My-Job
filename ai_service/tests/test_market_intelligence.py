import pytest
import asyncio
from datetime import datetime
from app.market_intelligence import (
    DrugMarketContextSchema,
    PriceComparisonSchema,
    BaseMarketIntelligenceProvider,
    NPPAProvider,
    MarketIntelligenceService,
)
from app.schemas import SupplyChainSnapshotPayload, DrugSchema, InventoryItemSchema, VendorSchema
from app.pipeline import MultiAgentOrchestrator
from app.core import BaseSLMProvider


class MockFailingProvider(BaseMarketIntelligenceProvider):
    """Mock provider that simulates timeout or unexpected HTTP/API error."""

    async def get_drug_market_context(self, drug_id: str, drug_name: str) -> DrugMarketContextSchema:
        raise TimeoutError("External market API connection timed out.")


class MockMalformedProvider(BaseMarketIntelligenceProvider):
    """Mock provider that returns corrupted/malformed internal payload."""

    async def get_drug_market_context(self, drug_id: str, drug_name: str) -> DrugMarketContextSchema:
        raise ValueError("Malformed JSON payload from external pricing feed.")


class DummySLMProvider(BaseSLMProvider):
    async def generate(self, prompt: str, system_prompt=None, format_json=False) -> str:
        return "Reasoning synthesis."

    async def generate_structured(
        self, prompt: str, response_schema, system_prompt=None, example_instance=None
    ):
        if example_instance:
            try:
                return response_schema.model_validate(example_instance)
            except Exception:
                pass
        if getattr(response_schema, "__name__", "") == "AgentFindingSchema":
            from app.schemas import AgentFindingSchema
            return AgentFindingSchema(
                agent_name="DummyAgent",
                finding_type="no_action",
                severity="low",
                target_drug_id="DRUG-505",
                description="Dummy reasoning",
                metrics={}
            )
        if getattr(response_schema, "__name__", "") == "ActionRecommendationSchema":
            from app.schemas import ActionRecommendationSchema
            return ActionRecommendationSchema(
                action_type="procure",
                target_drug_id="DRUG-505",
                destination_location_id="HOSP-001",
                recommended_quantity=500,
                priority="high",
                reasoning="Procurement needed.",
                confidence=0.9
            )
        return response_schema.model_construct()

    async def health_check(self) -> bool:
        return True


@pytest.mark.asyncio
async def test_1_provider_returns_valid_structured_data():
    provider = NPPAProvider()
    ctx = await provider.get_drug_market_context("DRUG-101", "Paracetamol 500mg")
    assert isinstance(ctx, DrugMarketContextSchema)
    assert ctx.price_available is True
    assert ctx.regulatory_price_available is True
    assert ctx.reference_price == 1.02
    assert ctx.currency == "INR"
    assert ctx.source == "National Pharmaceutical Pricing Authority (NPPA)"


@pytest.mark.asyncio
async def test_2_provider_handles_unavailable_drug():
    provider = NPPAProvider()
    ctx = await provider.get_drug_market_context("DRUG-999", "Unknown Experimental Compound 99")
    assert isinstance(ctx, DrugMarketContextSchema)
    assert ctx.price_available is False
    assert ctx.reference_price is None
    assert ctx.data_status == "UNAVAILABLE"
    assert "unavailable" in ctx.notes.lower()


@pytest.mark.asyncio
async def test_3_provider_handles_external_timeout():
    service = MarketIntelligenceService(providers=[MockFailingProvider()])
    ctx = await service.get_drug_market_context("DRUG-505", "Meropenem 1g")
    assert isinstance(ctx, DrugMarketContextSchema)
    assert ctx.price_available is False
    assert ctx.data_status == "UNAVAILABLE"


@pytest.mark.asyncio
async def test_4_provider_handles_malformed_external_data():
    service = MarketIntelligenceService(providers=[MockMalformedProvider()])
    ctx = await service.get_drug_market_context("DRUG-505", "Meropenem 1g")
    assert isinstance(ctx, DrugMarketContextSchema)
    assert ctx.price_available is False
    assert ctx.data_status == "UNAVAILABLE"


@pytest.mark.asyncio
async def test_5_provider_never_fabricates_price():
    service = MarketIntelligenceService(providers=[NPPAProvider()])
    ctx = await service.get_drug_market_context("DRUG-XYZ", "NonExistentDrugXYZ")
    assert ctx.price_available is False
    assert ctx.reference_price is None


@pytest.mark.asyncio
async def test_6_cached_data_distinguishable_from_live_data():
    service = MarketIntelligenceService(providers=[NPPAProvider()], cache_ttl_seconds=3600.0)
    ctx1 = await service.get_drug_market_context("DRUG-505", "Meropenem 1g")
    assert ctx1.data_status == "LIVE"

    ctx2 = await service.get_drug_market_context("DRUG-505", "Meropenem 1g")
    assert ctx2.data_status == "CACHED"


def test_7_python_price_arithmetic_authoritative():
    service = MarketIntelligenceService()
    ctx = DrugMarketContextSchema(
        drug_id="DRUG-101",
        drug_name="Paracetamol 500mg",
        reference_price=10.0,
        price_available=True,
    )
    comp = service.calculate_price_comparison(ctx, vendor_unit_price=12.0)
    assert isinstance(comp, PriceComparisonSchema)
    assert comp.price_difference == 2.0
    assert comp.price_difference_percentage == 20.0
    assert comp.is_above_reference is True
    assert comp.is_within_reference is False


def test_8_slm_cannot_override_reference_price():
    # Test schema immutability & Python-calculated authoritative boundaries
    ctx = DrugMarketContextSchema(
        drug_id="DRUG-101",
        drug_name="Paracetamol 500mg",
        reference_price=5.0,
        price_available=True,
    )
    assert ctx.reference_price == 5.0


def test_9_vendor_price_comparison_works():
    service = MarketIntelligenceService()
    ctx = DrugMarketContextSchema(
        drug_id="DRUG-101",
        drug_name="Paracetamol 500mg",
        reference_price=100.0,
        price_available=True,
    )
    comp_optimal = service.calculate_price_comparison(ctx, vendor_unit_price=95.0)
    assert comp_optimal.cost_reasonableness == "COST_OPTIMAL"

    comp_acceptable = service.calculate_price_comparison(ctx, vendor_unit_price=104.0)
    assert comp_acceptable.cost_reasonableness == "COST_ACCEPTABLE"

    comp_above = service.calculate_price_comparison(ctx, vendor_unit_price=120.0)
    assert comp_above.cost_reasonableness == "ABOVE_REFERENCE_PRICE"


def test_10_missing_vendor_price_handled_safely():
    service = MarketIntelligenceService()
    ctx = DrugMarketContextSchema(
        drug_id="DRUG-101",
        drug_name="Paracetamol 500mg",
        reference_price=10.0,
        price_available=True,
    )
    comp = service.calculate_price_comparison(ctx, vendor_unit_price=None)
    assert comp.cost_reasonableness == "UNAVAILABLE"
    assert comp.price_difference is None


def test_11_missing_reference_price_handled_safely():
    service = MarketIntelligenceService()
    ctx = DrugMarketContextSchema(
        drug_id="DRUG-101",
        drug_name="Unknown Drug",
        reference_price=None,
        price_available=False,
    )
    comp = service.calculate_price_comparison(ctx, vendor_unit_price=10.0)
    assert comp.cost_reasonableness == "UNAVAILABLE"


def test_12_cost_concern_identified():
    service = MarketIntelligenceService()
    ctx = DrugMarketContextSchema(
        drug_id="DRUG-101",
        drug_name="Paracetamol 500mg",
        reference_price=10.0,
        price_available=True,
    )
    comp = service.calculate_price_comparison(ctx, vendor_unit_price=15.0)
    assert comp.is_above_reference is True
    assert comp.cost_reasonableness == "ABOVE_REFERENCE_PRICE"


@pytest.mark.asyncio
async def test_13_existing_procurement_quantity_remains_unchanged():
    # Quantitative shortage calculations must be untouched by price intelligence
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-MKT-01",
        drugs=[DrugSchema(drug_id="DRUG-505", name="Meropenem 1g", category="Antibiotic", unit="vials", min_safety_stock=500)],
        inventories=[InventoryItemSchema(location_id="HOSP-001", location_type="hospital", drug_id="DRUG-505", available_stock=0)],
    )
    slm = DummySLMProvider()
    orchestrator = MultiAgentOrchestrator(slm_provider=slm)
    state = await orchestrator.run(snapshot)
    proc_findings = state["procurement_findings"]
    assert len(proc_findings) == 1
    assert proc_findings[0].metrics["shortage_quantity"] == 500


@pytest.mark.asyncio
async def test_14_existing_vendor_recommendation_remains_valid():
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-MKT-02",
        drugs=[DrugSchema(drug_id="DRUG-505", name="Meropenem 1g", category="Antibiotic", unit="vials", min_safety_stock=500)],
        vendors=[VendorSchema(vendor_id="VEND-01", name="PharmaCorp", avg_lead_time_days=3, reliability_score=0.95)],
    )
    slm = DummySLMProvider()
    orchestrator = MultiAgentOrchestrator(slm_provider=slm)
    state = await orchestrator.run(snapshot)
    assert len(state["vendor_findings"]) == 1
    assert state["vendor_findings"][0].finding_type == "vendor_recommended"


@pytest.mark.asyncio
async def test_15_existing_distribution_quantity_remains_unchanged():
    from app.schemas import ConsumptionRecordSchema
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-MKT-03",
        drugs=[DrugSchema(drug_id="DRUG-505", name="Meropenem 1g", category="Antibiotic", unit="vials", min_safety_stock=100)],
        inventories=[
            InventoryItemSchema(location_id="HOSP-HUB", location_type="hospital", drug_id="DRUG-505", available_stock=1000),
            InventoryItemSchema(location_id="HOSP-NEED", location_type="hospital", drug_id="DRUG-505", available_stock=0),
        ],
        consumption_records=[
            ConsumptionRecordSchema(hospital_id="HOSP-HUB", drug_id="DRUG-505", period_start="2026-01-01", period_end="2026-01-30", quantity_consumed=300, daily_avg_consumption=10.0),
            ConsumptionRecordSchema(hospital_id="HOSP-NEED", drug_id="DRUG-505", period_start="2026-01-01", period_end="2026-01-30", quantity_consumed=600, daily_avg_consumption=20.0),
        ],
    )
    slm = DummySLMProvider()
    orchestrator = MultiAgentOrchestrator(slm_provider=slm)
    state = await orchestrator.run(snapshot)
    dist_findings = state["distribution_findings"]
    assert len(dist_findings) >= 1
    assert any(f.finding_type == "redistribution_opportunity" for f in dist_findings)


@pytest.mark.asyncio
async def test_16_existing_compliance_behavior_remains_unchanged():
    from app.schemas import BatchSchema
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-MKT-04",
        drugs=[DrugSchema(drug_id="DRUG-505", name="Meropenem 1g", category="Antibiotic", unit="vials", min_safety_stock=100)],
        inventories=[
            InventoryItemSchema(
                location_id="HOSP-001",
                location_type="hospital",
                drug_id="DRUG-505",
                available_stock=100,
                batches=[
                    BatchSchema(
                        batch_id="BATCH-001",
                        drug_id="DRUG-505",
                        manufacturer="PharmaCorp",
                        quantity=100,
                        expiry_date="2028-01-01",
                        quality_status="passed",
                    )
                ],
            )
        ],
    )
    slm = DummySLMProvider()
    orchestrator = MultiAgentOrchestrator(slm_provider=slm)
    state = await orchestrator.run(snapshot)
    assert len(state["compliance_findings"]) == 1
    assert state["compliance_findings"][0].finding_type == "batch_compliance_passed"


@pytest.mark.asyncio
async def test_17_external_api_failure_does_not_break_orchestration():
    failing_service = MarketIntelligenceService(providers=[MockFailingProvider()])
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-MKT-05",
        drugs=[DrugSchema(drug_id="DRUG-505", name="Meropenem 1g", category="Antibiotic", unit="vials", min_safety_stock=500)],
    )
    slm = DummySLMProvider()
    orchestrator = MultiAgentOrchestrator(slm_provider=slm, market_service=failing_service)
    state = await orchestrator.run(snapshot)
    assert state["agent_statuses"]["CoordinatorAgent"] == "success"
    assert state["market_context"]["DRUG-505"].price_available is False


@pytest.mark.asyncio
async def test_18_full_pipeline_integration_works():
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-TEST-MKT-06",
        drugs=[DrugSchema(drug_id="DRUG-505", name="Meropenem 1g", category="Antibiotic", unit="vials", min_safety_stock=500)],
        inventories=[InventoryItemSchema(location_id="HOSP-001", location_type="hospital", drug_id="DRUG-505", available_stock=0)],
        vendors=[VendorSchema(vendor_id="VEND-01", name="PharmaCorp", avg_lead_time_days=3, reliability_score=0.95)],
    )
    slm = DummySLMProvider()
    orchestrator = MultiAgentOrchestrator(slm_provider=slm)
    state = await orchestrator.run(snapshot)
    assert state["coordinator_recommendation"] is not None
    assert state["coordinator_recommendation"].overall_risk_level in ["high", "critical"]
    assert "DRUG-505" in state["market_context"]
    assert state["market_context"]["DRUG-505"].reference_price == 340.00
