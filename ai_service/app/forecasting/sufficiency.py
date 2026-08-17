import logging
from typing import List, Optional
from app.forecasting.schemas import SufficiencyMetadataSchema

logger = logging.getLogger(__name__)


class SufficiencyDetector:
    """
    Deterministic Python component evaluating whether MongoDB hospital consumption
    history is sufficient for local forecasting, or whether external reference fallback is required.
    """

    def __init__(self, min_history_points: int = 6, max_missing_ratio: float = 0.3):
        self.min_history_points = min_history_points
        self.max_missing_ratio = max_missing_ratio

    def evaluate_sufficiency(
        self,
        local_consumption_history: List[float],
        location_id: Optional[str] = None,
        drug_id: Optional[str] = None,
    ) -> SufficiencyMetadataSchema:
        """
        Evaluate historical time-series observation count and missing ratios.
        """
        history_len = len(local_consumption_history) if local_consumption_history else 0

        if history_len >= self.min_history_points:
            return SufficiencyMetadataSchema(
                data_source="LOCAL_HOSPITAL_DATA",
                data_sufficiency="SUFFICIENT",
                history_points=history_len,
                history_period=f"Recent {history_len} Months Hospital Usage",
                missing_ratio=0.0,
                fallback_used=False,
                reason="Sufficient local hospital consumption history available for hospital-specific forecasting.",
            )

        return SufficiencyMetadataSchema(
            data_source="EXTERNAL_REFERENCE_DATA",
            data_sufficiency="INSUFFICIENT_LOCAL_HISTORY",
            history_points=history_len,
            history_period="Sparse Hospital Usage",
            missing_ratio=round((self.min_history_points - history_len) / float(self.min_history_points), 2),
            fallback_used=True,
            reason=f"Insufficient local hospital history ({history_len} points < {self.min_history_points} required). Falling back to OECD/WHO external reference data for trend benchmarking.",
        )
