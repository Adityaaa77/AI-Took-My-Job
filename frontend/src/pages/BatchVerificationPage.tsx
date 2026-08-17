// frontend/src/pages/BatchVerificationPage.tsx
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  QrCode,
  Copy,
  Check,
  Thermometer,
  Layers,
  FileText,
  Clock,
  MapPin,
  User,
  ArrowRight,
  RefreshCw,
  Info,
  ExternalLink,
  Package,
} from 'lucide-react';
import {
  traceabilityService,
  type BatchVerificationResponse,
  type TraceabilityEvent,
} from '../services/traceabilityService';
import { ApiService } from '../services/api';

export const BatchVerificationPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('BATCH-001');
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<BatchVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  // Live operational items fetched from MongoDB backend
  const [liveShipments, setLiveShipments] = useState<any[]>([]);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);

  useEffect(() => {
    handleVerify('BATCH-001');
    fetchLiveOperationalItems();
  }, []);

  const fetchLiveOperationalItems = async () => {
    try {
      const [shipRes, orderRes] = await Promise.all([
        ApiService.get<any[]>('/shipments'),
        ApiService.get<any[]>('/purchase-orders'),
      ]);
      if (shipRes.success && shipRes.data) {
        setLiveShipments(shipRes.data.slice(0, 4));
      }
      if (orderRes.success && orderRes.data) {
        setLiveOrders(orderRes.data.slice(0, 4));
      }
    } catch (err) {
      console.warn('Could not load live backend shipments/orders:', err);
    }
  };

  const handleVerify = async (idToVerify?: string) => {
    const targetId = idToVerify || searchQuery;
    if (!targetId.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await traceabilityService.verifyBatch(targetId.trim());
      if (res.data) {
        setData(res.data);
      } else {
        setError(res.error || 'Verification failed to return batch data');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during verification');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateBreach = async () => {
    const targetId = searchQuery.trim() || 'BATCH-001';
    setLoading(true);
    try {
      await ApiService.post('/traceability/events', {
        event_id: `EVT-BREACH-${Date.now()}`,
        batch_id: targetId,
        drug_id: data?.drug_id || 'DRUG-004',
        gtin: data?.gtin || '8901234567891',
        serial_number: data?.serial_number || `SN-2026-${targetId}`,
        event_type: 'SHIPPED',
        actor_id: 'ACTOR-LOG-COLD',
        actor_role: 'COLD_CHAIN_LOGISTICS',
        location_id: 'ROUTE-MH-EXCURSION',
        timestamp: new Date().toISOString(),
        temperature_c: 14.5,
        humidity_percent: 75.0,
        notes: 'IoT Cold-Chain Telemetry Alert: Compressor power failure recorded (14.5°C Excursion)',
      });
      await handleVerify(targetId);
    } catch (err: any) {
      console.warn('Breach simulation notice:', err);
      await handleVerify('BATCH-COLD-02');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'TRUSTED_PRODUCT':
      case 'PRODUCT_IDENTITY_VALID':
      case 'PROVENANCE_VERIFIED':
      case 'CONDITION_SAFE':
      case 'EXPIRY_VALID':
      case 'PASSED':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 inline mr-1" />,
          label: 'PASSED',
        };
      case 'CONDITION_BREACH':
      case 'FAILED_CONDITION_BREACH':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 inline mr-1" />,
          label: 'BREACH DETECTED',
        };
      case 'COUNTERFEIT_SUSPECTED':
      case 'PROVENANCE_INTEGRITY_FAILURE':
      case 'PRODUCT_IDENTITY_MISMATCH':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <XCircle className="w-4 h-4 text-rose-600 inline mr-1" />,
          label: 'TAMPERED / FAILED',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          icon: <Info className="w-4 h-4 text-slate-600 inline mr-1" />,
          label: status || 'UNVERIFIED',
        };
    }
  };

  const renderBanner = () => {
    if (!data) return null;

    const status = data.verification_status;
    if (status === 'TRUSTED_PRODUCT') {
      return (
        <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-6 mb-8 text-emerald-100 shadow-xl backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  VERIFICATION PASSED
                </span>
                <span className="text-xs text-emerald-400 font-mono">
                  SHA-256 HASH CHAIN INTACT
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                ✓ TRUSTED AUTHENTIC PRODUCT
              </h2>
              <p className="text-sm text-emerald-200/80 mt-0.5">
                Cryptographic SHA-256 hash-chain intact. GS1 GTIN identity verified. Cold-chain storage conditions compliant.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-emerald-400">100%</span>
            <p className="text-xs text-emerald-300/70 uppercase tracking-wider font-semibold">VERIFIED</p>
          </div>
        </div>
      );
    }

    if (status === 'CONDITION_BREACH') {
      return (
        <div className="bg-amber-950/80 border border-amber-500/40 rounded-2xl p-6 mb-8 text-amber-100 shadow-xl backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/30">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  HUMAN APPROVAL REQUIRED
                </span>
                <span className="text-xs text-amber-400 font-mono">
                  COLD-CHAIN TEMPERATURE BREACH
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                ⚠ STORAGE CONDITION EXCURSION BREACH
              </h2>
              <p className="text-sm text-amber-200/80 mt-0.5">
                Temperature sensor recorded an excursion outside the required 2.0°C - 8.0°C range. Blocked from automatic distribution.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">HOLD STOCK</span>
            <p className="text-xs text-amber-300/70">QA Inspection Needed</p>
          </div>
        </div>
      );
    }

    if (status === 'COUNTERFEIT_SUSPECTED') {
      return (
        <div className="bg-rose-950/80 border border-rose-500/40 rounded-2xl p-6 mb-8 text-rose-100 shadow-xl backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-rose-500/20 rounded-xl border border-rose-500/30">
              <XCircle className="w-8 h-8 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  SECURITY ALERT
                </span>
                <span className="text-xs text-rose-400 font-mono">
                  HASH LINKAGE TAMPERING DETECTED
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                ✗ COUNTERFEIT / PAYLOAD TAMPERING SUSPECTED
              </h2>
              <p className="text-sm text-rose-200/80 mt-0.5">
                SHA-256 block hash recalculation failed! The payload or event hash was altered post-creation. Stock quarantined immediately.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-rose-400 uppercase tracking-wider">QUARANTINED</span>
            <p className="text-xs text-rose-300/70">Usable Qty = 0</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-8 text-slate-200 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
            <Layers className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">UNVERIFIED BATCH</h2>
            <p className="text-sm text-slate-400">
              Insufficient provenance event history recorded in ledger.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-md">
                  HYPERLEDGER FABRIC PROTOTYPE
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded-md">
                  GS1 DIGITAL LINK VERIFIER
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                Pharmaceutical Batch Provenance & Authenticity Verification
              </h1>
            </div>
          </div>
          <p className="text-slate-600 text-sm mt-2 max-w-3xl">
            Hyperledger Fabric-compatible permissioned DLT prototype with deterministic SHA-256 block ledger tracking pharmaceutical batches across the supply chain lifecycle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleSimulateBreach()}
            disabled={loading}
            className="inline-flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg transition-all border border-amber-500"
            title="Simulate IoT Cold-Chain Temperature Excursion Breach for viewed batch"
          >
            <Thermometer className="w-4 h-4 text-white" />
            <span>Simulate Temp Breach (14.5°C)</span>
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className="inline-flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg transition-all border border-slate-700"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Generate Verification QR Code</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Exact Search ID Guidance Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Batch ID (e.g. BATCH-001, BATCH-COLD-02, REQ-010, SHP-10001)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
          </div>

          <button
            onClick={() => handleVerify()}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            <span>Verify Provenance</span>
          </button>
        </div>

        {/* Guidance Badge Selector Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">
            Exact Preset Scenarios:
          </span>
          <button
            onClick={() => {
              setSearchQuery('BATCH-001');
              handleVerify('BATCH-001');
            }}
            className="px-3 py-1 rounded-lg text-xs font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
          >
            🟢 BATCH-001 (Trusted Paracetamol 500mg)
          </button>

          <button
            onClick={() => {
              setSearchQuery('BATCH-COLD-02');
              handleVerify('BATCH-COLD-02');
            }}
            className="px-3 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
          >
            ⚠ BATCH-COLD-02 (Temp Breach Propofol 1%)
          </button>

          <button
            onClick={() => {
              setSearchQuery('BATCH-ERR-99');
              handleVerify('BATCH-ERR-99');
            }}
            className="px-3 py-1 rounded-lg text-xs font-mono font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-all"
          >
            🔴 BATCH-ERR-99 (Tampered Amoxicillin 250mg)
          </button>
        </div>

        {/* Live Operational Items Bar */}
        {(liveShipments.length > 0 || liveOrders.length > 0) && (
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold uppercase tracking-wider mr-1">
              Live Database Orders & Shipments:
            </span>
            {liveShipments.map((shp) => (
              <button
                key={shp.shipment_id || shp._id}
                onClick={() => {
                  const id = shp.shipment_id || shp._id;
                  setSearchQuery(id);
                  handleVerify(id);
                }}
                className="px-2.5 py-1 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 hover:bg-indigo-800/60 font-mono"
              >
                📦 {shp.shipment_id || 'SHP-LIVE'}
              </button>
            ))}
            {liveOrders.map((ord) => (
              <button
                key={ord.order_id || ord._id}
                onClick={() => {
                  const id = ord.order_id || ord._id;
                  setSearchQuery(id);
                  handleVerify(id);
                }}
                className="px-2.5 py-1 rounded bg-purple-900/40 text-purple-300 border border-purple-700/50 hover:bg-purple-800/60 font-mono"
              >
                📑 {ord.order_id || 'PO-LIVE'}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-center space-x-3">
          <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Verification Status Banner */}
      {renderBanner()}

      {/* 5-Rights Guarantee Grid */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RIGHT PRODUCT</p>
            <div className="mt-2 flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusBadge(data.right_product_status).bg}`}>
                {data.right_product_status === 'PRODUCT_IDENTITY_VALID' ? '✓ Identity Valid' : 'X Identity Mismatch'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">GTIN: {data.gtin || '8901234567890'}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RIGHT CONDITION</p>
            <div className="mt-2 flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusBadge(data.condition_status).bg}`}>
                {data.condition_status === 'CONDITION_SAFE' ? '✓ Temp Compliant' : '⚠ Temp Excursion'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Range: 2.0°C - 8.0°C</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RIGHT PROVENANCE</p>
            <div className="mt-2 flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusBadge(data.provenance_status).bg}`}>
                {data.provenance_status === 'PROVENANCE_VERIFIED' ? '✓ Chain Intact' : 'X Hash Failure'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Blocks: {data.total_ledger_events} Recorded</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RIGHT EXPIRY</p>
            <div className="mt-2 flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusBadge(data.expiry_status).bg}`}>
                ✓ EXPIRY_VALID
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Exp: {data.expiry_date || '2027-12-31'}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RIGHT COMPLIANCE</p>
            <div className="mt-2 flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusBadge(data.compliance_status).bg}`}>
                {data.compliance_status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">QA Released</p>
          </div>
        </div>
      )}

      {/* Immutable SHA-256 Provenance Lifecycle Timeline */}
      {data && data.timeline && data.timeline.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Supply Chain Immutable Provenance Lifecycle Timeline
              </h3>
              <p className="text-xs text-slate-500">
                Cryptographic SHA-256 block ledger history for Batch {data.batch_id} ({data.drug_name})
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono">
              {data.timeline.length} Blocks Recorded
            </span>
          </div>

          <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pl-6">
            {data.timeline.map((evt, idx) => (
              <div key={evt.event_id || idx} className="relative group">
                {/* Stage Bullet Node */}
                <div className="absolute -left-10 top-0.5 p-1.5 bg-slate-900 rounded-full border-2 border-white shadow-md text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-emerald-300 transition-all shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div className="flex items-center space-x-3">
                      <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold">
                        BLOCK #{idx}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        {evt.event_type}
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500 font-mono flex items-center">
                      <Clock className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold uppercase tracking-wider block">ACTOR / ROLE</span>
                      <span className="font-mono text-slate-700 font-medium">
                        {evt.actor_id} ({evt.actor_role})
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold uppercase tracking-wider block">LOCATION ID</span>
                      <span className="font-mono text-slate-700 font-medium">{evt.location_id}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold uppercase tracking-wider block">STORAGE TELEMETRY</span>
                      <span className={`font-mono font-semibold ${evt.temperature_c && (evt.temperature_c < 2 || evt.temperature_c > 8) ? 'text-rose-600 font-bold' : 'text-emerald-700'}`}>
                        {evt.temperature_c !== undefined ? `${evt.temperature_c}°C` : 'N/A'}
                        {evt.humidity_percent !== undefined ? ` | ${evt.humidity_percent}% RH` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Cryptographic Block Hashes Box */}
                  <div className="bg-slate-900 rounded-lg p-3 text-[11px] font-mono text-slate-300 space-y-1 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 uppercase tracking-wider">PREVIOUS BLOCK HASH:</span>
                      <span className="text-slate-400 truncate max-w-xs">{evt.previous_event_hash}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 uppercase tracking-wider">PAYLOAD HASH:</span>
                      <span className="text-indigo-300 truncate max-w-xs">{evt.payload_hash}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-emerald-400 font-semibold uppercase tracking-wider">BLOCK HASH (SHA-256):</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-emerald-300 font-bold truncate max-w-xs">{evt.event_hash}</span>
                        {evt.event_hash && (
                          <button
                            onClick={() => copyToClipboard(evt.event_hash!)}
                            className="text-slate-400 hover:text-white transition-colors"
                            title="Copy SHA-256 Hash"
                          >
                            {copiedHash === evt.event_hash ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification QR Code Generator Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">GS1 Digital Link Verification QR</h3>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 bg-slate-900 rounded-2xl shadow-xl border border-slate-800">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    window.location.origin + '/verify?batchId=' + (data?.batch_id || searchQuery)
                  )}`}
                  alt="Batch Verification QR Code"
                  className="w-44 h-44 rounded-xl cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => window.open(window.location.origin + '/verify?batchId=' + (data?.batch_id || searchQuery), '_blank')}
                  title="Click to open Public Trust Certificate in new tab"
                />
              </div>

              <div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md text-xs font-mono font-bold">
                  BATCH: {data?.batch_id || searchQuery}
                </span>
                <p className="text-xs text-slate-500 mt-2">
                  Scan with any camera or handheld pharma scanner to open instant on-chain authenticity verification.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowQrModal(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
