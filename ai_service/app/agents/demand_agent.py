from datetime import date
import logging
from typing import List, Optional, Dict, Any
from app.agents.base_agent import BaseAgent
from app.schemas import (
    SupplyChainSnapshotPayload,
    AgentFindingSchema,
    ConsumptionRecordSchema,
    DrugSchema,
)

logger = logging.getLogger(__name__)

class DemandAgent(BaseAgent):
    """
    Specialized Demand Agent.
    
    Responsibilities:
    - Sorts consumption records chronologically and computes deterministic statistics in Python
      (observation count, baseline average, recent consumption, trend percentage change).
    - Identifies consumption anomalies using a configurable threshold multiplier.
    - Uses local SLM for trend interpretation, severity grading, and rationale synthesis.
    - Strictly enforces anti-hallucination rules and domain boundaries (cannot output stockout risk).
    """

    def __init__(self, slm_provider, anomaly_spike_threshold: float = 2.0):
        super().__init__(slm_provider)
        self.anomaly_spike_threshold = anomaly_spike_threshold

    async def analyze(self, snapshot: SupplyChainSnapshotPayload) -> List[AgentFindingSchema]:
        findings: List[AgentFindingSchema] = []

        # Index catalog drugs by drug_id for quick name lookup
        drugs_map: Dict[str, DrugSchema] = {d.drug_id: d for d in snapshot.drugs}

        # Group consumption records by (hospital_id, drug_id)
        grouped_records: Dict[tuple, List[ConsumptionRecordSchema]] = {}
        for record in snapshot.consumption_records:
            key = (record.hospital_id, record.drug_id)
            grouped_records.setdefault(key, []).append(record)

        # If no consumption records exist in the snapshot payload
        if not snapshot.consumption_records:
            return findings

        # Analyze each (hospital_id, drug_id) consumption group
        for (hospital_id, drug_id), records in grouped_records.items():
            drug = drugs_map.get(drug_id)
            drug_name = drug.name if drug else drug_id

            # -------------------------------------------------------------
            # CHRONOLOGICAL SORTING & PYTHON CALCULATIONS
            # -------------------------------------------------------------
            # Sort records chronologically by period_start
            records_sorted = sorted(records, key=lambda r: r.period_start)
            observation_count = len(records_sorted)

            # Rule: If observation count <= 1, data is insufficient to compute trend
            if observation_count <= 1:
                recent_val = records_sorted[0].quantity_consumed if observation_count == 1 else None
                finding = AgentFindingSchema(
                    agent_name="DemandAgent",
                    finding_type="insufficient_data",
                    severity="low",
                    target_drug_id=drug_id,
                    target_location_id=hospital_id,
                    description=f"Insufficient historical consumption records ({observation_count} observation). Cannot compute demand trend.",
                    metrics={
                        "observation_count": observation_count,
                        "recent_quantity": recent_val,
                        "baseline_average": None,
                        "trend_percentage": None
                    }
                )
                findings.append(finding)
                continue

            # Multi-period deterministic calculations
            recent_record = records_sorted[-1]
            recent_quantity = recent_record.quantity_consumed
            
            baseline_records = records_sorted[:-1]
            baseline_average = round(sum(r.quantity_consumed for r in baseline_records) / len(baseline_records), 2)
            
            if baseline_average > 0:
                trend_percentage = round(((recent_quantity - baseline_average) / baseline_average) * 100.0, 2)
            else:
                trend_percentage = 0.0

            # Detect spike or anomaly
            is_anomaly_flagged = any(r.is_anomaly for r in records_sorted)
            is_threshold_spike = recent_quantity >= (self.anomaly_spike_threshold * baseline_average) and baseline_average > 0
            is_spike = is_anomaly_flagged or is_threshold_spike

            # -------------------------------------------------------------
            # PREPARE CONCISE PROMPT & DOMAIN INSTANCE TEMPLATE
            # -------------------------------------------------------------
            historical_series_str = ", ".join([str(r.quantity_consumed) for r in records_sorted])

            facts_text = (
                f"Drug: {drug_name} ({drug_id})\n"
                f"Location: {hospital_id}\n"
                f"Historical Periods Analyzed: {observation_count}\n"
                f"Historical Consumption Series: [{historical_series_str}]\n"
                f"Pre-Calculated Baseline Average: {baseline_average} units\n"
                f"Pre-Calculated Recent Period Consumption: {recent_quantity} units\n"
                f"Pre-Calculated Trend Percentage Change: {trend_percentage}%\n"
                f"Abnormal Spike Detected: {'YES' if is_spike else 'NO'}\n"
            )

            system_prompt = (
                "You are a specialized Demand Analysis Agent.\n"
                "STRICT DOMAIN BOUNDARY RULES:\n"
                "1. Analyze DEMAND AND CONSUMPTION BEHAVIOR ONLY.\n"
                "2. Permitted finding_type values MUST be one of: 'abnormal_consumption', 'demand_increase', 'demand_decrease', 'stable_demand', 'insufficient_data'.\n"
                "3. NEVER output 'stockout_risk' or discuss inventory/stock levels.\n"
                "4. If Abnormal Spike is YES, finding_type MUST be 'abnormal_consumption' and severity MUST be 'high' or 'critical'.\n"
                "5. Description MUST discuss consumption rate, spikes, or demand trend ONLY (1 concise sentence)."
            )

            user_prompt = f"Analyze consumption facts:\n{facts_text}\nOutput AgentFindingSchema JSON."

            # Agent-specific instance template guiding the SLM to output domain-specific findings
            expected_finding_type = "abnormal_consumption" if is_spike else ("demand_increase" if trend_percentage >= 15 else ("demand_decrease" if trend_percentage <= -15 else "stable_demand"))
            expected_severity = "high" if is_spike else ("medium" if trend_percentage >= 15 else "low")
            
            example_instance = {
                "agent_name": "DemandAgent",
                "finding_type": expected_finding_type,
                "severity": expected_severity,
                "target_drug_id": drug_id,
                "target_location_id": hospital_id,
                "description": f"Consumption of {drug_name} increased by {trend_percentage}% compared to historical baseline.",
                "metrics": {}
            }

            try:
                finding: AgentFindingSchema = await self.slm_provider.generate_structured(
                    prompt=user_prompt,
                    response_schema=AgentFindingSchema,
                    system_prompt=system_prompt,
                    example_instance=example_instance
                )
                
                # Enforce domain boundary check: fallback if SLM violates finding_type boundary
                if finding.finding_type not in ["abnormal_consumption", "demand_increase", "demand_decrease", "stable_demand", "insufficient_data"]:
                    logger.warning(f"DemandAgent SLM returned invalid domain finding_type '{finding.finding_type}'. Enforcing '{expected_finding_type}'.")
                    finding.finding_type = expected_finding_type

                # Ensure deterministic metrics calculated in Python are attached
                finding.agent_name = "DemandAgent"
                finding.target_drug_id = drug_id
                finding.target_location_id = hospital_id
                finding.metrics = {
                    "observation_count": observation_count,
                    "baseline_average": baseline_average,
                    "recent_quantity": recent_quantity,
                    "trend_percentage": trend_percentage,
                    "is_spike": is_spike
                }
                
                findings.append(finding)

            except Exception as exc:
                logger.error(f"DemandAgent analysis error for drug {drug_id} at {hospital_id}: {exc}", exc_info=True)
                fallback_finding = AgentFindingSchema(
                    agent_name="DemandAgent",
                    finding_type="analysis_error",
                    severity="medium",
                    target_drug_id=drug_id,
                    target_location_id=hospital_id,
                    description=f"Demand analysis failed: {str(exc)}",
                    metrics={
                        "observation_count": observation_count,
                        "baseline_average": baseline_average,
                        "recent_quantity": recent_quantity,
                        "trend_percentage": trend_percentage
                    }
                )
                findings.append(fallback_finding)

        return findings
