# ai_service/tests/test_traceability_blockchain.py
import pytest
from app.traceability.schemas import (
    TraceabilityEventSchema,
    TraceabilityEventType,
    BatchVerificationRequestSchema,
    ProductIdentityStatus,
    ProvenanceStatus,
    ConditionStatus,
    OverallTrustStatus,
)
from app.traceability.ledger import PermissionedLedgerSimulator, GENESIS_HASH
from app.traceability.verifier import DeterministicVerificationEngine
from app.traceability.service import TraceabilityService

@pytest.fixture
def clean_ledger():
    return PermissionedLedgerSimulator()

@pytest.fixture
def verifier(clean_ledger):
    return DeterministicVerificationEngine(clean_ledger)

def test_1_genesis_block_creation(clean_ledger):
    evt = TraceabilityEventSchema(
        event_id="EVT-001",
        batch_id="BATCH-TEST-01",
        drug_id="DRUG-101",
        event_type=TraceabilityEventType.MANUFACTURED,
        actor_id="ACTOR-01",
        actor_role="MANUFACTURER_MANAGER",
        location_id="FACILITY-01",
        timestamp="2026-08-01T10:00:00Z"
    )
    recorded = clean_ledger.record_event(evt)
    assert recorded.payload_hash is not None
    assert recorded.event_hash is not None
    assert recorded.previous_event_hash == GENESIS_HASH

def test_2_hash_chain_linkage(clean_ledger):
    evt1 = TraceabilityEventSchema(
        event_id="EVT-001",
        batch_id="BATCH-TEST-02",
        drug_id="DRUG-101",
        event_type=TraceabilityEventType.MANUFACTURED,
        actor_id="ACTOR-01",
        actor_role="MFG",
        location_id="FACILITY-01",
        timestamp="2026-08-01T10:00:00Z"
    )
    evt2 = TraceabilityEventSchema(
        event_id="EVT-002",
        batch_id="BATCH-TEST-02",
        drug_id="DRUG-101",
        event_type=TraceabilityEventType.SHIPPED,
        actor_id="ACTOR-02",
        actor_role="LOGISTICS",
        location_id="FACILITY-01",
        timestamp="2026-08-02T10:00:00Z"
    )
    rec1 = clean_ledger.record_event(evt1)
    rec2 = clean_ledger.record_event(evt2)
    assert rec2.previous_event_hash == rec1.event_hash
    is_valid, err = clean_ledger.verify_chain_integrity("BATCH-TEST-02")
    assert is_valid is True
    assert err is None

def test_3_tampered_payload_detection(clean_ledger):
    evt = TraceabilityEventSchema(
        event_id="EVT-001",
        batch_id="BATCH-TAMPER",
        drug_id="DRUG-101",
        event_type=TraceabilityEventType.MANUFACTURED,
        actor_id="ACTOR-01",
        actor_role="MFG",
        location_id="FACILITY-01",
        timestamp="2026-08-01T10:00:00Z"
    )
    rec = clean_ledger.record_event(evt)
    rec.actor_id = "MALICIOUS_ATTACKER"
    is_valid, err = clean_ledger.verify_chain_integrity("BATCH-TAMPER")
    assert is_valid is False
    assert "payload modified/tampered" in err

def test_4_cold_chain_breach(clean_ledger, verifier):
    evt1 = TraceabilityEventSchema(
        event_id="EVT-001",
        batch_id="BATCH-COLD",
        drug_id="DRUG-004",
        event_type=TraceabilityEventType.MANUFACTURED,
        actor_id="ACTOR-01",
        actor_role="MFG",
        location_id="FACILITY-01",
        timestamp="2026-08-01T10:00:00Z",
        temperature_c=4.0
    )
    evt2 = TraceabilityEventSchema(
        event_id="EVT-002",
        batch_id="BATCH-COLD",
        drug_id="DRUG-004",
        event_type=TraceabilityEventType.SHIPPED,
        actor_id="ACTOR-02",
        actor_role="LOGISTICS",
        location_id="ROUTE-01",
        timestamp="2026-08-02T10:00:00Z",
        temperature_c=14.5 # Breach!
    )
    clean_ledger.record_event(evt1)
    clean_ledger.record_event(evt2)
    res = verifier.verify(BatchVerificationRequestSchema(batch_id="BATCH-COLD"))
    assert res.condition_status == ConditionStatus.CONDITION_BREACH
    assert res.verification_status == OverallTrustStatus.CONDITION_BREACH
    assert res.requires_human_review is True

def test_5_service_seed_datasets():
    service = TraceabilityService()
    res_001 = service.verify_batch(BatchVerificationRequestSchema(batch_id="BATCH-001"))
    assert res_001.verification_status == OverallTrustStatus.TRUSTED_PRODUCT
    assert res_001.total_ledger_events == 5

    res_err = service.verify_batch(BatchVerificationRequestSchema(batch_id="BATCH-ERR-99"))
    assert res_err.verification_status == OverallTrustStatus.COUNTERFEIT_SUSPECTED
    assert res_err.requires_human_review is True
