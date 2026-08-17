import logging
import time
from typing import Dict, List, Optional, Tuple, Any
from app.market_intelligence.base import BaseMarketIntelligenceProvider
from app.market_intelligence.providers.nppa_provider import NPPAProvider
from app.market_intelligence.schemas import (
    DrugMarketContextSchema,
    PriceComparisonSchema,
)

logger = logging.getLogger(__name__)


class CacheEntry:
    def __init__(self, data: DrugMarketContextSchema, ttl_seconds: float = 3600.0):
        self.data = data
        self.cached_at = time.time()
        self.ttl_seconds = ttl_seconds

    def is_expired(self) -> bool:
        return (time.time() - self.cached_at) > self.ttl_seconds


class MarketIntelligenceService:
    """
    Decoupled Market Intelligence Service managing external pricing lookups,
    in-memory TTL caching, fallback handling, and authoritative Python price arithmetic.
    """

    def __init__(
        self,
        providers: Optional[List[BaseMarketIntelligenceProvider]] = None,
        cache_ttl_seconds: float = 3600.0,
    ):
        self.providers = providers or [NPPAProvider()]
        self.cache_ttl_seconds = cache_ttl_seconds
        self._cache: Dict[str, CacheEntry] = {}

    def _cache_key(self, drug_id: str, drug_name: str) -> str:
        return f"{drug_id.upper()}:{drug_name.strip().upper()}"

    async def get_drug_market_context(
        self, drug_id: str, drug_name: str
    ) -> DrugMarketContextSchema:
        """
        Retrieve drug market context with transparent LIVE / CACHED / UNAVAILABLE distinction.
        """
        key = self._cache_key(drug_id, drug_name)

        # 1. Check in-memory cache
        if key in self._cache:
            entry = self._cache[key]
            if not entry.is_expired():
                # Return cached copy with CACHED status
                cached_data = entry.data.model_copy()
                cached_data.data_status = "CACHED" if cached_data.price_available else "UNAVAILABLE"
                return cached_data
            else:
                del self._cache[key]

        # 2. Query external providers
        for provider in self.providers:
            try:
                context = await provider.get_drug_market_context(drug_id, drug_name)
                if context.price_available:
                    # Store in cache
                    self._cache[key] = CacheEntry(context, self.cache_ttl_seconds)
                    return context
            except Exception as exc:
                logger.error(
                    f"Error fetching market intelligence from provider {provider.__class__.__name__}: {str(exc)}",
                    exc_info=True,
                )

        # 3. Return explicit UNAVAILABLE status — NEVER hallucinate prices
        unavailable_context = DrugMarketContextSchema(
            drug_id=drug_id,
            drug_name=drug_name,
            generic_name=None,
            strength=None,
            dosage_form=None,
            pack_size=None,
            reference_price=None,
            reference_price_unit=None,
            currency="INR",
            price_type=None,
            source="NPPA Reference Database",
            source_url="https://nppaindia.nic.in",
            source_timestamp=None,
            price_confidence=0.0,
            price_available=False,
            regulatory_price_available=False,
            notes="Authoritative market price unavailable for this drug.",
            data_status="UNAVAILABLE",
        )
        self._cache[key] = CacheEntry(unavailable_context, self.cache_ttl_seconds)
        return unavailable_context

    def calculate_price_comparison(
        self,
        drug_context: DrugMarketContextSchema,
        vendor_unit_price: Optional[float] = None,
    ) -> PriceComparisonSchema:
        """
        Authoritative Python-calculated price comparison.
        All arithmetic is computed deterministically in Python to prevent SLM price hallucination.
        """
        drug_id = drug_context.drug_id

        if (
            not drug_context.price_available
            or drug_context.reference_price is None
            or vendor_unit_price is None
            or vendor_unit_price < 0
        ):
            return PriceComparisonSchema(
                drug_id=drug_id,
                reference_price=drug_context.reference_price,
                vendor_price=vendor_unit_price,
                price_difference=None,
                price_difference_percentage=None,
                is_above_reference=None,
                is_within_reference=None,
                cost_reasonableness="UNAVAILABLE",
            )

        ref_price = float(drug_context.reference_price)
        v_price = float(vendor_unit_price)

        raw_diff = round(v_price - ref_price, 4)
        pct_diff = round((raw_diff / ref_price) * 100.0, 2)

        is_above = v_price > ref_price
        is_within = v_price <= ref_price

        if is_within:
            reasonableness = "COST_OPTIMAL"
        elif v_price <= (ref_price * 1.05):
            reasonableness = "COST_ACCEPTABLE"
        else:
            reasonableness = "ABOVE_REFERENCE_PRICE"

        return PriceComparisonSchema(
            drug_id=drug_id,
            reference_price=ref_price,
            vendor_price=v_price,
            price_difference=raw_diff,
            price_difference_percentage=pct_diff,
            is_above_reference=is_above,
            is_within_reference=is_within,
            cost_reasonableness=reasonableness,
        )
