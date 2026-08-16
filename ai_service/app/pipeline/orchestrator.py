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
)

logger = logging.getLogger(__name__)

class MultiAgentOrchestrator:
    """
    LangGraph-compatible Orchestrator managing execution, state aggregation,
    and fault tolerance across the four specialized agents:
    - InventoryAgent
    - DemandAgent
    - ProcurementAgent
    - DistributionAgent
    
    Uses controlled concurrency (max_concurrency=1 by default for local SLMs like Ollama)
    to prevent HTTP connection queue contention on local single-model servers.
    """

    def __init__(self, slm_provider: BaseSLMProvider, max_concurrency: int = 1):
        self.slm_provider = slm_provider
        self.max_concurrency = max_concurrency

    async def run(self, snapshot: SupplyChainSnapshotPayload) -> SupplyChainState:
        """
        Execute all independent specialized agents in the pipeline and aggregate their findings.
        
        :param snapshot: Master operational supply chain snapshot payload.
        :return: SupplyChainState containing findings, statuses, and errors.
        """
        # Initialize typed shared state
        state: SupplyChainState = {
            "snapshot": snapshot,
            "inventory_findings": [],
            "demand_findings": [],
            "procurement_findings": [],
            "distribution_findings": [],
            "agent_statuses": {
                "InventoryAgent": "pending",
                "DemandAgent": "pending",
                "ProcurementAgent": "pending",
                "DistributionAgent": "pending",
            },
            "agent_errors": {
                "InventoryAgent": None,
                "DemandAgent": None,
                "ProcurementAgent": None,
                "DistributionAgent": None,
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
        ]

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
            "agent_statuses": dict(state["agent_statuses"]),
            "agent_errors": dict(state["agent_errors"]),
        }

        agent_names = ["InventoryAgent", "DemandAgent", "ProcurementAgent", "DistributionAgent"]

        # Aggregate node results safely
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

                status = res.get("status", "success")
                error = res.get("error", None)

                final_state["agent_statuses"][agent_name] = status
                final_state["agent_errors"][agent_name] = error

        return final_state
