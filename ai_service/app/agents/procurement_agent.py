from datetime import date
import logging
from typing import List, Optional, Dict, Any
from app.agents.base_agent import BaseAgent
from app.schemas import (
    SupplyChainSnapshotPayload,
    AgentFindingSchema,
    InventoryItemSchema,
    DrugSchema,
    ConsumptionRecordSchema,
    ShipmentSchema,
)

logger = logging.getLogger(__name__)

class ProcurementAgent(BaseAgent):
    """
    Specialized Procurement Agent.
    
    Responsibilities:
    - Calculates net effective stock, target safety thresholds, and shortage gaps deterministically in Python.
    - Prefers explicit min_safety_stock from catalog input over arbitrary target coverage assumptions.
    - Uses local SLM to reason over pre-calculated facts and generate structured procurement findings.
    - Enforces strict anti-hallucination rules (refuses to invent vendors, lead times, purchase prices, or policy thresholds).
    """

    def __init__(self, slm_provider, target_coverage_days: int = 14):
        super().__init__(slm_provider)
        # Configurable demo/development default coverage buffer
        self.target_coverage_days = target_coverage_days

    async def analyze(self, snapshot: SupplyChainSnapshotPayload) -> List[AgentFindingSchema]:
        findings: List[AgentFindingSchema] = []

        # Index catalog drugs by drug_id for quick lookup
        drugs_map: Dict[str, DrugSchema] = {d.drug_id: d for d in snapshot.drugs}
        
        # Index consumption records by (hospital_id, drug_id)
        consumption_map: Dict[tuple, ConsumptionRecordSchema] = {
            (c.hospital_id, c.drug_id): c for c in snapshot.consumption_records
        }

        # Index active incoming shipments by (destination_id, drug_id)
        shipments_map: Dict[tuple, List[ShipmentSchema]] = {}
        for s in snapshot.shipments:
            key = (s.destination_id, s.drug_id)
            shipments_map.setdefault(key, []).append(s)

        # Analyze each inventory item
        for item in snapshot.inventories:
            drug = drugs_map.get(item.drug_id)
            consumption = consumption_map.get((item.location_id, item.drug_id))
            incoming_shipments = shipments_map.get((item.location_id, item.drug_id), [])

            # -------------------------------------------------------------
            # DETERMINISTIC PYTHON CALCULATIONS (Zero SLM Arithmetic Risk)
            # -------------------------------------------------------------
            available_stock = item.available_stock
            reserved_stock = item.reserved_stock
            
            # Calculate total incoming stock from shipments or item attribute
            payload_incoming = sum(s.quantity for s in incoming_shipments if s.status in ["preparing", "in_transit"])
            incoming_stock = max(item.incoming_stock, payload_incoming)
            
            net_effective_stock = available_stock + incoming_stock - reserved_stock
            daily_usage: Optional[float] = consumption.daily_avg_consumption if consumption else None
            min_safety_stock: Optional[int] = drug.min_safety_stock if (drug and drug.min_safety_stock is not None) else None

            # Insufficient Data Check: Cannot evaluate procurement if neither consumption nor positive safety stock is available
            if daily_usage is None and (min_safety_stock is None or min_safety_stock <= 0):
                finding = AgentFindingSchema(
                    agent_name="ProcurementAgent",
                    finding_type="insufficient_data",
                    severity="low",
                    target_drug_id=item.drug_id,
                    target_location_id=item.location_id,
                    description=f"Missing consumption rate and safety stock threshold. Cannot compute procurement requirement.",
                    metrics={
                        "available_stock": available_stock,
                        "net_effective_stock": net_effective_stock,
                        "daily_avg_consumption": None,
                        "shortage_quantity": None
                    }
                )
                findings.append(finding)
                continue

            # Determine required safety stock threshold:
            # Rule: Prefer explicit min_safety_stock from drug input payload if available
            if min_safety_stock is not None and min_safety_stock > 0:
                required_threshold = min_safety_stock
                threshold_source = "explicit_min_safety_stock"
            elif daily_usage is not None and daily_usage > 0:
                required_threshold = int(self.target_coverage_days * daily_usage)
                threshold_source = f"configurable_{self.target_coverage_days}d_coverage"
            else:
                required_threshold = 0
                threshold_source = "none"

            # Calculate deterministic shortage gap
            is_procurement_needed = net_effective_stock < required_threshold
            shortage_quantity = max(0, required_threshold - net_effective_stock) if is_procurement_needed else 0

            days_of_effective_supply: Optional[float] = (
                round(net_effective_stock / daily_usage, 2) if (daily_usage and daily_usage > 0) else None
            )

            # -------------------------------------------------------------
            # PREPARE CONCISE PROMPT WITH PRE-CALCULATED FACTS
            # -------------------------------------------------------------
            drug_name = drug.name if drug else item.drug_id
            
            facts_text = (
                f"Drug: {drug_name} ({item.drug_id})\n"
                f"Location: {item.location_id}\n"
                f"Available Stock: {available_stock} units\n"
                f"Reserved Stock: {reserved_stock} units\n"
                f"Incoming Stock (in transit): {incoming_stock} units\n"
                f"Net Effective Stock: {net_effective_stock} units\n"
                f"Required Threshold ({threshold_source}): {required_threshold} units\n"
                f"Daily Usage Rate: {f'{daily_usage} units/day' if daily_usage is not None else 'UNAVAILABLE'}\n"
                f"Days of Effective Supply: {days_of_effective_supply if days_of_effective_supply is not None else 'UNAVAILABLE'}\n"
                f"Pre-Calculated Shortage Gap: {shortage_quantity} units\n"
                f"Procurement Needed: {'YES' if is_procurement_needed else 'NO'}\n"
            )

            system_prompt = (
                "You are a specialized Procurement Agent for a medical supply chain system.\n"
                "STRICT DOMAIN BOUNDARY RULES:\n"
                "1. Analyze PROCUREMENT REQUIREMENTS AND SHORTAGE GAPS ONLY.\n"
                "2. Permitted finding_type values MUST be one of: 'procurement_required', 'procurement_not_required', 'insufficient_data'.\n"
                "3. NEVER output 'stockout_risk', 'abnormal_consumption', or 'vendor_delay'.\n"
                "4. DO NOT invent vendor names, lead times, purchase prices, or execution dates.\n"
                "5. Description MUST discuss procurement requirements and shortage quantity ONLY (1 concise sentence)."
            )

            user_prompt = f"Analyze procurement facts:\n{facts_text}\nOutput AgentFindingSchema JSON."

            expected_finding_type = "procurement_required" if is_procurement_needed else "procurement_not_required"
            expected_severity = "high" if (is_procurement_needed and net_effective_stock < (required_threshold * 0.5)) else ("medium" if is_procurement_needed else "low")
            
            example_instance = {
                "agent_name": "ProcurementAgent",
                "finding_type": expected_finding_type,
                "severity": expected_severity,
                "target_drug_id": item.drug_id,
                "target_location_id": item.location_id,
                "description": f"Procurement requirement of {shortage_quantity} units identified for {drug_name} at {item.location_id}.",
                "metrics": {}
            }

            try:
                finding: AgentFindingSchema = await self.slm_provider.generate_structured(
                    prompt=user_prompt,
                    response_schema=AgentFindingSchema,
                    system_prompt=system_prompt,
                    example_instance=example_instance
                )
                
                # Domain boundary guard check: fallback if SLM returns invalid domain finding_type
                if finding.finding_type not in ["procurement_required", "procurement_not_required", "insufficient_data"]:
                    logger.warning(f"ProcurementAgent SLM returned invalid domain finding_type '{finding.finding_type}'. Enforcing '{expected_finding_type}'.")
                    finding.finding_type = expected_finding_type

                # Ensure deterministic metrics calculated in Python are attached
                finding.agent_name = "ProcurementAgent"
                finding.target_drug_id = item.drug_id
                finding.target_location_id = item.location_id
                finding.metrics = {
                    "available_stock": available_stock,
                    "reserved_stock": reserved_stock,
                    "incoming_stock": incoming_stock,
                    "net_effective_stock": net_effective_stock,
                    "daily_avg_consumption": daily_usage,
                    "required_threshold": required_threshold,
                    "shortage_quantity": shortage_quantity,
                    "days_of_effective_supply": days_of_effective_supply,
                    "is_procurement_needed": is_procurement_needed
                }
                
                findings.append(finding)

            except Exception as exc:
                logger.error(f"ProcurementAgent analysis error for drug {item.drug_id} at {item.location_id}: {exc}", exc_info=True)
                fallback_finding = AgentFindingSchema(
                    agent_name="ProcurementAgent",
                    finding_type="analysis_error",
                    severity="medium",
                    target_drug_id=item.drug_id,
                    target_location_id=item.location_id,
                    description=f"Procurement analysis failed: {str(exc)}",
                    metrics={
                        "net_effective_stock": net_effective_stock,
                        "shortage_quantity": shortage_quantity
                    }
                )
                findings.append(fallback_finding)

        return findings
