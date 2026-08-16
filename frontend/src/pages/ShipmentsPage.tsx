// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Shipment Logistics & In-Transit Custody Management
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Truck, Plus, CheckCircle2, Thermometer, AlertTriangle, ExternalLink, Lock, MapPin, Clock, Building2, Boxes, FileText } from 'lucide-react';
import { shipmentService } from '../services/shipmentService';
import { drugService } from '../services/drugService';
import type { Shipment, Drug, ShipmentStatus } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';

export const ShipmentsPage: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
  const [updateStatus, setUpdateStatus] = useState<ShipmentStatus>('in_transit');
  const [trackingNote, setTrackingNote] = useState('');
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const [newShipment, setNewShipment] = useState<Partial<Shipment>>({
    drug_id: '',
    quantity: 500,
    origin_id: 'WH-001 (CMSS North Hub)',
    origin_type: 'warehouse',
    destination_id: 'HOSP-001 (AIIMS New Delhi)',
    destination_type: 'hospital',
    carrier_name: 'BlueDart Healthcare Cold-Chain',
    estimated_arrival: new Date(Date.now() + 2 * 86400000).toISOString(),
    tracking_note: 'Dispatched with continuous temperature data-logger.',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [shpRes, drugRes] = await Promise.all([
      shipmentService.getAllShipments(),
      drugService.getAllDrugs(),
    ]);

    if (shpRes.data) setShipments(shpRes.data);
    if (drugRes.data) setDrugs(drugRes.data);
    setLoading(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShipment.drug_id) return;

    const res = await shipmentService.createShipment(newShipment);
    if (res.success) {
      setCreateModalOpen(false);
      setToast({ message: 'New logistics shipment created and registered for dispatch.', isError: false });
      loadData();
    } else {
      setToast({ message: res.message || 'Failed to create shipment', isError: true });
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    const targetId = selectedShipment.shipment_id || selectedShipment._id || '';
    const res = await shipmentService.updateShipmentStatus(
      targetId,
      updateStatus,
      trackingNote
    );

    if (res.success) {
      setStatusModalOpen(false);
      setToast({
        message: `Shipment ${targetId} status updated to ${updateStatus.toUpperCase()}.`,
        isError: false,
      });
      loadData();
    } else {
      setToast({
        message: res.message || 'Failed to update shipment status',
        isError: true,
      });
    }
  };

  const filteredShipments = shipments.filter((s) => {
    const shipmentId = (s.shipment_id || s._id || '').toLowerCase();
    const origin = s.origin_id.toLowerCase();
    const destination = s.destination_id.toLowerCase();
    const drugName =
      typeof s.drug_id === 'string' ? s.drug_id.toLowerCase() : s.drug_id?.name?.toLowerCase() || '';

    const matchesSearch =
      shipmentId.includes(searchQuery.toLowerCase()) ||
      origin.includes(searchQuery.toLowerCase()) ||
      destination.includes(searchQuery.toLowerCase()) ||
      drugName.includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns: Column<Shipment>[] = [
    {
      header: 'Shipment ID / Carrier',
      accessor: (s) => (
        <div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDetailShipment(s);
              setDetailModalOpen(true);
            }}
            className="font-mono font-bold text-xs text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
            title="Click to view full end-to-end custody history"
          >
            <span>{s.shipment_id}</span>
            <ExternalLink className="h-3 w-3 inline shrink-0" />
          </button>
          <p className="text-xs text-slate-700 font-semibold mt-0.5">{s.carrier_name || 'Fleet Truck'}</p>
          <span className="text-[10px] text-slate-400 font-mono">Trk: {s.tracking_number || 'TRK-N/A'}</span>
        </div>
      ),
    },
    {
      header: 'Drug & Quantity',
      accessor: (s) => (
        <div>
          <p className="font-bold text-xs text-slate-800">
            {typeof s.drug_id === 'string' ? s.drug_id : s.drug_id?.name}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">
            {s.quantity.toLocaleString()} units
          </span>
        </div>
      ),
    },
    {
      header: 'Corridor Route',
      accessor: (s) => (
        <div className="text-xs">
          <span className="text-slate-500">{s.origin_id}</span>
          <p className="font-semibold text-slate-900 mt-0.5">➔ {s.destination_id}</p>
        </div>
      ),
    },
    {
      header: 'ETA & Status',
      accessor: (s) => (
        <div>
          <StatusBadge status={s.status} size="sm" />
          <p className="text-[10px] text-slate-400 font-mono mt-1">
            ETA: {new Date(s.estimated_arrival).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (s) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedShipment(s);
            setUpdateStatus(s.status);
            setTrackingNote(s.tracking_note || '');
            setStatusModalOpen(true);
          }}
        >
          Update Status
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="In-Transit Shipments"
          value={shipments.filter((s) => s.status === 'in_transit' || s.status === 'dispatched').length}
          icon={<Truck className="h-5 w-5" />}
          subtitle="Active transport corridors"
          color="cyan"
        />
        <StatCard
          title="Preparing at Origin"
          value={shipments.filter((s) => s.status === 'preparing').length}
          icon={<Truck className="h-5 w-5" />}
          subtitle="Dock loading & QA signoff"
          color="amber"
        />
        <StatCard
          title="Delivered This Month"
          value={shipments.filter((s) => s.status === 'delivered' || s.status === 'received').length}
          icon={<CheckCircle2 className="h-5 w-5" />}
          subtitle="100% custody verified"
          color="emerald"
        />
        <StatCard
          title="Active Telemetry Logs"
          value={shipments.length}
          icon={<Thermometer className="h-5 w-5" />}
          subtitle="Cold-chain IoT continuous feed"
          color="blue"
        />
      </div>

      {toast && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs ${
            toast.isError
              ? 'bg-rose-50 border border-rose-300 text-rose-900'
              : 'bg-emerald-50 border border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.isError ? (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by shipment ID, route, or drug..."
            className="w-full sm:w-80"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="all">All Shipment Statuses</option>
            <option value="preparing">Preparing</option>
            <option value="dispatched">Dispatched</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="received">Received</option>
            <option value="delayed">Delayed</option>
          </select>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setNewShipment({
              drug_id: drugs[0]?.drug_id || drugs[0]?._id || 'DRUG-001',
              quantity: 800,
              origin_id: 'WH-001 (CMSS North Hub Gurugram)',
              origin_type: 'warehouse',
              destination_id: 'HOSP-001 (AIIMS New Delhi)',
              destination_type: 'hospital',
              carrier_name: 'Safexpress Reefer Truck (DL-1AA-9082)',
              estimated_arrival: new Date(Date.now() + 2 * 86400000).toISOString(),
              tracking_note: 'Standard emergency transfer.',
            });
            setCreateModalOpen(true);
          }}
        >
          Dispatch New Shipment
        </Button>
      </div>

      {/* Shipments Table */}
      <Card>
        <CardHeader
          title="National Active Logistics & Reefer Corridors"
          subtitle={`Tracking ${filteredShipments.length} live and historic movements (Click Shipment ID for full history)`}
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredShipments}
            loading={loading}
            emptyMessage="No shipments found matching criteria."
          />
        </CardBody>
      </Card>

      {/* Full End-to-End Shipment History Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`End-to-End Custody History: ${detailShipment?.shipment_id}`}
        subtitle="Complete lifecycle dossier from origin dock to destination receiving"
        maxWidth="lg"
        footer={
          <Button variant="secondary" size="md" onClick={() => setDetailModalOpen(false)}>
            Close Dossier
          </Button>
        }
      >
        {detailShipment && (
          <div className="space-y-6 text-xs text-slate-800">
            {/* Header Status Strip */}
            <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-emerald-400">{detailShipment.shipment_id}</span>
                  <StatusBadge status={detailShipment.status} size="sm" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Carrier: <span className="text-white font-semibold">{detailShipment.carrier_name || 'Standard Fleet'}</span> • Tracking: <span className="font-mono text-slate-300">{detailShipment.tracking_number || 'N/A'}</span>
                </p>
              </div>

              {detailShipment.blockchain_tx_hash && (
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-500/30">
                    <Lock className="h-3 w-3" />
                    Ledger Verified
                  </span>
                </div>
              )}
            </div>

            {/* Manifest & Tracking Description */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-emerald-600" /> Operational Manifest & Tracking Description
              </span>
              <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                {detailShipment.tracking_note || 'Shipment registered at dispatch dock with continuous temperature data-logger.'}
              </p>
              {typeof detailShipment.drug_id !== 'string' && (detailShipment.drug_id?.description || detailShipment.drug_id?.category) && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/80 flex items-center gap-3">
                  <span>Category: <strong className="text-slate-700">{detailShipment.drug_id.category}</strong></span>
                  <span>Unit: <strong className="text-slate-700">{detailShipment.drug_id.unit}</strong></span>
                  {detailShipment.drug_id.description && <span>Details: <strong className="text-slate-700">{detailShipment.drug_id.description}</strong></span>}
                </div>
              )}
            </div>

            {/* Route & Details Grid */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-slate-500" /> Origin Facility
                </span>
                <p className="font-bold text-slate-900 mt-0.5">{detailShipment.origin_id}</p>
                <span className="text-[10px] text-slate-500 uppercase">{detailShipment.origin_type}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-slate-500" /> Destination Facility
                </span>
                <p className="font-bold text-slate-900 mt-0.5">{detailShipment.destination_id}</p>
                <span className="text-[10px] text-slate-500 uppercase">{detailShipment.destination_type}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Boxes className="h-3 w-3 text-slate-500" /> Drug Formulation & Quantity
                </span>
                <p className="font-bold text-slate-900 mt-0.5">
                  {typeof detailShipment.drug_id === 'string' ? detailShipment.drug_id : detailShipment.drug_id?.name}
                </p>
                <p className="text-slate-600 font-mono text-[11px] mt-0.5">
                  {detailShipment.quantity.toLocaleString()} units
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-500" /> Arrival Timestamps
                </span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  ETA: {new Date(detailShipment.estimated_arrival).toLocaleString()}
                </p>
                {detailShipment.actual_arrival && (
                  <p className="font-bold text-emerald-700 text-[11px]">
                    Actual: {new Date(detailShipment.actual_arrival).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Cold Chain IoT Telemetry */}
            {detailShipment.temperature_log && detailShipment.temperature_log.length > 0 && (
              <div className="bg-cyan-50/60 p-4 rounded-xl border border-cyan-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-cyan-700" />
                    <span className="font-bold text-xs text-cyan-900">
                      Cold-Chain IoT Continuous Feed (2°C - 8°C Requirement)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Normative
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 overflow-x-auto">
                  {detailShipment.temperature_log.map((temp, i) => (
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

            {/* Milestones History Timeline */}
            <div>
              <h4 className="font-bold text-xs text-slate-900 mb-3 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Custody Handoff History & Operational Milestones
              </h4>

              <div className="space-y-2.5">
                {detailShipment.milestones && detailShipment.milestones.length > 0 ? (
                  detailShipment.milestones.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                        m.status === 'completed'
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : m.status === 'current'
                          ? 'bg-blue-50/70 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            m.status === 'completed'
                              ? 'bg-emerald-600 text-white'
                              : m.status === 'current'
                              ? 'bg-blue-600 text-white animate-pulse'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          {m.status === 'completed' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <span className="text-[9px] font-bold">{idx + 1}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{m.stage}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5">{m.location}</p>
                          {m.note && (
                            <p className="text-[11px] text-emerald-950 bg-emerald-100/80 border border-emerald-300/70 px-2 py-1 rounded-md font-medium mt-1 leading-snug">
                              💬 Update Note: &quot;{m.note}&quot;
                            </p>
                          )}
                          {m.temperature && (
                            <span className="inline-block mt-1 text-[10px] text-cyan-700 bg-cyan-100 px-1.5 py-0.2 rounded font-mono">
                              Temp: {m.temperature}°C
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(m.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
                    <p className="font-semibold">Shipment registered at dispatch dock.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tracking note: {detailShipment.tracking_note || 'Order packaging initialized.'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Anchored Transaction Hash */}
            {detailShipment.blockchain_tx_hash && (
              <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between gap-3 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Anchored Transaction Hash</span>
                  <p className="text-xs text-emerald-400 break-all">{detailShipment.blockchain_tx_hash}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Dispatch Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Dispatch New Supply Chain Shipment"
        subtitle="Initiate transport movement with GPS tracking & IoT telemetry"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Drug Formulation</label>
            <select
              value={newShipment.drug_id as string}
              onChange={(e) => setNewShipment({ ...newShipment, drug_id: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
              required
            >
              {drugs.map((d) => (
                <option key={d._id || d.drug_id} value={d.drug_id}>
                  {d.drug_id} • {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Origin Facility</label>
              <input
                type="text"
                required
                value={newShipment.origin_id}
                onChange={(e) => setNewShipment({ ...newShipment, origin_id: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Destination Facility</label>
              <input
                type="text"
                required
                value={newShipment.destination_id}
                onChange={(e) => setNewShipment({ ...newShipment, destination_id: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quantity (Units)</label>
              <input
                type="number"
                min={50}
                value={newShipment.quantity}
                onChange={(e) => setNewShipment({ ...newShipment, quantity: Number(e.target.value) })}
                className="w-full p-2.5 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Carrier / Truck Fleet</label>
              <input
                type="text"
                value={newShipment.carrier_name}
                onChange={(e) => setNewShipment({ ...newShipment, carrier_name: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Dispatch Shipment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update Shipment Transit Status"
        subtitle={`Shipment: ${selectedShipment?.shipment_id}`}
        maxWidth="sm"
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Logistics Status</label>
            <select
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value as ShipmentStatus)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
            >
              <option value="preparing">Preparing at Dock</option>
              <option value="dispatched">Dispatched</option>
              <option value="in_transit">In Transit (Highway Corridor)</option>
              <option value="delayed">Delayed (Traffic / Inspection)</option>
              <option value="delivered">Delivered (Move to Available Stock)</option>
              <option value="received">Received (Verification Complete)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Status / GPS Note</label>
            <textarea
              rows={2}
              value={trackingNote}
              onChange={(e) => setTrackingNote(e.target.value)}
              placeholder="e.g. Cleared toll plaza; cold chain steady at 4.2°C..."
              className="w-full p-2.5 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Status
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
