import logging
from datetime import date
from typing import List, Dict, Any, Optional
from app.agents.base_agent import BaseAgent
from app.schemas import SupplyChainSnapshotPayload, AgentFindingSchema, BatchSchema
from app.core import BaseSLMProvider

logger = logging.getLogger(__name__)

class ComplianceAgent(BaseAgent):
    """
    Specialized AI Agent evaluating drug batch quality, expiration, and safety compliance.
    
    Responsibilities:
    - Inspects BatchSchema records across all InventoryItemSchema instances in the snapshot payload.
    - Performs 100% deterministic Python safety rules:
      * Detects expired batches (expiry_date < current_date).
      * Detects unsafe/quarantined/failed batches (quality_status in ["quarantine", "failed"]).
      * Aggregates compliant vs non-compliant stock quantities.
    - Anti-hallucination: Uses ONLY facts present in the snapshot. Never invents regulations, licenses, or certifications.
    - Returns 'insufficient_data' if no batch information is present in the snapshot payload.
    - Uses local SLM strictly for qualitative reasoning synthesis over pre-calculated compliance metrics.
    """

    def __init__(self, slm_provider: BaseSLMProvider):
        super().__init__(slm_provider)

    async def analyze(self, snapshot: SupplyChainSnapshotPayload) -> List[AgentFindingSchema]:
        findings: List[AgentFindingSchema] = []

        if not snapshot or not snapshot.inventories:
            logger.warning("ComplianceAgent: No inventory payload provided in snapshot. Returning insufficient_data.")
            findings.append(
                AgentFindingSchema(
                    agent_name="ComplianceAgent",
                    finding_type="insufficient_data",
                    severity="low",
                    target_drug_id="ALL",
                    target_location_id=None,
                    description="Insufficient inventory data provided in snapshot for compliance checking.",
                    metrics={"batch_count": 0}
                )
            )
            return findings

        # Collect all batches across inventory items
        all_batches: List[tuple[str, BatchSchema]] = []
        for item in snapshot.inventories:
            for b in item.batches:
                all_batches.append((item.location_id, b))

        if not all_batches:
            logger.warning("ComplianceAgent: No batch records present in inventory items. Returning insufficient_data.")
            findings.append(
                AgentFindingSchema(
                    agent_name="ComplianceAgent",
                    finding_type="insufficient_data",
                    severity="low",
                    target_drug_id="ALL",
                    target_location_id=None,
                    description="No batch records present in snapshot inventory items for quality compliance check.",
                    metrics={"batch_count": 0}
                )
            )
            return findings

        # Group batches by drug_id and location_id
        grouped_batches: Dict[tuple[str, str], List[BatchSchema]] = {}
        for loc_id, batch in all_batches:
            key = (batch.drug_id, loc_id)
            if key not in grouped_batches:
                grouped_batches[key] = []
            grouped_batches[key].append(batch)

        today = date.today()

        for (drug_id, loc_id), batches in grouped_batches.items():
            drug_name = next((d.name for d in snapshot.drugs if d.drug_id == drug_id), drug_id)

            compliant_batches = []
            expired_batches = []
            quarantined_batches = []
            failed_batches = []

            compliant_qty = 0
            non_compliant_qty = 0

            for b in batches:
                is_expired = b.expiry_date < today
                is_unsafe_status = b.quality_status in ["quarantine", "failed"]

                # Perform deterministic blockchain traceability & provenance verification
                from app.traceability.service import default_traceability_service
                from app.traceability.schemas import BatchVerificationRequestSchema, OverallTrustStatus
                traceability_res = default_traceability_service.verify_batch(
                    BatchVerificationRequestSchema(batch_id=b.batch_id, drug_id=b.drug_id)
                )

                if (
                    traceability_res.verification_status in [
                        OverallTrustStatus.COUNTERFEIT_SUSPECTED,
                        OverallTrustStatus.CONDITION_BREACH,
                    ]
                ):
                    is_unsafe_status = True

                if is_expired:
                    expired_batches.append(b)
                    non_compliant_qty += b.quantity
                elif b.quality_status == "quarantine":
                    quarantined_batches.append(b)
                    non_compliant_qty += b.quantity
                elif b.quality_status == "failed":
                    failed_batches.append(b)
                    non_compliant_qty += b.quantity
                else:
                    compliant_batches.append(b)
                    compliant_qty += b.quantity

            total_checked = len(batches)
            has_violations = len(expired_batches) > 0 or len(quarantined_batches) > 0 or len(failed_batches) > 0

            finding_type = "batch_compliance_failed" if has_violations else "batch_compliance_passed"
            severity = "high" if len(expired_batches) > 0 or len(failed_batches) > 0 else ("medium" if len(quarantined_batches) > 0 else "low")

            facts_text = (
                f"Location: {loc_id}\n"
                f"Drug: {drug_name} ({drug_id})\n"
                f"Total Batches Checked: {total_checked}\n"
                f"Compliant Batches: {len(compliant_batches)} ({compliant_qty} units)\n"
                f"Expired Batches: {len(expired_batches)}\n"
                f"Quarantined Batches: {len(quarantined_batches)}\n"
                f"Failed Quality Batches: {len(failed_batches)}\n"
                f"Total Non-Compliant Stock: {non_compliant_qty} units"
            )

            system_prompt = (
                "You are a specialized Compliance and Safety Agent for a medical supply chain system.\n"
                "STRICT DOMAIN BOUNDARY RULES:\n"
                "1. Evaluate BATCH QUALITY STATUS, EXPIRATION, AND SAFETY COMPLIANCE ONLY.\n"
                "2. Permitted finding_type values MUST be one of: 'batch_compliance_passed', 'batch_compliance_failed', 'insufficient_data'.\n"
                "3. DO NOT invent regulations, licenses, certificates, laws, or non-existent batch numbers.\n"
                "4. Description MUST discuss batch safety status and non-compliant quantity ONLY (1 concise sentence)."
            )

            user_prompt = f"Analyze compliance facts:\n{facts_text}\nOutput AgentFindingSchema JSON."

            example_instance = {
                "agent_name": "ComplianceAgent",
                "finding_type": finding_type,
                "severity": severity,
                "target_drug_id": drug_id,
                "target_location_id": loc_id,
                "description": f"Compliance check {finding_type} for {drug_name} at {loc_id}. {non_compliant_qty} non-compliant units identified.",
                "metrics": {}
            }

            try:
                finding: AgentFindingSchema = await self.slm_provider.generate_structured(
                    prompt=user_prompt,
                    response_schema=AgentFindingSchema,
                    system_prompt=system_prompt,
                    example_instance=example_instance
                )

                # Enforce deterministic classification and metrics calculated in Python
                finding.agent_name = "ComplianceAgent"
                finding.finding_type = finding_type
                finding.severity = severity
                finding.target_drug_id = drug_id
                finding.target_location_id = loc_id
                finding.metrics = {
                    "total_batches_checked": total_checked,
                    "compliant_batch_count": len(compliant_batches),
                    "expired_batch_count": len(expired_batches),
                    "quarantined_batch_count": len(quarantined_batches),
                    "failed_batch_count": len(failed_batches),
                    "compliant_stock_quantity": compliant_qty,
                    "non_compliant_stock_quantity": non_compliant_qty,
                    "has_violations": has_violations
                }

                findings.append(finding)
            except Exception as exc:
                logger.error(f"ComplianceAgent SLM generation failed for drug {drug_id} @ {loc_id}: {exc}. Using deterministic fallback.")
                fallback_finding = AgentFindingSchema(
                    agent_name="ComplianceAgent",
                    finding_type=finding_type,
                    severity=severity,
                    target_drug_id=drug_id,
                    target_location_id=loc_id,
                    description=f"Batch compliance check for {drug_name} at {loc_id}: {total_checked} batches evaluated, {non_compliant_qty} non-compliant units detected.",
                    metrics={
                        "total_batches_checked": total_checked,
                        "compliant_batch_count": len(compliant_batches),
                        "expired_batch_count": len(expired_batches),
                        "quarantined_batch_count": len(quarantined_batches),
                        "failed_batch_count": len(failed_batches),
                        "compliant_stock_quantity": compliant_qty,
                        "non_compliant_stock_quantity": non_compliant_qty,
                        "has_violations": has_violations
                    }
                )
                findings.append(fallback_finding)

        return findings
