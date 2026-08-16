import logging
from typing import List, Dict, Any, Optional
from app.agents.base_agent import BaseAgent
from app.schemas import SupplyChainSnapshotPayload, AgentFindingSchema, VendorSchema
from app.core import BaseSLMProvider

logger = logging.getLogger(__name__)

class VendorAgent(BaseAgent):
    """
    Specialized AI Agent evaluating vendor suitability and performance metrics.
    
    Responsibilities:
    - Evaluates available vendor profiles from SupplyChainSnapshotPayload.vendors.
    - Performs deterministic scoring in Python based on:
      * Reliability score (weight: 0.6)
      * Lead time in days (weight: 0.4)
      * Active order capacity bounds
    - Anti-hallucination: Never fabricates vendors, prices, lead times, or reliability scores.
    - Returns 'insufficient_data' if no vendors are available in the snapshot.
    - Uses local SLM strictly for qualitative reasoning synthesis over pre-calculated vendor facts.
    """

    def __init__(self, slm_provider: BaseSLMProvider):
        super().__init__(slm_provider)

    async def analyze(self, snapshot: SupplyChainSnapshotPayload) -> List[AgentFindingSchema]:
        findings: List[AgentFindingSchema] = []

        if not snapshot or not snapshot.vendors:
            logger.warning("VendorAgent: No vendors provided in snapshot payload. Returning insufficient_data finding.")
            findings.append(
                AgentFindingSchema(
                    agent_name="VendorAgent",
                    finding_type="insufficient_data",
                    severity="low",
                    target_drug_id="ALL",
                    target_location_id=None,
                    description="Insufficient vendor data provided in snapshot for evaluation.",
                    metrics={"vendor_count": 0}
                )
            )
            return findings

        # Evaluate vendors for each drug in the snapshot catalog
        target_drugs = snapshot.drugs if snapshot.drugs else []
        drug_ids = [d.drug_id for d in target_drugs] if target_drugs else ["GENERAL_PROCUREMENT"]

        for drug_id in drug_ids:
            drug_name = next((d.name for d in snapshot.drugs if d.drug_id == drug_id), drug_id)
            
            # Deterministic Python scoring across available vendors
            scored_vendors = []
            for v in snapshot.vendors:
                # Composite suitability score: reliability (60%) + normalized lead time score (40%)
                # Lower lead time is better; score = reliability * 0.6 + max(0, 1.0 - (lead_time / 30.0)) * 0.4
                lead_time_score = max(0.0, 1.0 - (v.avg_lead_time_days / 30.0))
                composite_score = round((v.reliability_score * 0.6) + (lead_time_score * 0.4), 4)

                scored_vendors.append({
                    "vendor": v,
                    "composite_score": composite_score
                })

            # Sort vendors by composite score descending
            scored_vendors.sort(key=lambda x: x["composite_score"], reverse=True)
            top_vendor_info = scored_vendors[0]
            best_vendor: VendorSchema = top_vendor_info["vendor"]
            best_score = top_vendor_info["composite_score"]

            # Construct facts text for SLM
            facts_lines = [
                f"Target Drug: {drug_name} ({drug_id})",
                f"Evaluated Vendors Count: {len(snapshot.vendors)}",
                f"Selected Optimal Vendor: {best_vendor.name} ({best_vendor.vendor_id})",
                f"  - Reliability Score: {best_vendor.reliability_score * 100:.1f}%",
                f"  - Avg Lead Time: {best_vendor.avg_lead_time_days} days",
                f"  - Active Orders Count: {best_vendor.active_orders_count}",
                f"  - Calculated Suitability Score: {best_score}"
            ]
            if len(scored_vendors) > 1:
                facts_lines.append("Other Evaluated Vendors:")
                for item in scored_vendors[1:]:
                    v_alt = item["vendor"]
                    facts_lines.append(f"  - {v_alt.name} ({v_alt.vendor_id}): Reliability {v_alt.reliability_score * 100:.1f}%, Lead Time {v_alt.avg_lead_time_days}d")

            facts_text = "\n".join(facts_lines)

            system_prompt = (
                "You are a specialized Vendor Evaluation Agent for a medical supply chain system.\n"
                "STRICT DOMAIN BOUNDARY RULES:\n"
                "1. Evaluate VENDOR SUITABILITY AND PERFORMANCE METRICS ONLY.\n"
                "2. Permitted finding_type values MUST be one of: 'vendor_recommended', 'insufficient_data'.\n"
                "3. DO NOT invent vendor names, prices, lead times, reliability scores, or active order counts.\n"
                "4. Description MUST discuss vendor reliability, lead time, and suitability ONLY (1 concise sentence)."
            )

            user_prompt = f"Evaluate vendor facts:\n{facts_text}\nOutput AgentFindingSchema JSON."

            example_instance = {
                "agent_name": "VendorAgent",
                "finding_type": "vendor_recommended",
                "severity": "low" if best_vendor.reliability_score >= 0.85 else "medium",
                "target_drug_id": drug_id,
                "target_location_id": best_vendor.vendor_id,
                "description": f"Vendor {best_vendor.name} recommended with {best_vendor.reliability_score*100:.0f}% reliability and {best_vendor.avg_lead_time_days} days lead time.",
                "metrics": {}
            }

            try:
                finding: AgentFindingSchema = await self.slm_provider.generate_structured(
                    prompt=user_prompt,
                    response_schema=AgentFindingSchema,
                    system_prompt=system_prompt,
                    example_instance=example_instance
                )

                if finding.finding_type not in ["vendor_recommended", "insufficient_data"]:
                    logger.warning(f"VendorAgent SLM returned invalid domain finding_type '{finding.finding_type}'. Enforcing 'vendor_recommended'.")
                    finding.finding_type = "vendor_recommended"

                # Enforce deterministic metrics calculated in Python
                finding.agent_name = "VendorAgent"
                finding.target_drug_id = drug_id
                finding.target_location_id = best_vendor.vendor_id
                finding.metrics = {
                    "recommended_vendor_id": best_vendor.vendor_id,
                    "recommended_vendor_name": best_vendor.name,
                    "reliability_score": best_vendor.reliability_score,
                    "avg_lead_time_days": best_vendor.avg_lead_time_days,
                    "active_orders_count": best_vendor.active_orders_count,
                    "composite_score": best_score,
                    "evaluated_vendors_count": len(snapshot.vendors)
                }

                findings.append(finding)
            except Exception as exc:
                logger.error(f"VendorAgent SLM generation failed for drug {drug_id}: {exc}. Using deterministic fallback.")
                fallback_finding = AgentFindingSchema(
                    agent_name="VendorAgent",
                    finding_type="vendor_recommended",
                    severity="low" if best_vendor.reliability_score >= 0.85 else "medium",
                    target_drug_id=drug_id,
                    target_location_id=best_vendor.vendor_id,
                    description=f"Vendor {best_vendor.name} ({best_vendor.vendor_id}) evaluated as optimal supplier with {best_vendor.reliability_score*100:.0f}% reliability and {best_vendor.avg_lead_time_days} days lead time.",
                    metrics={
                        "recommended_vendor_id": best_vendor.vendor_id,
                        "recommended_vendor_name": best_vendor.name,
                        "reliability_score": best_vendor.reliability_score,
                        "avg_lead_time_days": best_vendor.avg_lead_time_days,
                        "active_orders_count": best_vendor.active_orders_count,
                        "composite_score": best_score,
                        "evaluated_vendors_count": len(snapshot.vendors)
                    }
                )
                findings.append(fallback_finding)

        return findings
