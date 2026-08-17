import asyncio
import logging
from typing import Dict, Any, Optional, List
from app.schemas import SupplyChainSnapshotPayload
from app.core import BaseSLMProvider
from app.pipeline.state import SupplyChainState
from app.pipeline.nodes import (
    run_inventory_node,
    run_demand_node,
    run_procurement_node,
    run_distribution_node,
    run_vendor_node,
    run_compliance_node,
    run_coordinator_node,
)

from app.market_intelligence import MarketIntelligenceService

logger = logging.getLogger(__name__)

class MultiAgentOrchestrator:
    """
    LangGraph-compatible Orchestrator managing execution, state aggregation,
    and decision synthesis across all six specialized agents and CoordinatorAgent:
    - InventoryAgent
    - DemandAgent
    - ProcurementAgent
    - DistributionAgent
    - VendorAgent
    - ComplianceAgent
        ↓
    - CoordinatorAgent (Final Synthesis)
    """

    def __init__(
        self,
        slm_provider: BaseSLMProvider,
        max_concurrency: int = 2,
        market_service: Optional[MarketIntelligenceService] = None,
    ):
        self.slm_provider = slm_provider
        self.max_concurrency = max_concurrency
        self.market_service = market_service or MarketIntelligenceService()

    async def run(self, snapshot: SupplyChainSnapshotPayload) -> SupplyChainState:
        """
        Execute all independent specialized agents in the pipeline, aggregate their findings,
        and run CoordinatorAgent to synthesize a unified decision recommendation response.
        
        :param snapshot: Master operational supply chain snapshot payload.
        :return: SupplyChainState containing findings, statuses, errors, and coordinator_recommendation.
        """
        # Fetch real-world market intelligence context for snapshot drugs
        market_contexts: Dict[str, Any] = {}
        for drug in snapshot.drugs:
            try:
                m_ctx = await self.market_service.get_drug_market_context(drug.drug_id, drug.name)
                market_contexts[drug.drug_id] = m_ctx
            except Exception as err:
                logger.warning(f"Market intelligence lookup failed for drug {drug.drug_id}: {err}")

        # Initialize typed shared state
        state: SupplyChainState = {
            "snapshot": snapshot,
            "inventory_findings": [],
            "demand_findings": [],
            "procurement_findings": [],
            "distribution_findings": [],
            "vendor_findings": [],
            "compliance_findings": [],
            "coordinator_recommendation": None,
            "market_context": market_contexts,
            "agent_statuses": {
                "InventoryAgent": "pending",
                "DemandAgent": "pending",
                "ProcurementAgent": "pending",
                "DistributionAgent": "pending",
                "VendorAgent": "pending",
                "ComplianceAgent": "pending",
                "CoordinatorAgent": "pending",
            },
            "agent_errors": {
                "InventoryAgent": None,
                "DemandAgent": None,
                "ProcurementAgent": None,
                "DistributionAgent": None,
                "VendorAgent": None,
                "ComplianceAgent": None,
                "CoordinatorAgent": None,
            },
        }

        semaphore = asyncio.Semaphore(self.max_concurrency)

        async def run_node_with_semaphore(node_func):
            async with semaphore:
                return await node_func(state, self.slm_provider)

        node_funcs = [
            run_inventory_node,
            run_demand_node,
            run_procurement_node,
            run_distribution_node,
            run_vendor_node,
            run_compliance_node,
        ]

        # 1. Execute specialized agent nodes in parallel
        results = await asyncio.gather(
            *[run_node_with_semaphore(fn) for fn in node_funcs],
            return_exceptions=True
        )

        final_state: SupplyChainState = {
            "snapshot": snapshot,
            "inventory_findings": [],
            "demand_findings": [],
            "procurement_findings": [],
            "distribution_findings": [],
            "vendor_findings": [],
            "compliance_findings": [],
            "coordinator_recommendation": None,
            "market_context": market_contexts,
            "agent_statuses": dict(state["agent_statuses"]),
            "agent_errors": dict(state["agent_errors"]),
        }

        agent_names = ["InventoryAgent", "DemandAgent", "ProcurementAgent", "DistributionAgent", "VendorAgent", "ComplianceAgent"]

        # Aggregate specialized node results safely
        for idx, res in enumerate(results):
            fallback_agent_name = agent_names[idx]

            if isinstance(res, Exception):
                logger.error(f"Execution error in node {fallback_agent_name}: {res}")
                final_state["agent_statuses"][fallback_agent_name] = "failed"
                final_state["agent_errors"][fallback_agent_name] = str(res)
            elif isinstance(res, dict):
                agent_name = res.get("agent_name", fallback_agent_name)
                
                if "inventory_findings" in res:
                    final_state["inventory_findings"] = res["inventory_findings"]
                if "demand_findings" in res:
                    final_state["demand_findings"] = res["demand_findings"]
                if "procurement_findings" in res:
                    final_state["procurement_findings"] = res["procurement_findings"]
                if "distribution_findings" in res:
                    final_state["distribution_findings"] = res["distribution_findings"]
                if "vendor_findings" in res:
                    final_state["vendor_findings"] = res["vendor_findings"]
                if "compliance_findings" in res:
                    final_state["compliance_findings"] = res["compliance_findings"]

                status = res.get("status", "success")
                error = res.get("error", None)

                final_state["agent_statuses"][agent_name] = status
                final_state["agent_errors"][agent_name] = error

        # 2. Execute CoordinatorAgent synthesis node over aggregated state
        coord_res = await run_coordinator_node(final_state, self.slm_provider)
        if isinstance(coord_res, dict):
            final_state["coordinator_recommendation"] = coord_res.get("coordinator_recommendation")
            final_state["agent_statuses"]["CoordinatorAgent"] = coord_res.get("status", "success")
            final_state["agent_errors"]["CoordinatorAgent"] = coord_res.get("error", None)

        return final_state
