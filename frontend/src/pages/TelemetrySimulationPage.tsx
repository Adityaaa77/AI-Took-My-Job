// frontend/src/pages/TelemetrySimulationPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Thermometer,
  Activity,
  AlertTriangle,
  Play,
  Square,
  ShieldCheck,
  RefreshCw,
  Wind,
  Sun,
  Clock,
  Cpu,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ApiService } from '../services/api';

export interface TelemetryReading {
  timestamp: string;
  shipment_id: string;
  batch_id: string;
  drug_id: string;
  temperature_c: number;
  humidity_percent: number;
  vibration_g: number;
  light_lux: number;
}

export interface RiskPredictionResponse {
  status: 'STABLE' | 'DRIFTING' | 'PREDICTED_BREACH' | 'RECOVERING' | 'INSUFFICIENT_DATA';
  current_condition: 'SAFE' | 'WARNING' | 'BREACH' | 'CRITICAL';
  current_temperature: number;
  current_humidity: number;
  predicted_breach: boolean;
  predicted_breach_in_minutes: number | null;
  risk_score: number;
  risk_factors: string[];
  requires_human_review: boolean;
  usable_quantity_factor: number;
  model_used: string;
  readings_count: int;
  recommended_action: string;
}

export const TelemetrySimulationPage: React.FC = () => {
  const [selectedDrug, setSelectedDrug] = useState<string>('DRUG-004');
  const [selectedBatch, setSelectedBatch] = useState<string>('BATCH-COLD-02');
  const [selectedScenario, setSelectedScenario] = useState<string>('COMPRESSOR_FAILURE');

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [riskData, setRiskData] = useState<RiskPredictionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------------------------------------------------------------------
  // Lifecycle Management (HARD REQUIREMENT: Cleanup on unmount / stop)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, []);

  const stopSimulation = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  };

  const startSimulation = () => {
    stopSimulation(); // Clear any existing interval
    setIsRunning(true);
    setReadings([]);
    setRiskData(null);

    // Initial stream load
    fetchNextTelemetryStep([]);

    // Interval streamer (every 1.5 seconds)
    timerRef.current = setInterval(() => {
      setReadings((prevReadings) => {
        if (prevReadings.length >= 20) {
          stopSimulation();
          return prevReadings;
        }
        fetchNextTelemetryStep(prevReadings);
        return prevReadings;
      });
    }, 1500);
  };

  const fetchNextTelemetryStep = async (currentHistory: TelemetryReading[]) => {
    setLoading(true);
    try {
      const stepCount = currentHistory.length + 1;
      const res = await ApiService.post<TelemetryReading[]>('/telemetry/simulate', {
        scenario: selectedScenario,
        drug_id: selectedDrug,
        batch_id: selectedBatch,
        shipment_id: 'SHP-LIVE-101',
        steps: stepCount,
      });

      if (res && Array.isArray(res)) {
        setReadings(res);
        analyzeRisk(res);
      } else if (res && (res as any).data && Array.isArray((res as any).data)) {
        setReadings((res as any).data);
        analyzeRisk((res as any).data);
      }
    } catch (err) {
      console.warn('Telemetry stream notice:', err);
    } finally {
      setLoading(false);
    }
  };

  const analyzeRisk = async (stream: TelemetryReading[]) => {
    if (!stream || stream.length === 0) return;
    try {
      const riskRes = await ApiService.post<RiskPredictionResponse>('/telemetry/predict-risk', {
        drug_id: selectedDrug,
        batch_id: selectedBatch,
        readings: stream,
      });

      if (riskRes && (riskRes as any).status) {
        setRiskData(riskRes as unknown as RiskPredictionResponse);
      } else if (riskRes && (riskRes as any).data) {
        setRiskData((riskRes as any).data);
      }
    } catch (err) {
      console.warn('Risk prediction notice:', err);
    }
  };

  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-indigo-100 border border-indigo-200 rounded-xl text-indigo-700">
              <Thermometer className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                IoT Cold-Chain Telemetry Simulation & AI Risk Engine
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Live sensor streaming → Statistical feature extraction → Predictive risk classification → Multi-Agent Interlock
              </p>
            </div>
          </div>
        </div>

        {/* Start / Stop Control Buttons */}
        <div className="flex items-center space-x-3">
          {!isRunning ? (
            <Button
              variant="primary"
              size="md"
              icon={<Play className="w-4 h-4 fill-white" />}
              onClick={startSimulation}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              ▶ START TELEMETRY ANALYSIS
            </Button>
          ) : (
            <Button
              variant="danger"
              size="md"
              icon={<Square className="w-4 h-4 fill-white" />}
              onClick={stopSimulation}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse"
            >
              ■ STOP TELEMETRY ANALYSIS
            </Button>
          )}
        </div>
      </div>

      {/* Target Drug & Scenario Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
            <Sparkles className="w-4 h-4 mr-1 text-indigo-600" />
            Simulation Scenario Configuration
          </span>
          <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            SIMULATION SCENARIO ONLY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Drug Formulation</label>
            <select
              value={selectedDrug}
              onChange={(e) => setSelectedDrug(e.target.value)}
              disabled={isRunning}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
            >
              <option value="DRUG-004">DRUG-004 • Propofol 1% IV Emulsion (2.0°C - 8.0°C)</option>
              <option value="DRUG-303">DRUG-303 • Amoxicillin 250mg Suspension (2.0°C - 8.0°C)</option>
              <option value="DRUG-001">DRUG-001 • Paracetamol 500mg Tablets (15.0°C - 25.0°C)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Batch ID</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              disabled={isRunning}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
            >
              <option value="BATCH-COLD-02">BATCH-COLD-02 (Reefer Transport Hub)</option>
              <option value="BATCH-001">BATCH-001 (Central Warehouse)</option>
              <option value="BATCH-ERR-99">BATCH-ERR-99 (Quarantined Inventory)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Environmental Scenario Preset</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedScenario('NORMAL')}
                disabled={isRunning}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${selectedScenario === 'NORMAL' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
              >
                🟢 Normal (4.5°C)
              </button>
              <button
                type="button"
                onClick={() => setSelectedScenario('GRADUAL_DRIFT')}
                disabled={isRunning}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${selectedScenario === 'GRADUAL_DRIFT' ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
              >
                ⚠️ Gradual Drift
              </button>
              <button
                type="button"
                onClick={() => setSelectedScenario('COMPRESSOR_FAILURE')}
                disabled={isRunning}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${selectedScenario === 'COMPRESSOR_FAILURE' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
              >
                🔴 Compressor Fail
              </button>
              <button
                type="button"
                onClick={() => setSelectedScenario('DOOR_OPEN')}
                disabled={isRunning}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${selectedScenario === 'DOOR_OPEN' ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
              >
                🚪 Door Open
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Telemetry Chart & Risk Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Sensor Telemetry Stream */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
                <Activity className="w-4 h-4 mr-1 text-indigo-600" />
                Live Sensor Telemetry Stream ({readings.length} points)
              </span>
              {isRunning && (
                <span className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Streaming Active</span>
                </span>
              )}
            </div>

            {/* Custom SVG Telemetry Canvas Chart */}
            <div className="w-full h-64 bg-slate-900 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 border-b border-slate-800 pb-2">
                <span>Safe Range: 2.0°C — 8.0°C</span>
                <span className="text-emerald-400 font-bold">
                  Latest: {latestReading ? `${latestReading.temperature_c.toFixed(1)}°C` : 'N/A'}
                </span>
              </div>

              {/* SVG Line Graph */}
              <svg className="w-full h-44 overflow-visible" viewBox="0 0 400 150">
                {/* Safe Range Shaded Band (2.0°C to 8.0°C maps to y=110 to y=40) */}
                <rect x="0" y="35" width="400" h="75" fill="rgba(16, 185, 129, 0.1)" stroke="rgba(16, 185, 129, 0.3)" strokeDasharray="3 3" />
                <line x1="0" y1="35" x2="400" y2="35" stroke="#10b981" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="110" x2="400" y2="110" stroke="#10b981" strokeWidth="1" strokeDasharray="4 4" />

                {/* Telemetry Points Line */}
                {readings.length > 1 && (
                  <polyline
                    fill="none"
                    stroke={latestReading && latestReading.temperature_c > 8.0 ? "#f43f5e" : "#38bdf8"}
                    strokeWidth="3"
                    points={readings
                      .map((r, idx) => {
                        const x = (idx / Math.max(1, readings.length - 1)) * 380 + 10;
                        // Map temp 0°C to 20°C -> y=140 to y=10
                        const y = 140 - Math.min(130, Math.max(0, (r.temperature_c / 20.0) * 130));
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                )}

                {/* Sensor Data Points */}
                {readings.map((r, idx) => {
                  const x = (idx / Math.max(1, readings.length - 1)) * 380 + 10;
                  const y = 140 - Math.min(130, Math.max(0, (r.temperature_c / 20.0) * 130));
                  const isExcursion = r.temperature_c > 8.0 || r.temperature_c < 2.0;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="4"
                      fill={isExcursion ? "#f43f5e" : "#38bdf8"}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>

              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>0s</span>
                <span>Time (Seconds)</span>
                <span>{readings.length * 1.5}s</span>
              </div>
            </div>

            {/* Current Real-Time Sensor Cards */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Temp (°C)</span>
                <span className={`text-base font-bold font-mono ${latestReading && (latestReading.temperature_c > 8.0 || latestReading.temperature_c < 2.0) ? 'text-rose-600' : 'text-slate-900'}`}>
                  {latestReading ? `${latestReading.temperature_c}°C` : '--'}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Humidity (%)</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  {latestReading ? `${latestReading.humidity_percent}%` : '--'}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Vibration (g)</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  {latestReading ? `${latestReading.vibration_g}g` : '--'}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Light (Lux)</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  {latestReading ? `${latestReading.light_lux} lx` : '--'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Predictive Risk Panel & Multi-Agent Interlock */}
        <div className="lg:col-span-5 space-y-6">
          {/* Predictive Risk Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
              <Cpu className="w-4 h-4 mr-1 text-indigo-600" />
              AI Risk Prediction Model & Diagnostics
            </span>

            {riskData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-600">Current Condition:</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${riskData.current_condition === 'SAFE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 animate-pulse'}`}>
                    {riskData.current_condition}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-600">Predictive Status:</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${riskData.status === 'STABLE' ? 'bg-emerald-100 text-emerald-800' : (riskData.status === 'DRIFTING' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}`}>
                    {riskData.status}
                  </span>
                </div>

                {/* Risk Score Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">Statistical Risk Index:</span>
                    <span className={riskData.risk_score > 0.6 ? 'text-rose-600 font-mono' : 'text-emerald-600 font-mono'}>
                      {(riskData.risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${riskData.risk_score > 0.6 ? 'bg-rose-500' : (riskData.risk_score > 0.3 ? 'bg-amber-500' : 'bg-emerald-500')}`}
                      style={{ width: `${Math.min(100, riskData.risk_score * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Risk Factors List */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <span className="font-bold text-slate-700 block">Risk Factors Identified:</span>
                  {riskData.risk_factors.map((factor, idx) => (
                    <p key={idx} className="text-slate-600 font-mono flex items-start">
                      <span className="mr-1.5 text-indigo-500">•</span>
                      {factor}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-8 text-center text-xs font-medium text-slate-500 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
                <p>Click "START TELEMETRY ANALYSIS" to initialize real-time sensor stream...</p>
              </div>
            )}
          </div>

          {/* Multi-Agent Interlock Decision Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
              Multi-Agent Safety Interlock Response
            </span>

            {riskData && riskData.current_condition !== 'SAFE' ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2.5 text-xs text-rose-900">
                <div className="flex items-center space-x-2 font-bold text-rose-800">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>ComplianceAgent: CONDITION_BREACH DETECTED</span>
                </div>
                <div className="flex items-center space-x-2 font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>CoordinatorAgent: QUARANTINE REQUIRED</span>
                </div>
                <div className="pt-2 border-t border-rose-200 grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-600 block">Usable Quantity:</span>
                    <span className="font-bold text-rose-700">0 units (Quarantined)</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">Human Approval:</span>
                    <span className="font-bold text-rose-700">REQUIRED</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2.5 text-xs text-emerald-900">
                <div className="flex items-center space-x-2 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>ComplianceAgent: CONDITION_SAFE</span>
                </div>
                <div className="flex items-center space-x-2 font-bold text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>CoordinatorAgent: NO CONDITION CONSTRAINT</span>
                </div>
                <div className="pt-2 border-t border-emerald-200 text-[11px] font-mono text-emerald-700">
                  <span>Usable Quantity: 100% Available • Human Approval: Automated</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default TelemetrySimulationPage;
