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

class InventoryAgent(BaseAgent):
    """
    Specialized Inventory Agent.
    
    Responsibilities:
    - Calculates exact stock metrics deterministically in Python (days of supply, net effective stock, expiry risks).
    - Uses local SLM to reason over pre-calculated facts, determine risk severity, and synthesize structured findings.
    - Strictly enforces anti-hallucination rules (refuses to invent missing consumption rates or stock figures).
    """

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
            
            # Calculate total incoming from shipments payload or item attribute
            payload_incoming = sum(s.quantity for s in incoming_shipments if s.status in ["preparing", "in_transit"])
            incoming_stock = max(item.incoming_stock, payload_incoming)
            
            net_effective_stock = available_stock + incoming_stock - reserved_stock
            min_safety_stock = drug.min_safety_stock if drug else 100

            daily_usage: Optional[float] = consumption.daily_avg_consumption if consumption else None
            
            if daily_usage and daily_usage > 0:
                days_of_available_supply: Optional[float] = round(available_stock / daily_usage, 2)
                days_of_effective_supply: Optional[float] = round(net_effective_stock / daily_usage, 2)
            else:
                days_of_available_supply = None
                days_of_effective_supply = None

            # Calculate batch expiry risks (batches expiring within 30 days)
            today = date.today()
            expiring_batches = [
                b for b in item.batches 
                if (b.expiry_date - today).days <= 30
            ]
            expiring_units = sum(b.quantity for b in expiring_batches)

            # -------------------------------------------------------------
            # PREPARE CONCISE PROMPT WITH PRE-CALCULATED FACTS
            # -------------------------------------------------------------
            drug_name = drug.name if drug else item.drug_id
            
            facts_text = (
                f"Drug: {drug_name} ({item.drug_id})\n"
                f"Location: {item.location_id}\n"
                f"Available Stock: {available_stock} units\n"
                f"Net Effective Stock: {net_effective_stock} units\n"
                f"Daily Usage: {f'{daily_usage} units/day' if daily_usage is not None else 'UNAVAILABLE'}\n"
                f"Days of Available Supply: {days_of_available_supply if days_of_available_supply is not None else 'UNAVAILABLE'}\n"
                f"Days of Effective Supply: {days_of_effective_supply if days_of_effective_supply is not None else 'UNAVAILABLE'}\n"
                f"Expiring Batches (30d): {len(expiring_batches)} ({expiring_units} units)\n"
            )

            system_prompt = (
                "You are an Inventory Risk Analyst.\n"
                "Rules:\n"
                "1. Rely ONLY on provided pre-calculated facts.\n"
                "2. If Daily Usage is UNAVAILABLE, set finding_type='insufficient_data', severity='low'.\n"
                "3. If Days of Available Supply < 7, set severity='high' or 'critical' and finding_type='stockout_risk'.\n"
                "4. If Days of Available Supply >= 14, set severity='low' and finding_type='healthy_stock'.\n"
                "5. Keep description to 1 concise sentence."
            )

            user_prompt = f"Analyze facts:\n{facts_text}\nOutput AgentFindingSchema JSON."

            try:
                finding: AgentFindingSchema = await self.slm_provider.generate_structured(
                    prompt=user_prompt,
                    response_schema=AgentFindingSchema,
                    system_prompt=system_prompt
                )
                
                # Ensure deterministic metrics calculated in Python are attached
                finding.agent_name = "InventoryAgent"
                finding.target_drug_id = item.drug_id
                finding.target_location_id = item.location_id
                finding.metrics = {
                    "available_stock": available_stock,
                    "reserved_stock": reserved_stock,
                    "incoming_stock": incoming_stock,
                    "net_effective_stock": net_effective_stock,
                    "daily_avg_consumption": daily_usage,
                    "days_of_available_supply": days_of_available_supply,
                    "days_of_effective_supply": days_of_effective_supply,
                    "expiring_units_30d": expiring_units
                }
                
                findings.append(finding)

            except Exception as exc:
                logger.error(f"InventoryAgent analysis error for drug {item.drug_id} at {item.location_id}: {exc}", exc_info=True)
                fallback_finding = AgentFindingSchema(
                    agent_name="InventoryAgent",
                    finding_type="analysis_error",
                    severity="medium",
                    target_drug_id=item.drug_id,
                    target_location_id=item.location_id,
                    description=f"Inventory analysis failed: {str(exc)}",
                    metrics={"available_stock": available_stock}
                )
                findings.append(fallback_finding)

        return findings
