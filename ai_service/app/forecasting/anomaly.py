import math
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)


class AnomalyAndTrendDetector:
    """
    Deterministic Python component calculating consumption trend patterns
    and statistical anomaly z-scores over historical and forecast series.
    """

    def analyze_trend_and_anomalies(
        self, historical_series: List[float], forecast_series: List[float]
    ) -> Tuple[str, bool, str, float]:
        """
        Calculates (trend, anomaly_detected, anomaly_type, anomaly_score).
        """
        all_points = list(historical_series) + list(forecast_series)

        if not all_points or len(all_points) < 2:
            return ("STABLE", False, "NORMAL", 0.0)

        n = len(historical_series) if historical_series else len(all_points)
        hist = historical_series if historical_series else all_points

        mean_val = sum(hist) / float(len(hist))
        variance = sum((x - mean_val) ** 2 for x in hist) / float(len(hist))
        std_dev = math.sqrt(variance)

        # 1. Trend Calculation
        if len(all_points) >= 3:
            first_half_avg = sum(all_points[: len(all_points) // 2]) / float(len(all_points) // 2)
            second_half_avg = sum(all_points[len(all_points) // 2 :]) / float(len(all_points) - len(all_points) // 2)
            pct_change = ((second_half_avg - first_half_avg) / first_half_avg) * 100.0 if first_half_avg > 0 else 0.0

            if std_dev > (0.4 * mean_val) and mean_val > 0:
                trend = "VOLATILE"
            elif pct_change >= 10.0:
                trend = "INCREASING"
            elif pct_change <= -10.0:
                trend = "DECREASING"
            else:
                trend = "STABLE"
        else:
            trend = "STABLE"

        # 2. Statistical Anomaly Detection (Z-Score & Recent Delta)
        latest_val = forecast_series[0] if forecast_series else hist[-1]
        z_score = abs(latest_val - mean_val) / std_dev if std_dev > 0 else 0.0
        z_score = round(z_score, 2)

        anomaly_detected = False
        anomaly_type = "NORMAL"

        if z_score >= 2.0 or (mean_val > 0 and (latest_val - mean_val) / mean_val > 0.4):
            anomaly_detected = True
            if latest_val > mean_val:
                anomaly_type = "SUDDEN_SPIKE"
            else:
                anomaly_type = "SUDDEN_DECREASE"
        elif trend == "VOLATILE":
            anomaly_detected = True
            anomaly_type = "HIGH_VOLATILITY"

        return (trend, anomaly_detected, anomaly_type, z_score)
