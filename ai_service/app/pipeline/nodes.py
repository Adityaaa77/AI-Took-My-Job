import logging
from typing import Dict, Any
from app.pipeline.state import SupplyChainState
from app.agents.inventory_agent import InventoryAgent
from app.agents.demand_agent import DemandAgent
from app.agents.procurement_agent import ProcurementAgent
from app.agents.distribution_agent import DistributionAgent
from app.agents.vendor_agent import VendorAgent
from app.agents.compliance_agent import ComplianceAgent
from app.agents.coordinator_agent import CoordinatorAgent
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

async def run_vendor_node(state: SupplyChainState, slm_provider: BaseSLMProvider) -> Dict[str, Any]:
    """
    Orchestration node for VendorAgent.
    """
    snapshot = state["snapshot"]
    try:
        agent = VendorAgent(slm_provider=slm_provider)
        findings = await agent.analyze(snapshot)
        return {
            "vendor_findings": findings,
            "agent_name": "VendorAgent",
            "status": "success",
            "error": None
        }
    except Exception as exc:
        logger.error(f"VendorAgent node execution failed: {exc}", exc_info=True)
        return {
            "vendor_findings": [],
            "agent_name": "VendorAgent",
            "status": "failed",
            "error": str(exc)
        }

async def run_compliance_node(state: SupplyChainState, slm_provider: BaseSLMProvider) -> Dict[str, Any]:
    """
    Orchestration node for ComplianceAgent.
    """
    snapshot = state["snapshot"]
    try:
        agent = ComplianceAgent(slm_provider=slm_provider)
        findings = await agent.analyze(snapshot)
        return {
            "compliance_findings": findings,
            "agent_name": "ComplianceAgent",
            "status": "success",
            "error": None
        }
    except Exception as exc:
        logger.error(f"ComplianceAgent node execution failed: {exc}", exc_info=True)
        return {
            "compliance_findings": [],
            "agent_name": "ComplianceAgent",
            "status": "failed",
            "error": str(exc)
        }

async def run_coordinator_node(state: SupplyChainState, slm_provider: BaseSLMProvider) -> Dict[str, Any]:
    """
    Orchestration node for CoordinatorAgent. Executes AFTER specialized findings are aggregated.
    """
    try:
        coordinator = CoordinatorAgent(slm_provider=slm_provider)
        recommendation = await coordinator.synthesize(state)
        return {
            "coordinator_recommendation": recommendation,
            "agent_name": "CoordinatorAgent",
            "status": "success",
            "error": None
        }
    except Exception as exc:
        logger.error(f"CoordinatorAgent node execution failed: {exc}", exc_info=True)
        return {
            "coordinator_recommendation": None,
            "agent_name": "CoordinatorAgent",
            "status": "failed",
            "error": str(exc)
        }
