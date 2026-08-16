// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Shipment Logistics & In-Transit Custody Management
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Truck, Plus, CheckCircle2, Thermometer } from 'lucide-react';
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
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [updateStatus, setUpdateStatus] = useState<ShipmentStatus>('in_transit');
  const [trackingNote, setTrackingNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

    await shipmentService.createShipment(newShipment);
    setCreateModalOpen(false);
    setToastMessage('New logistics shipment created and registered for dispatch.');
    loadData();
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    await shipmentService.updateShipmentStatus(
      selectedShipment.shipment_id,
      updateStatus,
      trackingNote
    );
    setStatusModalOpen(false);
    setToastMessage(`Shipment ${selectedShipment.shipment_id} status updated to ${updateStatus.toUpperCase()}.`);
    loadData();
  };

  const filteredShipments = shipments.filter((s) => {
    const shipmentId = s.shipment_id.toLowerCase();
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
          <span className="font-mono font-bold text-xs text-slate-900">{s.shipment_id}</span>
          <p className="text-xs text-slate-700 font-semibold mt-0.5">{s.carrier_name || 'Fleet Truck'}</p>
          <span className="text-[10px] text-slate-400 font-mono">Trk: {s.tracking_number}</span>
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
          value={shipments.filter((s) => s.status === 'in_transit').length}
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
          value={shipments.filter((s) => s.status === 'delivered').length}
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

      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 underline">
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
            <option value="delayed">Delayed</option>
          </select>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setNewShipment({
              drug_id: drugs[0]?.drug_id || 'DRUG-001',
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
          subtitle={`Tracking ${filteredShipments.length} live and historic movements`}
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
                <option key={d.drug_id} value={d.drug_id}>
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
