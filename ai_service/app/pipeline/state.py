from typing import TypedDict, List, Dict, Optional
from app.schemas import SupplyChainSnapshotPayload, AgentFindingSchema

class SupplyChainState(TypedDict):
    """
    Shared typed state passed between nodes in the LangGraph orchestration pipeline.
    Preserves original snapshot input payload, individual agent findings, and execution statuses.
    """
    snapshot: SupplyChainSnapshotPayload
    inventory_findings: List[AgentFindingSchema]
    demand_findings: List[AgentFindingSchema]
    procurement_findings: List[AgentFindingSchema]
    distribution_findings: List[AgentFindingSchema]
    agent_statuses: Dict[str, str]
    agent_errors: Dict[str, Optional[str]]
