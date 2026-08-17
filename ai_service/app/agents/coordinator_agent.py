import logging
import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from app.agents.base_agent import BaseAgent
from app.schemas import (
    SupplyChainSnapshotPayload,
    AgentFindingSchema,
    ActionRecommendationSchema,
    CoordinatorRecommendationResponse,
)
from app.core import BaseSLMProvider

logger = logging.getLogger(__name__)

class CoordinatorAgent(BaseAgent):
    """
    Coordinator / Decision Synthesis Agent with Stage 10A Deterministic Consistency Validation.
    
    Responsibilities:
    - Consumes aggregated findings from specialized agents (Inventory, Demand, Procurement, Distribution).
    - Performs deterministic decision prioritization in Python:
      1. Prioritizes 'redistribute' when stock shortage can be satisfied by an existing surplus elsewhere in the network.
      2. Recommends 'procure' when stock shortage cannot be resolved via redistribution.
      3. Recommends 'no_action' when stock is healthy/stable or when data is insufficient.
    - Deterministically validates all numerical fields, source/destination location IDs, and drug IDs against authoritative agent findings.
    - Clamps/replaces any invalid SLM-proposed quantities exceeding authoritative findings.
    - Ensures SLM natural language reasoning text is internally consistent with final validated numerical actions.
    - Produces a unified, human-approval-flagged CoordinatorRecommendationResponse.
    """

    def __init__(self, slm_provider: BaseSLMProvider):
        super().__init__(slm_provider)

    async def analyze(self, snapshot: SupplyChainSnapshotPayload) -> List[AgentFindingSchema]:
        """
        Implementation of BaseAgent abstract method.
        Wraps snapshot into state dictionary and delegates to synthesize.
        """
        state = {
            "snapshot": snapshot,
            "inventory_findings": [],
            "demand_findings": [],
            "procurement_findings": [],
            "distribution_findings": []
        }
        response = await self.synthesize(state)
        return response.agent_findings

    async def synthesize(self, state: Dict[str, Any]) -> CoordinatorRecommendationResponse:
        snapshot = state.get("snapshot")
        snapshot_id = snapshot.snapshot_id if snapshot else "UNKNOWN_SNAPSHOT"

        # Combine all findings from specialized agents into a single flat list
        all_findings: List[AgentFindingSchema] = []
        all_findings.extend(state.get("inventory_findings", []))
        all_findings.extend(state.get("demand_findings", []))
        all_findings.extend(state.get("procurement_findings", []))
        all_findings.extend(state.get("distribution_findings", []))
        all_findings.extend(state.get("vendor_findings", []))
        all_findings.extend(state.get("compliance_findings", []))

        # Include MarketIntelligence findings for Right Cost visibility across API & UI
        market_contexts = state.get("market_context", {})
        for drug_id, m_ctx in market_contexts.items():
            if getattr(m_ctx, "price_available", False):
                all_findings.append(
                    AgentFindingSchema(
                        agent_name="MarketIntelligence",
                        finding_type="cost_context_available",
                        severity="low",
                        target_drug_id=drug_id,
                        target_location_id=None,
                        description=f"NPPA Authoritative Reference Price: {m_ctx.reference_price} {m_ctx.currency} ({m_ctx.reference_price_unit or 'per unit'}). Source: {m_ctx.source}.",
                        metrics={
                            "reference_price": m_ctx.reference_price,
                            "price_type": m_ctx.price_type,
                            "currency": m_ctx.currency,
                            "source": m_ctx.source,
                            "data_status": m_ctx.data_status,
                            "regulatory_price_available": m_ctx.regulatory_price_available,
                        },
                    )
                )
            else:
                all_findings.append(
                    AgentFindingSchema(
                        agent_name="MarketIntelligence",
                        finding_type="cost_data_unavailable",
                        severity="low",
                        target_drug_id=drug_id,
                        target_location_id=None,
                        description=f"Authoritative market price context unavailable for drug {drug_id}.",
                        metrics={
                            "price_available": False,
                            "reason": getattr(m_ctx, "notes", "Authoritative market price unavailable"),
                        },
                    )
                )

        if not all_findings:
            return CoordinatorRecommendationResponse(
                recommendation_id=f"REC-{uuid.uuid4().hex[:8].upper()}",
                snapshot_id=snapshot_id,
                timestamp=datetime.utcnow(),
                overall_risk_level="low",
                agent_findings=[],
                recommended_actions=[
                    ActionRecommendationSchema(
                        action_type="no_action",
                        target_drug_id="NONE",
                        source_location_id=None,
                        destination_location_id="SYSTEM",
                        recommended_quantity=0,
                        priority="low",
                        reasoning="No specialized agent findings were reported.",
                        confidence=1.0
                    )
                ],
                requires_human_approval=False
            )

        # -------------------------------------------------------------
        # 1. DETERMINISTIC PYTHON DECISION PRIORITIZATION ENGINE
        # -------------------------------------------------------------
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        max_sev_val = max(severity_order.get(f.severity, 1) for f in all_findings)
        severity_map = {4: "critical", 3: "high", 2: "medium", 1: "low"}
        overall_risk = severity_map[max_sev_val]

        redistribution_opportunities = [f for f in all_findings if f.finding_type == "redistribution_opportunity"]
        procurement_requirements = [f for f in all_findings if f.finding_type == "procurement_required"]
        insufficient_data_findings = [f for f in all_findings if f.finding_type == "insufficient_data"]
        compliance_violations = [f for f in state.get("compliance_findings", []) if f.finding_type == "batch_compliance_failed"]
        vendor_recommendations = [f for f in state.get("vendor_findings", []) if f.finding_type == "vendor_recommended"]

        recommended_actions: List[ActionRecommendationSchema] = []
        requires_human_flag = False

        # Compliance safety constraint: compliance failures always require human approval
        if compliance_violations:
            logger.warning("Compliance violations detected in state. Enforcing human approval and safety constraints.")
            requires_human_flag = True

        # Detect conflicting findings across specialized agents
        if procurement_requirements and redistribution_opportunities:
            logger.info("Conflicting procurement & redistribution findings detected. Prioritizing network redistribution and requiring human review.")
            requires_human_flag = True

        # Decision Rule 1: Prioritize Redistribution Over Procurement
        if redistribution_opportunities:
            for redist_f in redistribution_opportunities:
                dest_loc = redist_f.target_location_id or "UNKNOWN"
                src_loc = redist_f.metrics.get("source_location_id")
                auth_transfer_qty = int(redist_f.metrics.get("potential_transfer_quantity", 0))

                action_priority = "high" if max_sev_val >= 3 else "medium"

                raw_reasoning = await self._generate_reasoning(
                    action_type="redistribute",
                    drug_id=redist_f.target_drug_id,
                    dest_loc=dest_loc,
                    src_loc=src_loc,
                    quantity=auth_transfer_qty,
                    supporting_findings=[redist_f] + [f for f in all_findings if f.target_drug_id == redist_f.target_drug_id and f != redist_f]
                )

                candidate_rec = ActionRecommendationSchema(
                    action_type="redistribute",
                    target_drug_id=redist_f.target_drug_id,
                    source_location_id=src_loc,
                    destination_location_id=dest_loc,
                    recommended_quantity=auth_transfer_qty,
                    priority=action_priority,
                    reasoning=raw_reasoning,
                    confidence=0.90
                )

                validated_rec, item_requires_human = self.validate_and_reconcile_action(candidate_rec, all_findings)
                if item_requires_human:
                    requires_human_flag = True

                recommended_actions.append(validated_rec)

        # Decision Rule 2: Recommend Procurement when Procurement Required AND no redistribution covers it
        elif procurement_requirements:
            for proc_f in procurement_requirements:
                loc = proc_f.target_location_id or "UNKNOWN"
                auth_shortage_qty = int(proc_f.metrics.get("shortage_quantity", 0))

                # Check if vendor recommendation exists for this drug
                matching_vendors = [v for v in vendor_recommendations if v.target_drug_id == proc_f.target_drug_id]
                vendor_info_str = None
                if matching_vendors:
                    best_v = matching_vendors[0]
                    v_name = best_v.metrics.get("recommended_vendor_name", best_v.target_location_id)
                    v_id = best_v.metrics.get("recommended_vendor_id", best_v.target_location_id)
                    v_rel = best_v.metrics.get("reliability_score", 0.0)
                    vendor_info_str = f"Recommended Supplier: {v_name} ({v_id}) with {v_rel*100:.0f}% reliability score."

                action_priority = "critical" if proc_f.severity == "critical" else ("high" if proc_f.severity == "high" else "medium")

                raw_reasoning = await self._generate_reasoning(
                    action_type="procure",
                    drug_id=proc_f.target_drug_id,
                    dest_loc=loc,
                    src_loc=None,
                    quantity=auth_shortage_qty,
                    supporting_findings=[proc_f] + [f for f in all_findings if f.target_drug_id == proc_f.target_drug_id and f != proc_f],
                    vendor_info=vendor_info_str
                )

                candidate_rec = ActionRecommendationSchema(
                    action_type="procure",
                    target_drug_id=proc_f.target_drug_id,
                    source_location_id=None,
                    destination_location_id=loc,
                    recommended_quantity=auth_shortage_qty,
                    priority=action_priority,
                    reasoning=raw_reasoning,
                    confidence=0.90
                )

                validated_rec, item_requires_human = self.validate_and_reconcile_action(candidate_rec, all_findings)
                if item_requires_human:
                    requires_human_flag = True

                recommended_actions.append(validated_rec)

        # Decision Rule 3: Default to no_action for healthy/stable supply or insufficient data
        else:
            first_f = all_findings[0]
            if insufficient_data_findings:
                reasoning = f"Insufficient operational data available for drug {first_f.target_drug_id}. Recommending no automated action until data is supplied."
                requires_human_flag = True
            else:
                reasoning = f"Operational metrics indicate balanced supply and stable demand across facilities for drug {first_f.target_drug_id}. No action required."

            rec = ActionRecommendationSchema(
                action_type="no_action",
                target_drug_id=first_f.target_drug_id,
                source_location_id=None,
                destination_location_id=first_f.target_location_id or "SYSTEM",
                recommended_quantity=0,
                priority="low",
                reasoning=reasoning,
                confidence=0.95
            )
            recommended_actions.append(rec)

        # High risk actions or detected inconsistencies always require human approval
        if overall_risk in ["high", "critical"]:
            requires_human_flag = True

        return CoordinatorRecommendationResponse(
            recommendation_id=f"REC-{uuid.uuid4().hex[:8].upper()}",
            snapshot_id=snapshot_id,
            timestamp=datetime.utcnow(),
            overall_risk_level=overall_risk,
            agent_findings=all_findings,
            recommended_actions=recommended_actions,
            requires_human_approval=requires_human_flag
        )

    def validate_and_reconcile_action(
        self, 
        action: ActionRecommendationSchema, 
        all_findings: List[AgentFindingSchema]
    ) -> Tuple[ActionRecommendationSchema, bool]:
        """
        Stage 10A Deterministic Decision Validator & Reconciler.
        Validates recommended quantities, location IDs, and drug IDs against authoritative findings.
        """
        requires_human = False

        if action.action_type == "redistribute":
            dist_findings = [
                f for f in all_findings 
                if f.finding_type == "redistribution_opportunity" 
                and f.target_drug_id == action.target_drug_id
            ]

            if dist_findings:
                finding = dist_findings[0]
                auth_qty = int(finding.metrics.get("potential_transfer_quantity", 0))
                auth_src = finding.metrics.get("source_location_id")
                auth_dest = finding.target_location_id

                # Location ID integrity checks
                if action.source_location_id != auth_src:
                    logger.warning(f"Source location mismatch: SLM proposed '{action.source_location_id}', authoritative is '{auth_src}'. Correcting.")
                    action.source_location_id = auth_src
                    requires_human = True

                if action.destination_location_id != auth_dest:
                    logger.warning(f"Destination location mismatch: SLM proposed '{action.destination_location_id}', authoritative is '{auth_dest}'. Correcting.")
                    action.destination_location_id = auth_dest
                    requires_human = True

                # Quantity integrity checks: must not exceed authoritative potential_transfer_quantity
                if action.recommended_quantity > auth_qty or action.recommended_quantity <= 0:
                    logger.warning(f"Redistribution quantity mismatch: Proposed {action.recommended_quantity}, Authoritative limit {auth_qty}. Correcting to {auth_qty}.")
                    action.recommended_quantity = auth_qty
                    requires_human = True
            else:
                logger.warning(f"No matching redistribution finding found for drug {action.target_drug_id}. Marking for human approval.")
                requires_human = True

        elif action.action_type == "procure":
            proc_findings = [
                f for f in all_findings
                if f.finding_type == "procurement_required"
                and f.target_drug_id == action.target_drug_id
            ]

            if proc_findings:
                finding = proc_findings[0]
                auth_qty = int(finding.metrics.get("shortage_quantity", 0))
                auth_dest = finding.target_location_id

                if action.destination_location_id != auth_dest:
                    action.destination_location_id = auth_dest
                    requires_human = True

                if action.recommended_quantity > auth_qty or action.recommended_quantity <= 0:
                    logger.warning(f"Procurement quantity mismatch: Proposed {action.recommended_quantity}, Authoritative shortage {auth_qty}. Correcting to {auth_qty}.")
                    action.recommended_quantity = auth_qty
                    requires_human = True
            else:
                requires_human = True

        # Reconcile SLM reasoning text to ensure numerical consistency with action.recommended_quantity
        action.reasoning = self._reconcile_reasoning_text(action.reasoning, action.recommended_quantity, action.action_type)

        return action, requires_human

    def _reconcile_reasoning_text(self, reasoning: str, quantity: int, action_type: str) -> str:
        """
        Validates and repairs natural language reasoning text so numbers mentioned in text
        match the exact validated action.recommended_quantity. Handles ordinal suffixes (e.g. 48th -> 480).
        """
        # Clean up any SLM safety refusal strings if triggered by prompt constraints
        if any(phrase in reasoning.lower() for phrase in ["i cannot", "i am unable", "as an ai", "is there anything else"]):
            reasoning = f"Recommended {action_type} of {quantity} units to satisfy supply chain requirements."

        # Check if text contains contradicting numbers
        found_numbers = [int(n) for n in re.findall(r'\b\d+\b', reasoning)]
        
        # If numbers are present in reasoning but the exact validated quantity is missing, reconcile text
        if found_numbers and quantity not in found_numbers:
            logger.warning(f"SLM reasoning text numerical inconsistency detected (Found numbers {found_numbers}, Expected {quantity}). Reconciling text.")
            for num in found_numbers:
                if num != quantity and num < 10000:
                    # Replace num and any optional ordinal suffix (e.g. 48th -> 480)
                    reasoning = re.sub(rf'\b{num}(st|nd|rd|th)?\b', f"{quantity}", reasoning, flags=re.IGNORECASE)
            
            if str(quantity) not in reasoning:
                reasoning = f"Recommended {action_type} of {quantity} units. {reasoning}"

        return reasoning

    async def _generate_reasoning(
        self,
        action_type: str,
        drug_id: str,
        dest_loc: str,
        src_loc: Optional[str],
        quantity: int,
        supporting_findings: List[AgentFindingSchema],
        vendor_info: Optional[str] = None
    ) -> str:
        """
        Calls SLM to generate a concise operational reasoning text explaining why the action was selected.
        """
        findings_summary = "\n".join([f"- [{f.agent_name}] {f.finding_type} ({f.severity}): {f.description}" for f in supporting_findings])
        
        vendor_clause = f"Vendor Recommendation: {vendor_info}\n" if vendor_info else ""

        prompt = (
            f"Action Recommended: {action_type.upper()}\n"
            f"Target Drug: {drug_id}\n"
            f"Destination Location: {dest_loc}\n"
            f"Source Location: {src_loc if src_loc else 'N/A'}\n"
            f"Exact Authoritative Quantity: {quantity} units\n"
            f"{vendor_clause}\n"
            f"Supporting Agent Findings:\n{findings_summary}\n\n"
            f"Synthesize these findings into ONE concise natural language reasoning statement (1-2 sentences) explaining why this action is recommended. You MUST mention the exact quantity of {quantity} units."
        )

        system_prompt = (
            "You are the Lead Supply Chain Coordinator Agent.\n"
            "Synthesize specialized findings into clear operational reasoning.\n"
            "Do NOT calculate quantities or alter numbers. Refer strictly to the provided exact quantity."
        )

        try:
            reasoning_text = await self.slm_provider.generate(prompt=prompt, system_prompt=system_prompt)
            return reasoning_text.strip() if reasoning_text else f"Recommended {action_type} of {quantity} units for {drug_id} at {dest_loc}."
        except Exception as exc:
            logger.warning(f"CoordinatorAgent SLM reasoning generation failed: {exc}. Using fallback reasoning.")
            return f"Recommended {action_type} of {quantity} units for {drug_id} at {dest_loc} based on aggregated findings."
