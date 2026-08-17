from abc import ABC, abstractmethod
from typing import Optional
from app.market_intelligence.schemas import DrugMarketContextSchema


class BaseMarketIntelligenceProvider(ABC):
    """
    Abstract base interface for all external drug market intelligence providers.
    Supports plugging in NPPA, DPCO, or future live government/market REST APIs.
    """

    @abstractmethod
    async def get_drug_market_context(
        self, drug_id: str, drug_name: str
    ) -> DrugMarketContextSchema:
        """
        Fetch authoritative drug market context and reference ceiling pricing for a given drug.

        :param drug_id: Internal drug identifier e.g. DRUG-505
        :param drug_name: Drug generic/brand name e.g. Paracetamol 500mg
        :return: DrugMarketContextSchema containing verified market pricing or explicit unavailable state.
        """
        pass
