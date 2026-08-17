# ai_service/app/telemetry/simulator.py
import math
from datetime import datetime, timedelta
from typing import List
from app.telemetry.schemas import TelemetryReading, TelemetryScenario, TelemetrySimulationRequest
from app.telemetry.profiles import get_drug_condition_profile

def generate_telemetry_stream(req: TelemetrySimulationRequest) -> List[TelemetryReading]:
    """
    Generates a realistic stream of chronologically ordered IoT sensor readings
    based on the requested simulation scenario and drug profile.
    """
    profile = get_drug_condition_profile(req.drug_id)
    base_temp = (profile.min_temperature_c + profile.max_temperature_c) / 2.0  # e.g., 5.0°C for 2-8°C
    if not profile.is_cold_chain:
        base_temp = 20.0  # Room temp

    now = datetime.utcnow()
    readings: List[TelemetryReading] = []

    steps = max(1, min(req.steps, 50))

    for i in range(steps):
        time_point = now - timedelta(seconds=(steps - 1 - i) * 30)
        ts_str = time_point.strftime("%Y-%m-%dT%H:%M:%SZ")

        if req.scenario == TelemetryScenario.NORMAL:
            temp = base_temp + (0.3 * math.sin(i * 0.5))
            humidity = profile.max_humidity_percent - 15.0 + (1.5 * math.cos(i * 0.4))
            vibration = 0.02 + (0.005 * math.sin(i))
            light = 100.0 + (10.0 * math.cos(i))

        elif req.scenario == TelemetryScenario.GRADUAL_DRIFT:
            # Progressively drifts upward towards and past maximum threshold
            temp = base_temp + (i * 0.8)
            humidity = profile.max_humidity_percent - 10.0 + (i * 1.2)
            vibration = 0.03 + (i * 0.002)
            light = 120.0

        elif req.scenario == TelemetryScenario.COMPRESSOR_FAILURE:
            # Rapid thermal rise
            temp = base_temp + (i * 1.8)
            humidity = profile.max_humidity_percent + (i * 2.0)
            vibration = 0.01  # Compressor stopped running
            light = 150.0

        elif req.scenario == TelemetryScenario.DOOR_OPEN:
            # Sharp rise in temp, humidity, and light exposure
            if i < steps // 2:
                temp = base_temp + 0.2
                humidity = profile.max_humidity_percent - 15.0
                light = 80.0
            else:
                temp = profile.max_temperature_c + 6.0 + (i * 0.5)
                humidity = profile.max_humidity_percent + 25.0
                light = 850.0  # Door wide open

        elif req.scenario == TelemetryScenario.RECOVERY:
            # Temperature was high but cools back down to safe range
            if i < steps // 3:
                temp = profile.max_temperature_c + 5.0
            else:
                cooling_progress = (i - steps // 3) / max(1, (steps - steps // 3))
                temp = (profile.max_temperature_c + 5.0) - (cooling_progress * 8.0)
                temp = max(profile.min_temperature_c + 0.5, temp)
            humidity = profile.max_humidity_percent - 10.0
            vibration = 0.04
            light = 110.0

        else:
            temp = base_temp
            humidity = 45.0
            vibration = 0.02
            light = 100.0

        readings.append(
            TelemetryReading(
                timestamp=ts_str,
                shipment_id=req.shipment_id,
                batch_id=req.batch_id,
                drug_id=req.drug_id,
                temperature_c=round(temp, 2),
                humidity_percent=round(min(100.0, max(0.0, humidity)), 2),
                vibration_g=round(max(0.0, vibration), 3),
                light_lux=round(max(0.0, light), 1),
            )
        )

    return readings
