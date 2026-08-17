# ai_service/app/traceability/service.py
from typing import List, Optional
from app.traceability.schemas import (
    TraceabilityEventSchema,
    TraceabilityEventType,
    BatchVerificationRequestSchema,
    BatchVerificationResponseSchema,
)
from app.traceability.ledger import PermissionedLedgerSimulator
from app.traceability.verifier import DeterministicVerificationEngine

class TraceabilityService:
    """
    Traceability Service managing the permissioned ledger and seed datasets.
    """
    def __init__(self):
        self.ledger = PermissionedLedgerSimulator()
        self.verifier = DeterministicVerificationEngine(self.ledger)
        self._seed_demo_datasets()

    def _seed_demo_datasets(self):
        # ---------------------------------------------------------------------
        # SEED DATASET 1: BATCH-001 (Authentic Trusted Paracetamol 500mg)
        # ---------------------------------------------------------------------
        events_001 = [
            TraceabilityEventSchema(
                event_id="EVT-1001",
                batch_id="BATCH-001",
                drug_id="DRUG-101",
                gtin="8901234567890",
                serial_number="SN-2026-10089",
                event_type=TraceabilityEventType.MANUFACTURED,
                actor_id="ACTOR-MFG-01",
                actor_role="MANUFACTURER_MANAGER",
                location_id="FACILITY-MUMBAI-01",
                timestamp="2026-08-01T08:00:00Z",
                temperature_c=4.5,
                humidity_percent=45.0,
                notes="Manufactured under GMP compliance."
            ),
            TraceabilityEventSchema(
                event_id="EVT-1002",
                batch_id="BATCH-001",
                drug_id="DRUG-101",
                gtin="8901234567890",
                serial_number="SN-2026-10089",
                event_type=TraceabilityEventType.QUALITY_CHECKED,
                actor_id="ACTOR-QA-02",
                actor_role="QUALITY_INSPECTOR",
                location_id="FACILITY-MUMBAI-01",
                timestamp="2026-08-02T10:30:00Z",
                temperature_c=4.2,
                humidity_percent=44.0,
                notes="Assay 99.8%, sterility passed."
            ),
            TraceabilityEventSchema(
                event_id="EVT-1003",
                batch_id="BATCH-001",
                drug_id="DRUG-101",
                gtin="8901234567890",
                serial_number="SN-2026-10089",
                event_type=TraceabilityEventType.SHIPPED,
                actor_id="ACTOR-LOG-05",
                actor_role="LOGISTICS_OPERATOR",
                location_id="ROUTE-MH-NH48",
                timestamp="2026-08-03T14:15:00Z",
                temperature_c=5.0,
                humidity_percent=48.0,
                notes="Dispatched via cold-chain reefer truck."
            ),
            TraceabilityEventSchema(
                event_id="EVT-1004",
                batch_id="BATCH-001",
                drug_id="DRUG-101",
                gtin="8901234567890",
                serial_number="SN-2026-10089",
                event_type=TraceabilityEventType.RECEIVED_WAREHOUSE,
                actor_id="ACTOR-WH-01",
                actor_role="WAREHOUSE_MANAGER",
                location_id="WH-CENTRAL-DELHI",
                timestamp="2026-08-05T09:00:00Z",
                temperature_c=4.8,
                humidity_percent=46.0,
                notes="Inbound dock verification passed."
            ),
            TraceabilityEventSchema(
                event_id="EVT-1005",
                batch_id="BATCH-001",
                drug_id="DRUG-101",
                gtin="8901234567890",
                serial_number="SN-2026-10089",
                event_type=TraceabilityEventType.RECEIVED_HOSPITAL,
                actor_id="ACTOR-HOSP-01",
                actor_role="HOSPITAL_PHARMACIST",
                location_id="HOSP-001",
                timestamp="2026-08-08T11:45:00Z",
                temperature_c=4.3,
                humidity_percent=43.0,
                notes="Hospital pharmacy stock entry verified."
            ),
        ]
        for evt in events_001:
            self.ledger.record_event(evt)

        # ---------------------------------------------------------------------
        # SEED DATASET 2: BATCH-COLD-02 (Cold-Chain Temp Excursion Propofol 1%)
        # ---------------------------------------------------------------------
        events_cold = [
            TraceabilityEventSchema(
                event_id="EVT-2001",
                batch_id="BATCH-COLD-02",
                drug_id="DRUG-004",
                gtin="8901234567891",
                serial_number="SN-2026-20012",
                event_type=TraceabilityEventType.MANUFACTURED,
                actor_id="ACTOR-MFG-01",
                actor_role="MANUFACTURER_MANAGER",
                location_id="FACILITY-PUNE-02",
                timestamp="2026-08-04T08:00:00Z",
                temperature_c=4.0,
                humidity_percent=40.0
            ),
            TraceabilityEventSchema(
                event_id="EVT-2002",
                batch_id="BATCH-COLD-02",
                drug_id="DRUG-004",
                gtin="8901234567891",
                serial_number="SN-2026-20012",
                event_type=TraceabilityEventType.SHIPPED,
                actor_id="ACTOR-LOG-09",
                actor_role="COLD_CHAIN_LOGISTICS",
                location_id="ROUTE-MH-NH48",
                timestamp="2026-08-06T13:00:00Z",
                temperature_c=14.5, # Temperature Excursion Breach! Allowed: 2-8°C
                humidity_percent=72.0,
                notes="Reefer cooling unit power failure recorded for 3 hours."
            )
        ]
        for evt in events_cold:
            self.ledger.record_event(evt)

        # ---------------------------------------------------------------------
        # SEED DATASET 3: BATCH-ERR-99 (Tampered Event Payload Attack)
        # ---------------------------------------------------------------------
        events_err = [
            TraceabilityEventSchema(
                event_id="EVT-9001",
                batch_id="BATCH-ERR-99",
                drug_id="DRUG-303",
                gtin="8901234567899",
                serial_number="SN-2026-99999",
                event_type=TraceabilityEventType.MANUFACTURED,
                actor_id="ACTOR-MFG-03",
                actor_role="MANUFACTURER_MANAGER",
                location_id="FACILITY-GUJARAT-03",
                timestamp="2026-08-01T07:00:00Z",
                temperature_c=5.0
            )
        ]
        rec_err = self.ledger.record_event(events_err[0])
        # Tamper payload hash linkage in memory to simulate counterfeit attack
        rec_err.actor_id = "MALICIOUS_ATTACKER_ID_TAMPERED"

    def record_event(self, event: TraceabilityEventSchema) -> TraceabilityEventSchema:
        return self.ledger.record_event(event)

    def verify_batch(self, request: BatchVerificationRequestSchema) -> BatchVerificationResponseSchema:
        return self.verifier.verify(request)

    def get_timeline(self, batch_id: str) -> List[TraceabilityEventSchema]:
        return self.ledger.get_batch_timeline(batch_id)

default_traceability_service = TraceabilityService()
