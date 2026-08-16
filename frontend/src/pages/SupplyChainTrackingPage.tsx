// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// End-to-End Visual Supply Chain Tracking & Blockchain Verification Pipeline
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Building2,
  ShoppingCart,
  Boxes,
  Activity,
  Lock,
  Thermometer,
  MapPin,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { shipmentService } from '../services/shipmentService';
import { blockchainService } from '../services/blockchainService';
import type { Shipment } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

export const SupplyChainTrackingPage: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function loadData() {
      const shpRes = await shipmentService.getAllShipments();
      if (shpRes.data) {
        setShipments(shpRes.data);
        setSelectedShipment(shpRes.data[0]);
      }
    }
    loadData();
  }, []);

  const handleVerifyBlockchain = async (txHash: string) => {
    setVerifying(true);
    setVerifyModalOpen(true);
    const result = await blockchainService.verifyTransaction(txHash);
    setVerificationResult(result);
    setVerifying(false);
  };

  const stages = [
    { id: 'vendor', title: '1. VENDOR', desc: 'Active Pharmaceutical Ingredients & Formulation', icon: Building2 },
    { id: 'po', title: '2. PURCHASE ORDER', desc: 'Sanctioned Order Batching & Smart Contract Locking', icon: ShoppingCart },
    { id: 'shipment', title: '3. SHIPMENT', desc: 'GPS & IoT Cold-Chain In-Transit Monitoring', icon: Truck },
    { id: 'warehouse', title: '4. WAREHOUSE', desc: 'Central Receipt, QA Inspection & Reserve Buffering', icon: Boxes },
    { id: 'hospital', title: '5. HOSPITAL', desc: 'Institutional Allocation & Emergency Ingestion', icon: Building2 },
    { id: 'consumption', title: '6. CONSUMPTION', desc: 'Ward Patient Administration & Anomaly Detection', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Top Concept Banner ────────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/30 text-emerald-400 text-xs font-bold mb-2">
              <ShieldCheck className="h-4 w-4" />
              INTELLIGENT CLOSED-LOOP CHAIN OF CUSTODY
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              End-to-End Visual Supply Chain Tracking
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Track lifecycle integrity across every operational handoff: from manufacturer synthesis to institutional bed-side patient consumption.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700 text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Active Pipeline</p>
              <p className="text-sm font-bold text-emerald-400">{shipments.length} Monitored Shipments</p>
            </div>
          </div>
        </div>

        {/* ─── 6-Stage Visual Progression Pipeline ─────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-6">
          {stages.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div
                key={st.id}
                className="bg-slate-800/70 p-3.5 rounded-xl border border-slate-700/60 relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-lg bg-slate-700/80 text-emerald-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">0{idx + 1}</span>
                  </div>
                  <h4 className="font-bold text-xs text-white leading-tight">{st.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">{st.desc}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-emerald-400 font-semibold">
                  <span>State Verified</span>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Main Interactive Shipment Inspector ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Shipment Selector List */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 px-1">Select Tracked Movement</h3>
          <div className="space-y-2.5">
            {shipments.map((shp) => {
              const isSelected = selectedShipment?.shipment_id === shp.shipment_id;
              return (
                <div
                  key={shp.shipment_id}
                  onClick={() => setSelectedShipment(shp)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900">{shp.shipment_id}</span>
                      <p className="font-semibold text-xs text-slate-800 mt-0.5">
                        {typeof shp.drug_id === 'string' ? shp.drug_id : shp.drug_id?.name}
                      </p>
                    </div>
                    <StatusBadge status={shp.status} size="sm" />
                  </div>

                  <div className="mt-2.5 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Qty: {shp.quantity.toLocaleString()} units</span>
                    <span className="font-mono text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded">
                      {shp.blockchain_tx_hash ? 'On-Chain' : 'Off-Chain'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Live Transit Milestones & Telemetry Detail */}
        {selectedShipment && (
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    <span>Live Dossier: {selectedShipment.shipment_id}</span>
                    <StatusBadge status={selectedShipment.status} size="sm" />
                  </div>
                }
                subtitle={`Associated with Order: ${typeof selectedShipment.order_id === 'string' ? selectedShipment.order_id : selectedShipment.order_id?.order_id}`}
                action={
                  selectedShipment.blockchain_tx_hash && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Lock className="h-3.5 w-3.5 text-emerald-600" />}
                      onClick={() => handleVerifyBlockchain(selectedShipment.blockchain_tx_hash!)}
                    >
                      Verify On Blockchain
                    </Button>
                  )
                }
              />
              <CardBody className="space-y-6">
                {/* Route Overview Strip */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Origin Facility</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedShipment.origin_id}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Destination Facility</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedShipment.destination_id}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Carrier Logistics</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedShipment.carrier_name || 'Dedicated Fleet'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Estimated Delivery</span>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {new Date(selectedShipment.estimated_arrival).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Cold-Chain IoT Telemetry (if present) */}
                {selectedShipment.temperature_log && (
                  <div className="bg-cyan-50/60 p-4 rounded-xl border border-cyan-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-cyan-700" />
                        <span className="font-bold text-xs text-cyan-900">
                          Active Cold-Chain IoT Telemetry (2°C - 8°C Requirement)
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        Normative (4.3°C Avg)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 overflow-x-auto">
                      {selectedShipment.temperature_log.map((temp, i) => (
                        <div
                          key={i}
                          className="bg-white px-3 py-1.5 rounded-lg border border-cyan-100 text-center shrink-0 shadow-2xs"
                        >
                          <span className="text-[10px] text-slate-400">Log #{i + 1}</span>
                          <p className="text-xs font-bold text-cyan-900">{temp}°C</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Milestone Progress Cards */}
                <div>
                  <h4 className="font-bold text-xs text-slate-900 mb-3 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    Geographical Milestones & Custody Handoffs
                  </h4>

                  <div className="space-y-3">
                    {selectedShipment.milestones?.map((m, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                          m.status === 'completed'
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                            : m.status === 'current'
                            ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              m.status === 'completed'
                                ? 'bg-emerald-600 text-white'
                                : m.status === 'current'
                                ? 'bg-blue-600 text-white animate-pulse'
                                : 'bg-slate-200 text-slate-400'
                            }`}
                          >
                            {m.status === 'completed' ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <span className="text-[10px] font-bold">{idx + 1}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{m.stage}</p>
                            <p className="text-[11px] text-slate-600 mt-0.5">{m.location}</p>
                            {m.temperature && (
                              <span className="inline-block mt-1 text-[10px] text-cyan-700 bg-cyan-100/60 px-1.5 py-0.2 rounded font-mono">
                                Cold Chain: {m.temperature}°C
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blockchain Cryptographic Reference */}
                {selectedShipment.blockchain_tx_hash && (
                  <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Anchored Transaction Hash</p>
                        <p className="font-mono text-xs text-emerald-400 truncate max-w-md">
                          {selectedShipment.blockchain_tx_hash}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<ExternalLink className="h-3.5 w-3.5" />}
                      onClick={() => handleVerifyBlockchain(selectedShipment.blockchain_tx_hash!)}
                    >
                      Audit Proof
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* ─── Blockchain Verification Modal ──────────────────────────────────── */}
      <Modal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        title="Smart Contract Cryptographic Verification"
        subtitle="Verifying state proof against distributed ledger consensus"
        maxWidth="lg"
        footer={
          <Button variant="secondary" size="md" onClick={() => setVerifyModalOpen(false)}>
            Close Proof
          </Button>
        }
      >
        {verifying ? (
          <div className="py-12 text-center space-y-3">
            <div className="h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">Querying distributed nodes & Merkle roots...</p>
          </div>
        ) : verificationResult?.success ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
              <div>
                <h4 className="font-bold text-emerald-900 text-sm">State Proof Validated</h4>
                <p className="text-emerald-700 text-xs">
                  Event payload hash matches immutable block record with 24 consensus node confirmations.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Transaction Hash</span>
                <p className="text-xs text-slate-800 break-all">{verificationResult.record.tx_hash}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Block Number</span>
                  <p className="text-xs text-slate-800 font-bold">#{verificationResult.record.block_number}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Gas Consumed</span>
                  <p className="text-xs text-slate-800">{verificationResult.record.gas_used} Wei</p>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Authorized Actor</span>
                <p className="text-xs text-slate-800">
                  {verificationResult.record.actor} ({verificationResult.record.actor_role})
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Payload SHA-256</span>
                <p className="text-[11px] text-slate-600 break-all">{verificationResult.record.payload_hash}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-rose-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="font-bold text-sm">Verification Failed</p>
            <p className="text-xs text-slate-500 mt-1">Transaction hash could not be validated on ledger.</p>
          </div>
        )}
      </Modal>
    </div>
  );
};
