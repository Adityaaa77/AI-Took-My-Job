// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Hospital Replenishment & Allocation Requisition Desk
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Building2, Plus, CheckCircle2, ShieldAlert } from 'lucide-react';
import { replenishmentService } from '../services/replenishmentService';
import { drugService } from '../services/drugService';
import { networkService } from '../services/networkService';
import type { ReplenishmentRequest, Drug, Hospital, ReplenishmentStatus } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { StatusBadge, Badge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';

export const ReplenishmentPage: React.FC = () => {
  const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState<Partial<ReplenishmentRequest>>({
    hospital_id: 'HOSP-001',
    hospital_name: 'AIIMS New Delhi',
    drug_id: '',
    requested_quantity: 400,
    urgency: 'critical',
    reason: 'Stock buffer nearing exhaustion due to surge in daily consumption.',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [rRes, dRes, hRes] = await Promise.all([
      replenishmentService.getAllRequests(),
      drugService.getAllDrugs(),
      networkService.getAllHospitals(),
    ]);
    if (rRes.data) setRequests(rRes.data);
    if (dRes.data) setDrugs(dRes.data);
    if (hRes.data) setHospitals(hRes.data);
    setLoading(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.drug_id) return;

    await replenishmentService.createRequest(newRequest);
    setCreateModalOpen(false);
    setToastMessage('Emergency replenishment requisition submitted to Central Supply Command.');
    loadData();
  };

  const handleStatusUpdate = async (id: string, status: ReplenishmentStatus) => {
    await replenishmentService.updateRequestStatus(id, status, 'WH-001 (CMSS North)');
    setToastMessage(`Requisition ${id} status updated to ${status.toUpperCase()}.`);
    loadData();
  };

  const filteredRequests = requests.filter((r) => {
    const reqId = r.request_id.toLowerCase();
    const hosp = r.hospital_name?.toLowerCase() || r.hospital_id.toLowerCase();
    const drugName =
      typeof r.drug_id === 'string' ? r.drug_id.toLowerCase() : r.drug_id?.name?.toLowerCase() || '';

    const matchesSearch =
      reqId.includes(searchQuery.toLowerCase()) ||
      hosp.includes(searchQuery.toLowerCase()) ||
      drugName.includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns: Column<ReplenishmentRequest>[] = [
    {
      header: 'Requisition ID',
      accessor: (r) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">{r.request_id}</span>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            {new Date(r.createdAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      header: 'Hospital Institution',
      accessor: (r) => (
        <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          {r.hospital_name || r.hospital_id}
        </span>
      ),
    },
    {
      header: 'Requested Drug & Qty',
      accessor: (r) => (
        <div>
          <p className="font-bold text-xs text-slate-900">
            {typeof r.drug_id === 'string' ? r.drug_id : r.drug_id?.name}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">
            {r.requested_quantity.toLocaleString()} units requested
          </span>
        </div>
      ),
    },
    {
      header: 'Urgency Rating',
      accessor: (r) => (
        <Badge
          variant={r.urgency === 'critical' ? 'critical' : r.urgency === 'urgent' ? 'warning' : 'neutral'}
          size="sm"
          dot
        >
          {r.urgency.toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Allocation Source',
      accessor: (r) => (
        <span className="text-xs text-slate-600 font-medium">
          {r.allocated_from || 'Pending Assignment'}
        </span>
      ),
    },
    {
      header: 'Requisition Status',
      accessor: (r) => <StatusBadge status={r.status} size="sm" />,
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="flex items-center gap-1.5">
          {r.status === 'pending' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStatusUpdate(r.request_id, 'approved')}
            >
              Approve
            </Button>
          )}
          {r.status === 'approved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusUpdate(r.request_id, 'allocated')}
            >
              Allocate
            </Button>
          )}
          {r.status === 'allocated' && (
            <Button
              variant="success"
              size="sm"
              onClick={() => handleStatusUpdate(r.request_id, 'dispatched')}
            >
              Dispatch
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Requests"
          value={requests.filter((r) => r.status === 'pending').length}
          icon={<Building2 className="h-5 w-5" />}
          subtitle="Hospital requisitions in queue"
          color="amber"
        />
        <StatCard
          title="Allocated Reserves"
          value={requests.filter((r) => r.status === 'allocated').length}
          icon={<CheckCircle2 className="h-5 w-5" />}
          subtitle="Assigned from central hubs"
          color="blue"
        />
        <StatCard
          title="Dispatched Transfers"
          value={requests.filter((r) => r.status === 'dispatched').length}
          icon={<Building2 className="h-5 w-5" />}
          subtitle="En route to hospital wards"
          color="cyan"
        />
        <StatCard
          title="Critical Urgency"
          value={requests.filter((r) => r.urgency === 'critical').length}
          icon={<ShieldAlert className="h-5 w-5" />}
          subtitle="Priority emergency allocations"
          color="rose"
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
            placeholder="Search replenishment requisitions..."
            className="w-full sm:w-80"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="all">All Requisition Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="allocated">Allocated</option>
            <option value="dispatched">Dispatched</option>
          </select>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setNewRequest({
              hospital_id: 'HOSP-001',
              hospital_name: 'AIIMS New Delhi',
              drug_id: drugs[1]?.drug_id || 'DRUG-002',
              requested_quantity: 300,
              urgency: 'critical',
              reason: 'Stockout imminent due to emergency ICU bed surge.',
            });
            setCreateModalOpen(true);
          }}
        >
          Submit Replenishment Request
        </Button>
      </div>

      {/* Replenishment Table */}
      <Card>
        <CardHeader
          title="Hospital Requisition & Replenishment Queue"
          subtitle={`Managing ${filteredRequests.length} hospital replenishment workflows`}
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredRequests}
            loading={loading}
            emptyMessage="No replenishment requests found."
          />
        </CardBody>
      </Card>

      {/* Submit Requisition Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Submit Hospital Replenishment Requisition"
        subtitle="Request emergency drug allocation from Central Medical Warehouses or Regional Surpluses"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Hospital Facility</label>
            <select
              value={newRequest.hospital_id}
              onChange={(e) => {
                const found = hospitals.find((h) => h.hospital_id === e.target.value);
                setNewRequest({
                  ...newRequest,
                  hospital_id: e.target.value,
                  hospital_name: found?.name || e.target.value,
                });
              }}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
              required
            >
              {hospitals.map((h) => (
                <option key={h.hospital_id} value={h.hospital_id}>
                  {h.hospital_id} • {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Required Drug Formulation</label>
            <select
              value={newRequest.drug_id as string}
              onChange={(e) => setNewRequest({ ...newRequest, drug_id: e.target.value })}
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
              <label className="block font-bold text-slate-700 mb-1">Requested Quantity (Units)</label>
              <input
                type="number"
                min={10}
                value={newRequest.requested_quantity}
                onChange={(e) =>
                  setNewRequest({ ...newRequest, requested_quantity: Number(e.target.value) })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Clinical Urgency Rating</label>
              <select
                value={newRequest.urgency}
                onChange={(e) => setNewRequest({ ...newRequest, urgency: e.target.value as any })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value="standard">Standard Buffer</option>
                <option value="urgent">Urgent (&lt;48 Hours)</option>
                <option value="critical">Critical Emergency (&lt;24 Hours)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Clinical Justification & Ward Reason</label>
            <textarea
              rows={2}
              value={newRequest.reason || ''}
              onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
              placeholder="e.g. ICU burn unit admission spike; current safety buffer exhausted..."
              className="w-full p-2.5 border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Submit Requisition
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
