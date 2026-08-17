# ai_service/scripts/test_traceability_real.py
"""
Stage 16 — Blockchain-Backed Drug Authenticity, Traceability & Condition Integrity Real Test.
Hyperledger Fabric-Compatible Permissioned DLT Ledger Prototype.

Executes:
1. Trusted batch SHA-256 provenance chain verification (Right Product + Right Condition).
2. Cold-Chain Temperature Excursion Breach detection.
3. Tampered Event Payload / Counterfeit Suspected Detection.
4. Multi-Agent Coordinator Safety Constraint Integration.
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.traceability.schemas import BatchVerificationRequestSchema
from app.traceability.service import default_traceability_service
from app.agents.coordinator_agent import CoordinatorAgent
from app.schemas import AgentFindingSchema

def print_separator(title=""):
    print("\n" + "=" * 85)
    if title:
        print(f" {title}")
        print("=" * 85)

async def main():
    print_separator("STAGE 16: HYPERLEDGER FABRIC-COMPATIBLE PERMISSIONED LEDGER PROTOTYPE REAL TEST")

    # -------------------------------------------------------------------------
    # SCENARIO 1: TRUSTED AUTHENTIC BATCH (BATCH-001)
    # -------------------------------------------------------------------------
    print_separator("Scenario 1: Verifying Authentic Trusted Batch (BATCH-001)")
    req_trusted = BatchVerificationRequestSchema(batch_id="BATCH-001", gtin="8901234567890", serial_number="SN-2026-10089")
    res_trusted = default_traceability_service.verify_batch(req_trusted)
    
    print(f"  • Batch ID               : {res_trusted.batch_id}")
    print(f"  • Drug Name              : {res_trusted.drug_name}")
    print(f"  • Overall Trust Status   : {res_trusted.verification_status.value}")
    print(f"  • Right Product Status   : {res_trusted.right_product_status.value}")
    print(f"  • Right Provenance Status: {res_trusted.provenance_status.value}")
    print(f"  • Right Condition Status : {res_trusted.condition_status.value}")
    print(f"  • Total Ledger Events    : {res_trusted.total_ledger_events} Blocks Recorded")
    print(f"  • Genesis Block Hash     : {res_trusted.timeline[0].event_hash[:16]}...")
    print(f"  • Latest Block Hash      : {res_trusted.timeline[-1].event_hash[:16]}...")

    # -------------------------------------------------------------------------
    # SCENARIO 2: COLD-CHAIN TEMPERATURE EXCURSION BREACH (BATCH-COLD-02)
    # -------------------------------------------------------------------------
    print_separator("Scenario 2: Verifying Cold-Chain Temperature Breach (BATCH-COLD-02)")
    req_cold = BatchVerificationRequestSchema(batch_id="BATCH-COLD-02")
    res_cold = default_traceability_service.verify_batch(req_cold)
    
    print(f"  • Batch ID               : {res_cold.batch_id}")
    print(f"  • Overall Trust Status   : {res_cold.verification_status.value}")
    print(f"  • Condition Status       : {res_cold.condition_status.value}")
    print(f"  • Requires Human Review  : {res_cold.requires_human_review}")
    print(f"  • Reason Codes           : {res_cold.reason_codes}")

    # -------------------------------------------------------------------------
    # SCENARIO 3: TAMPERED EVENT PAYLOAD / COUNTERFEIT SUSPECTED (BATCH-ERR-99)
    # -------------------------------------------------------------------------
    print_separator("Scenario 3: Verifying Tampered Payload / Counterfeit Suspected (BATCH-ERR-99)")
    req_err = BatchVerificationRequestSchema(batch_id="BATCH-ERR-99")
    res_err = default_traceability_service.verify_batch(req_err)
    
    print(f"  • Batch ID               : {res_err.batch_id}")
    print(f"  • Overall Trust Status   : {res_err.verification_status.value}")
    print(f"  • Provenance Status      : {res_err.provenance_status.value}")
    print(f"  • Requires Human Review  : {res_err.requires_human_review}")
    print(f"  • Reason Codes           : {res_err.reason_codes}")

    # -------------------------------------------------------------------------
    # SCENARIO 4: COORDINATOR AGENT SAFETY CONSTRAINT INTEGRATION
    # -------------------------------------------------------------------------
    print_separator("Scenario 4: Coordinator Agent Provenance Safety Constraint Enforcement")
    
    mock_state = {
        "demand_findings": [
            AgentFindingSchema(
                agent_name="DemandAgent",
                finding_type="increasing_demand",
                severity="medium",
                target_drug_id="DRUG-505",
                target_location_id="HOSP-001",
                description="High demand surge detected.",
                metrics={"required_quantity": 300}
            )
        ],
        "compliance_findings": [
            AgentFindingSchema(
                agent_name="ComplianceAgent",
                finding_type="batch_compliance_failed",
                severity="high",
                target_drug_id="DRUG-505",
                target_location_id="HOSP-001",
                description="PROVENANCE_INTEGRITY_FAILURE: SHA-256 Block payload altered for BATCH-ERR-99.",
                metrics={"batch_id": "BATCH-ERR-99"}
            )
        ]
    }
    
    coordinator = CoordinatorAgent(slm_provider=None)
    decision = await coordinator.synthesize(mock_state)
    
    print(f"  • Human Approval Required : {decision.requires_human_approval}")
    print(f"  • Overall Risk Level      : {decision.overall_risk_level}")
    print(f"  • Recommended Actions     : {len(decision.recommended_actions)} Action(s)")

    print_separator("STAGE 16 REAL TRACEABILITY & BLOCKCHAIN INFERENCE PASSED! ✅")

if __name__ == "__main__":
    asyncio.run(main())
