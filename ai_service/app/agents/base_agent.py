from abc import ABC, abstractmethod
from typing import List
from app.core.base_llm import BaseSLMProvider
from app.schemas import SupplyChainSnapshotPayload, AgentFindingSchema

class BaseAgent(ABC):
    """
    Abstract Base Class for all specialized agents in the multi-agent network.
    Maintains independence from the underlying SLM inference provider.
    """

    def __init__(self, slm_provider: BaseSLMProvider):
        self.slm_provider = slm_provider

    @abstractmethod
    async def analyze(self, snapshot: SupplyChainSnapshotPayload) -> List[AgentFindingSchema]:
        """
        Analyze an operational supply chain snapshot payload and return a list of findings.
        
        :param snapshot: Master operational snapshot data.
        :return: List of validated AgentFindingSchema objects.
        """
        pass
