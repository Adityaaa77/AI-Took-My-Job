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

class DistributionAgent(BaseAgent):
    """
    Specialized Distribution Agent.
    
    Responsibilities:
    - Compares stock availability across multiple institutions for the same drug in Python.
    - Applies safety filters in Python: excludes expired/failed batches, reserved stock, and in-transit shipments.
    - Calculates surplus stock, deficit stock, and potential_transfer_quantity deterministically in Python.
    - Ensures source facilities retain their required safety threshold after transfer.
    - Uses local SLM for rationale synthesis and structured finding classification.
    - Strictly enforces domain boundaries (never outputs procurement_required or stockout_risk).
    """

    def __init__(
        self, 
        slm_provider, 
        surplus_threshold_days: float = 30.0,
        deficit_threshold_days: float = 7.0,
        target_coverage_days: float = 14.0
    ):
        super().__init__(slm_provider)
        self.surplus_threshold_days = surplus_threshold_days
        self.deficit_threshold_days = deficit_threshold_days
        self.target_coverage_days = target_coverage_days

    async def analyze(self, snapshot: SupplyChainSnapshotPayload) -> List[AgentFindingSchema]:
        findings: List[AgentFindingSchema] = []
        today = date.today()

        # Group inventories by drug_id (keeps different drugs strictly isolated)
        inventories_by_drug: Dict[str, List[InventoryItemSchema]] = {}
        for inv in snapshot.inventories:
            inventories_by_drug.setdefault(inv.drug_id, []).append(inv)

        # Index catalog drugs by drug_id
        drugs_map: Dict[str, DrugSchema] = {d.drug_id: d for d in snapshot.drugs}

        # Index consumption records by (hospital_id, drug_id)
        consumption_map: Dict[tuple, ConsumptionRecordSchema] = {
            (c.hospital_id, c.drug_id): c for c in snapshot.consumption_records
        }

        # Process each drug group independently
        for drug_id, items in inventories_by_drug.items():
            drug = drugs_map.get(drug_id)
            drug_name = drug.name if drug else drug_id

            surplus_facilities: List[Dict[str, Any]] = []
            deficit_facilities: List[Dict[str, Any]] = []
            insufficient_data_facilities: List[Dict[str, Any]] = []

            for item in items:
                consumption = consumption_map.get((item.location_id, drug_id))
                daily_usage = consumption.daily_avg_consumption if consumption else None

                # 1. Quality & Expiry Filter in Python (Exclude expired or quarantined batches)
                if item.batches:
                    safe_batches = [
                        b for b in item.batches
                        if b.quality_status == "passed" and (b.expiry_date - today).days > 30
                    ]
                    safe_available_stock = sum(b.quantity for b in safe_batches)
                else:
                    safe_available_stock = item.available_stock

                # 2. Exclude Reserved Stock from Transferable Stock (In-transit shipments are also not transferable)
                unreserved_stock = max(0, safe_available_stock - item.reserved_stock)

                # 3. Check Insufficient Data (Missing consumption rate)
                if daily_usage is None or daily_usage <= 0:
                    insufficient_data_facilities.append({
                        "location_id": item.location_id,
                        "unreserved_stock": unreserved_stock,
                        "reason": "Missing daily consumption rate"
                    })
                    continue

                # 4. Calculate Days of Supply
                days_of_supply = round(unreserved_stock / daily_usage, 2)
                min_safety = drug.min_safety_stock if (drug and drug.min_safety_stock is not None and drug.min_safety_stock > 0) else int(self.target_coverage_days * daily_usage)
                source_retained_requirement = max(min_safety, int(self.target_coverage_days * daily_usage))

                # 5. Classify Surplus vs Deficit
                if days_of_supply >= self.surplus_threshold_days and unreserved_stock > source_retained_requirement:
                    surplus_qty = max(0, unreserved_stock - source_retained_requirement)
                    if surplus_qty > 0:
                        surplus_facilities.append({
                            "location_id": item.location_id,
                            "unreserved_stock": unreserved_stock,
                            "days_of_supply": days_of_supply,
                            "surplus_qty": surplus_qty,
                            "daily_usage": daily_usage,
                            "retained_requirement": source_retained_requirement
                        })
                elif days_of_supply < self.deficit_threshold_days:
                    target_needed = max(min_safety, int(self.target_coverage_days * daily_usage))
                    deficit_qty = max(0, target_needed - unreserved_stock)
                    if deficit_qty > 0:
                        deficit_facilities.append({
                            "location_id": item.location_id,
                            "unreserved_stock": unreserved_stock,
                            "days_of_supply": days_of_supply,
                            "deficit_qty": deficit_qty,
                            "daily_usage": daily_usage,
                            "target_needed": target_needed
                        })

            # Handle Insufficient Data Findings
            for fac in insufficient_data_facilities:
                finding = AgentFindingSchema(
                    agent_name="DistributionAgent",
                    finding_type="insufficient_data",
                    severity="low",
                    target_drug_id=drug_id,
                    target_location_id=fac["location_id"],
                    description=f"Missing consumption rate for drug {drug_name} at {fac['location_id']}. Cannot evaluate distribution.",
                    metrics={
                        "unreserved_stock": fac["unreserved_stock"],
                        "daily_avg_consumption": None,
                        "potential_transfer_quantity": 0
                    }
                )
                findings.append(finding)

            # Match Surplus & Deficit Facilities for Redistribution Opportunities
            if deficit_facilities and surplus_facilities:
                for dest in deficit_facilities:
                    for src in surplus_facilities:
                        if src["surplus_qty"] <= 0:
                            continue
                        
                        potential_transfer = min(src["surplus_qty"], dest["deficit_qty"])
                        if potential_transfer > 0:
                            # Update remaining surplus in Python
                            src["surplus_qty"] -= potential_transfer

                            facts_text = (
                                f"Drug: {drug_name} ({drug_id})\n"
                                f"Source Facility: {src['location_id']} (Days of supply: {src['days_of_supply']}d, Unreserved: {src['unreserved_stock']} units)\n"
                                f"Destination Facility: {dest['location_id']} (Days of supply: {dest['days_of_supply']}d, Deficit: {dest['deficit_qty']} units)\n"
                                f"Pre-Calculated Transferable Quantity: {potential_transfer} units\n"
                                f"Source Retained Stock After Transfer: {src['unreserved_stock'] - potential_transfer} units (Meets safety requirement of {src['retained_requirement']} units)\n"
                            )

                            system_prompt = (
                                "You are a specialized Distribution Agent.\n"
                                "STRICT DOMAIN BOUNDARY RULES:\n"
                                "1. Analyze INTER-HOSPITAL REDISTRIBUTION OPPORTUNITIES ONLY.\n"
                                "2. Permitted finding_type values MUST be one of: 'redistribution_opportunity', 'distribution_not_required', 'insufficient_data'.\n"
                                "3. NEVER output 'procurement_required', 'stockout_risk', or 'abnormal_consumption'.\n"
                                "4. DO NOT claim that a transfer has been executed.\n"
                                "5. Description MUST discuss the redistribution opportunity from source to destination (1 concise sentence)."
                            )

                            user_prompt = f"Analyze distribution facts:\n{facts_text}\nOutput AgentFindingSchema JSON."

                            example_instance = {
                                "agent_name": "DistributionAgent",
                                "finding_type": "redistribution_opportunity",
                                "severity": "medium",
                                "target_drug_id": drug_id,
                                "target_location_id": dest["location_id"],
                                "description": f"Potential redistribution opportunity: transfer {potential_transfer} units of {drug_name} from {src['location_id']} to {dest['location_id']}.",
                                "metrics": {}
                            }

                            try:
                                finding: AgentFindingSchema = await self.slm_provider.generate_structured(
                                    prompt=user_prompt,
                                    response_schema=AgentFindingSchema,
                                    system_prompt=system_prompt,
                                    example_instance=example_instance
                                )

                                # Domain guard check
                                if finding.finding_type not in ["redistribution_opportunity", "distribution_not_required", "insufficient_data"]:
                                    finding.finding_type = "redistribution_opportunity"

                                finding.agent_name = "DistributionAgent"
                                finding.target_drug_id = drug_id
                                finding.target_location_id = dest["location_id"]
                                finding.metrics = {
                                    "source_location_id": src["location_id"],
                                    "destination_location_id": dest["location_id"],
                                    "source_unreserved_stock": src["unreserved_stock"],
                                    "destination_unreserved_stock": dest["unreserved_stock"],
                                    "source_days_of_supply": src["days_of_supply"],
                                    "destination_days_of_supply": dest["days_of_supply"],
                                    "potential_transfer_quantity": potential_transfer,
                                    "source_retained_stock": src["unreserved_stock"] - potential_transfer
                                }
                                findings.append(finding)
                            except Exception as exc:
                                logger.error(f"DistributionAgent error for drug {drug_id}: {exc}", exc_info=True)

            elif deficit_facilities and not surplus_facilities:
                # Deficit exists but no surplus source available -> distribution_not_required for transfer
                for dest in deficit_facilities:
                    finding = AgentFindingSchema(
                        agent_name="DistributionAgent",
                        finding_type="distribution_not_required",
                        severity="low",
                        target_drug_id=drug_id,
                        target_location_id=dest["location_id"],
                        description=f"Destination {dest['location_id']} has stock deficit ({dest['days_of_supply']}d supply), but no facility holds a transferable surplus.",
                        metrics={
                            "destination_unreserved_stock": dest["unreserved_stock"],
                            "destination_days_of_supply": dest["days_of_supply"],
                            "potential_transfer_quantity": 0
                        }
                    )
                    findings.append(finding)

            elif not deficit_facilities and len(items) > 0 and not insufficient_data_facilities:
                # All institutions have adequate supply -> distribution_not_required
                for item in items:
                    finding = AgentFindingSchema(
                        agent_name="DistributionAgent",
                        finding_type="distribution_not_required",
                        severity="low",
                        target_drug_id=drug_id,
                        target_location_id=item.location_id,
                        description=f"Stock coverage is balanced at {item.location_id}. Redistribution is not required.",
                        metrics={
                            "available_stock": item.available_stock,
                            "potential_transfer_quantity": 0
                        }
                    )
                    findings.append(finding)

        return findings
