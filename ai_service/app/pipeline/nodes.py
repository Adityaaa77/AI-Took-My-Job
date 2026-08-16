import logging
from typing import Dict, Any
from app.pipeline.state import SupplyChainState
from app.agents import InventoryAgent, DemandAgent, ProcurementAgent, DistributionAgent
from app.core import BaseSLMProvider

logger = logging.getLogger(__name__)

async def run_inventory_node(state: SupplyChainState, slm_provider: BaseSLMProvider) -> Dict[str, Any]:
    """
    Orchestration node for InventoryAgent.
    """
    snapshot = state["snapshot"]
    try:
        agent = InventoryAgent(slm_provider=slm_provider)
        findings = await agent.analyze(snapshot)
        return {
            "inventory_findings": findings,
            "agent_name": "InventoryAgent",
            "status": "success",
            "error": None
        }
    except Exception as exc:
        logger.error(f"InventoryAgent node execution failed: {exc}", exc_info=True)
        return {
            "inventory_findings": [],
            "agent_name": "InventoryAgent",
            "status": "failed",
            "error": str(exc)
        }

async def run_demand_node(state: SupplyChainState, slm_provider: BaseSLMProvider) -> Dict[str, Any]:
    """
    Orchestration node for DemandAgent.
    """
    snapshot = state["snapshot"]
    try:
        agent = DemandAgent(slm_provider=slm_provider)
        findings = await agent.analyze(snapshot)
        return {
            "demand_findings": findings,
            "agent_name": "DemandAgent",
            "status": "success",
            "error": None
        }
    except Exception as exc:
        logger.error(f"DemandAgent node execution failed: {exc}", exc_info=True)
        return {
            "demand_findings": [],
            "agent_name": "DemandAgent",
            "status": "failed",
            "error": str(exc)
        }

async def run_procurement_node(state: SupplyChainState, slm_provider: BaseSLMProvider) -> Dict[str, Any]:
    """
    Orchestration node for ProcurementAgent.
    """
    snapshot = state["snapshot"]
    try:
        agent = ProcurementAgent(slm_provider=slm_provider)
        findings = await agent.analyze(snapshot)
        return {
            "procurement_findings": findings,
            "agent_name": "ProcurementAgent",
            "status": "success",
            "error": None
        }
    except Exception as exc:
        logger.error(f"ProcurementAgent node execution failed: {exc}", exc_info=True)
        return {
            "procurement_findings": [],
            "agent_name": "ProcurementAgent",
            "status": "failed",
            "error": str(exc)
        }

async def run_distribution_node(state: SupplyChainState, slm_provider: BaseSLMProvider) -> Dict[str, Any]:
    """
    Orchestration node for DistributionAgent.
    """
    snapshot = state["snapshot"]
    try:
        agent = DistributionAgent(slm_provider=slm_provider)
        findings = await agent.analyze(snapshot)
        return {
            "distribution_findings": findings,
            "agent_name": "DistributionAgent",
            "status": "success",
            "error": None
        }
    except Exception as exc:
        logger.error(f"DistributionAgent node execution failed: {exc}", exc_info=True)
        return {
            "distribution_findings": [],
            "agent_name": "DistributionAgent",
            "status": "failed",
            "error": str(exc)
        }
