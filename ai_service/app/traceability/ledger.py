# ai_service/app/traceability/ledger.py
import hashlib
import json
from typing import Dict, List, Tuple, Optional
from app.traceability.schemas import TraceabilityEventSchema

GENESIS_HASH = "GENESIS"

class PermissionedLedgerSimulator:
    """
    Hyperledger Fabric-Compatible Permissioned DLT Ledger Prototype.
    Computes immutable SHA-256 block hash-chaining linking every event block.
    """
    def __init__(self):
        # Memory storage mapping batch_id -> List[TraceabilityEventSchema]
        self._ledger: Dict[str, List[TraceabilityEventSchema]] = {}

    def compute_payload_hash(self, event: TraceabilityEventSchema) -> str:
        payload_data = {
            "event_id": event.event_id,
            "batch_id": event.batch_id,
            "drug_id": event.drug_id,
            "gtin": event.gtin,
            "serial_number": event.serial_number,
            "event_type": event.event_type.value if hasattr(event.event_type, "value") else str(event.event_type),
            "actor_id": event.actor_id,
            "actor_role": event.actor_role,
            "location_id": event.location_id,
            "timestamp": event.timestamp,
            "temperature_c": event.temperature_c,
            "humidity_percent": event.humidity_percent,
            "notes": event.notes,
        }
        canonical_json = json.dumps(payload_data, sort_keys=True)
        return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

    def compute_event_hash(self, previous_hash: str, payload_hash: str, event_id: str) -> str:
        raw_str = f"{previous_hash}:{payload_hash}:{event_id}"
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    def record_event(self, event: TraceabilityEventSchema) -> TraceabilityEventSchema:
        batch_id = event.batch_id
        if batch_id not in self._ledger:
            self._ledger[batch_id] = []
        
        timeline = self._ledger[batch_id]
        if not timeline:
            previous_hash = GENESIS_HASH
        else:
            previous_hash = timeline[-1].event_hash or GENESIS_HASH
        
        payload_hash = self.compute_payload_hash(event)
        event_hash = self.compute_event_hash(previous_hash, payload_hash, event.event_id)
        
        event.payload_hash = payload_hash
        event.previous_event_hash = previous_hash
        event.event_hash = event_hash
        
        timeline.append(event)
        return event

    def get_batch_timeline(self, batch_id: str) -> List[TraceabilityEventSchema]:
        return self._ledger.get(batch_id, [])

    def verify_chain_integrity(self, batch_id: str) -> Tuple[bool, Optional[str]]:
        timeline = self._ledger.get(batch_id, [])
        if not timeline:
            return True, None
        
        expected_prev_hash = GENESIS_HASH
        for idx, block in enumerate(timeline):
            if block.previous_event_hash != expected_prev_hash:
                return False, f"Block #{idx} ({block.event_id}) broke chain linkage. Expected prev_hash {expected_prev_hash[:12]}... but got {str(block.previous_event_hash)[:12]}..."
            
            recalculated_payload_hash = self.compute_payload_hash(block)
            if block.payload_hash != recalculated_payload_hash:
                return False, f"Block #{idx} ({block.event_id}) payload modified/tampered. Stored payload_hash {str(block.payload_hash)[:12]}... differs from computed hash."
            
            recalculated_event_hash = self.compute_event_hash(expected_prev_hash, recalculated_payload_hash, block.event_id)
            if block.event_hash != recalculated_event_hash:
                return False, f"Block #{idx} ({block.event_id}) leaf event_hash forged/modified."
            
            expected_prev_hash = block.event_hash
            
        return True, None
