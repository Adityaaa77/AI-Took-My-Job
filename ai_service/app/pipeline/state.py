from typing import TypedDict, List, Dict, Optional
from app.schemas import SupplyChainSnapshotPayload, AgentFindingSchema, CoordinatorRecommendationResponse

class SupplyChainState(TypedDict):
    """
    Shared typed state passed between nodes in the LangGraph orchestration pipeline.
    Preserves original snapshot input payload, individual agent findings across all six specialized domain agents
    (Inventory, Demand, Procurement, Distribution, Vendor, Compliance), execution statuses, and final Coordinator Recommendation Response.
    """
    snapshot: SupplyChainSnapshotPayload
    inventory_findings: List[AgentFindingSchema]
    demand_findings: List[AgentFindingSchema]
    procurement_findings: List[AgentFindingSchema]
    distribution_findings: List[AgentFindingSchema]
    vendor_findings: List[AgentFindingSchema]
    compliance_findings: List[AgentFindingSchema]
    coordinator_recommendation: Optional[CoordinatorRecommendationResponse]
    agent_statuses: Dict[str, str]
    agent_errors: Dict[str, Optional[str]]
