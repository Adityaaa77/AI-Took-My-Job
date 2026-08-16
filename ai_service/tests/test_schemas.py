from datetime import date, datetime
import pytest
from pydantic import ValidationError
from app.schemas import (
    DrugSchema,
    BatchSchema,
    HospitalSchema,
    InventoryItemSchema,
    ConsumptionRecordSchema,
    VendorSchema,
    PurchaseOrderSchema,
    ShipmentSchema,
    SupplyChainSnapshotPayload,
    AgentFindingSchema,
    ActionRecommendationSchema,
    CoordinatorRecommendationResponse,
)

def test_drug_schema_valid():
    drug = DrugSchema(
        drug_id="DRUG-001",
        name="Amoxicillin 500mg",
        category="Antibiotic",
        unit="capsules",
        is_critical=True,
        min_safety_stock=200
    )
    assert drug.drug_id == "DRUG-001"
    assert drug.min_safety_stock == 200

def test_batch_schema_quality_status_validation():
    batch = BatchSchema(
        batch_id="B-100",
        drug_id="DRUG-001",
        manufacturer="PharmaCorp",
        quantity=500,
        expiry_date=date(2027, 12, 31),
        quality_status="passed"
    )
    assert batch.quality_status == "passed"

    with pytest.raises(ValidationError):
        BatchSchema(
            batch_id="B-101",
            drug_id="DRUG-001",
            manufacturer="PharmaCorp",
            quantity=500,
            expiry_date=date(2027, 12, 31),
            quality_status="invalid_status" # Invalid status literal
        )

def test_inventory_item_schema_negative_stock():
    with pytest.raises(ValidationError):
        InventoryItemSchema(
            location_id="HOSP-A",
            location_type="hospital",
            drug_id="DRUG-001",
            available_stock=-50 # Negative stock must fail
        )

def test_vendor_reliability_score_bounds():
    # Valid score
    vendor = VendorSchema(
        vendor_id="V-1",
        name="MedSupply",
        avg_lead_time_days=5,
        reliability_score=0.95
    )
    assert vendor.reliability_score == 0.95

    # Out of upper bound (> 1.0) must fail
    with pytest.raises(ValidationError):
        VendorSchema(
            vendor_id="V-2",
            name="MedSupply",
            avg_lead_time_days=5,
            reliability_score=1.5
        )

def test_full_supply_chain_snapshot_payload():
    snapshot = SupplyChainSnapshotPayload(
        snapshot_id="SNAP-2026-001",
        drugs=[
            DrugSchema(
                drug_id="D-1",
                name="Paracetamol",
                category="Analgesic",
                unit="tablets"
            )
        ],
        hospitals=[
            HospitalSchema(
                hospital_id="H-1",
                name="City Hospital",
                tier="District",
                location_zone="North"
            )
        ],
        inventories=[
            InventoryItemSchema(
                location_id="H-1",
                location_type="hospital",
                drug_id="D-1",
                available_stock=100
            )
        ]
    )
    assert snapshot.snapshot_id == "SNAP-2026-001"
    assert len(snapshot.drugs) == 1
    assert snapshot.inventories[0].available_stock == 100

def test_coordinator_recommendation_response():
    finding = AgentFindingSchema(
        agent_name="DemandAgent",
        finding_type="projected_stockout",
        severity="high",
        target_drug_id="D-1",
        target_location_id="H-1",
        description="Projected demand exceeds available inventory in 5 days.",
        metrics={"days_remaining": 5}
    )
    
    action = ActionRecommendationSchema(
        action_type="redistribute",
        target_drug_id="D-1",
        source_location_id="WAREHOUSE-NORTH",
        destination_location_id="H-1",
        recommended_quantity=500,
        priority="high",
        reasoning="Transfer surplus from WAREHOUSE-NORTH to prevent stockout at H-1."
    )

    response = CoordinatorRecommendationResponse(
        recommendation_id="REC-999",
        snapshot_id="SNAP-2026-001",
        overall_risk_level="high",
        agent_findings=[finding],
        recommended_actions=[action]
    )

    assert response.recommendation_id == "REC-999"
    assert len(response.agent_findings) == 1
    assert len(response.recommended_actions) == 1
    assert response.recommended_actions[0].action_type == "redistribute"
