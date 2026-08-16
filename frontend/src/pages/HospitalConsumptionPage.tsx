// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Hospital Drug Consumption & Real-Time Anomaly Analytics
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Plus,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { consumptionService } from '../services/consumptionService';
import { drugService } from '../services/drugService';
import { networkService } from '../services/networkService';
import { inventoryService } from '../services/inventoryService';
import type { ConsumptionRecord, Drug, Hospital, InventoryItem } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';

export const HospitalConsumptionPage: React.FC = () => {
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedHospital, setSelectedHospital] = useState('HOSP-001');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalType, setErrorModalType] = useState<'stock' | 'auth'>('stock');
  const [stockErrorMsg, setStockErrorMsg] = useState('');
  const [stockDetails, setStockDetails] = useState<{ requested: number; available: number; drugName: string; facilityId: string } | null>(null);

  const [newRecord, setNewRecord] = useState<Partial<ConsumptionRecord>>({
    hospital_id: 'HOSP-001',
    drug_id: '',
    quantity_consumed: 50,
    daily_avg_consumption: 50,
    is_anomaly: false,
    notes: 'ICU surgical ward consumption log.',
  });

  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [cRes, dRes, hRes, invRes] = await Promise.all([
      consumptionService.getAllConsumption(),
      drugService.getAllDrugs(),
      networkService.getAllHospitals(),
      inventoryService.getAllInventory(),
    ]);

    if (cRes.data) setRecords(cRes.data);
    if (dRes.data) setDrugs(dRes.data);
    if (hRes.data) setHospitals(hRes.data);
    if (invRes.data) setInventory(invRes.data);
    setLoading(false);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.drug_id) return;

    const targetHosp = String(newRecord.hospital_id || 'HOSP-001').split(' ')[0].trim();
    const targetDrugCode = typeof newRecord.drug_id === 'string' ? newRecord.drug_id : newRecord.drug_id?.drug_id;
    const reqQty = Number(newRecord.quantity_consumed || 0);

    // Pre-check available stock from inventory records
    const invItem = inventory.find(
      (i) =>
        i.location_id.toLowerCase() === targetHosp.toLowerCase() &&
        (typeof i.drug_id === 'string'
          ? i.drug_id === targetDrugCode
          : i.drug_id._id === targetDrugCode || i.drug_id.drug_id === targetDrugCode)
    );

    const avail = invItem ? invItem.available_stock : 0;
    const drugName = invItem?.drug_id?.name || targetDrugCode || 'Selected Drug Formulation';

    if (invItem && avail < reqQty) {
      setRecordModalOpen(false);
      setErrorModalType('stock');
      setStockDetails({
        requested: reqQty,
        available: avail,
        drugName,
        facilityId: targetHosp,
      });
      setStockErrorMsg(
        `Insufficient available stock at facility '${targetHosp}' for '${drugName}'. Current stock: ${avail} units, Requested: ${reqQty} units.`
      );
      setErrorModalOpen(true);
      return;
    }

    const res = await consumptionService.recordConsumption(newRecord);
    if (res.success) {
      setRecordModalOpen(false);
      setToast({
        message: `Consumption log of ${reqQty} units recorded successfully. Hospital available inventory updated.`,
        isError: false,
      });
      loadData();
    } else {
      setRecordModalOpen(false);
      const isAuthErr =
        res.message?.toLowerCase().includes('permission') ||
        res.message?.toLowerCase().includes('unauthorized') ||
        res.message?.toLowerCase().includes('role') ||
        res.message?.toLowerCase().includes('forbidden');

      if (isAuthErr) {
        setErrorModalType('auth');
        setStockErrorMsg(res.message || 'You do not have permission to perform this action.');
      } else {
        setErrorModalType('stock');
        setStockDetails({
          requested: reqQty,
          available: avail,
          drugName,
          facilityId: targetHosp,
        });
        setStockErrorMsg(res.message || 'Insufficient stock to fulfill consumption log.');
      }
      setErrorModalOpen(true);
    }
  };

  // Generate chart data for trends
  const chartData = [
    { date: 'Aug 10', baseline: 22, actual: 20, drug: 'Propofol' },
    { date: 'Aug 11', baseline: 22, actual: 24, drug: 'Propofol' },
    { date: 'Aug 12', baseline: 22, actual: 21, drug: 'Propofol' },
    { date: 'Aug 13', baseline: 22, actual: 26, drug: 'Propofol' },
    { date: 'Aug 14', baseline: 22, actual: 54, drug: 'Propofol' }, // surge
    { date: 'Aug 15', baseline: 22, actual: 68, drug: 'Propofol' }, // surge peak (+209%)
    { date: 'Aug 16', baseline: 22, actual: 65, drug: 'Propofol' }, // surge
  ];

  const filteredRecords = records.filter((r) => {
    const hosp = r.hospital_id.toLowerCase();
    const drugName =
      typeof r.drug_id === 'string' ? r.drug_id.toLowerCase() : r.drug_id?.name?.toLowerCase() || '';

    const matchesSearch = hosp.includes(searchQuery.toLowerCase()) || drugName.includes(searchQuery.toLowerCase());
    const matchesHosp = selectedHospital === 'all' || r.hospital_id === selectedHospital;

    return matchesSearch && matchesHosp;
  });

  const totalConsumed = records.reduce((acc, r) => acc + r.quantity_consumed, 0);
  const anomalyCount = records.filter((r) => r.is_anomaly).length;

  const columns: Column<ConsumptionRecord>[] = [
    {
      header: 'Recorded Date',
      accessor: (r) => (
        <span className="font-mono text-xs text-slate-800">
          {new Date(r.period_end || r.createdAt || Date.now()).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Hospital Facility',
      accessor: (r) => (
        <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          {r.hospital_id}
        </span>
      ),
    },
    {
      header: 'Drug Formulation',
      accessor: (r) => (
        <div>
          <p className="font-bold text-xs text-slate-900">
            {typeof r.drug_id === 'string' ? r.drug_id : r.drug_id?.name}
          </p>
          <span className="text-[10px] text-slate-400 font-mono">Lot: {r.batch_id || 'BATCH-PRO-112'}</span>
        </div>
      ),
    },
    {
      header: 'Quantity Consumed',
      accessor: (r) => (
        <span className="font-mono font-bold text-xs text-slate-900">
          {r.quantity_consumed.toLocaleString()} units
        </span>
      ),
    },
    {
      header: 'Anomaly Status',
      accessor: (r) =>
        r.is_anomaly ? (
          <div>
            <Badge variant="critical" size="sm" dot>
              SURGE ANOMALY (+209%)
            </Badge>
            {r.anomaly_reason && (
              <p className="text-[10px] text-rose-700 font-medium mt-0.5 max-w-xs">{r.anomaly_reason}</p>
            )}
          </div>
        ) : (
          <Badge variant="neutral" size="sm">
            NORMAL RUN-RATE
          </Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Units Administered"
          value={totalConsumed.toLocaleString()}
          icon={<Activity className="h-5 w-5" />}
          subtitle="Aggregated hospital dispensation"
          color="indigo"
        />
        <StatCard
          title="Anomalous Surges"
          value={anomalyCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          subtitle="Spikes exceeding 2x threshold"
          trend={{ value: `${anomalyCount} flagged`, isPositive: false }}
          color="rose"
        />
        <StatCard
          title="Reporting Hospitals"
          value={hospitals.length}
          icon={<Building2 className="h-5 w-5" />}
          subtitle="100% telemetry synced"
          color="emerald"
        />
        <StatCard
          title="Demand Agent Feed"
          value="Connected"
          icon={<TrendingUp className="h-5 w-5" />}
          subtitle="Real-time predictive forecasting"
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

      {/* ─── Recharts Consumption Trend & Anomaly Chart ─────────────────────── */}
      <Card>
        <CardHeader
          title="Daily Consumption Run-Rate vs. 14-Day Baseline"
          subtitle="AI Demand Agent real-time spike detection for ICU critical formulas (Propofol 1%)"
        />
        <CardBody className="p-4">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="Actual Consumption (Spike)"
                  stroke="#e11d48"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#actualGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="baseline"
                  name="14-Day Expected Baseline"
                  stroke="#059669"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#baselineGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search consumption records..."
            className="w-full sm:w-80"
          />
          <select
            value={selectedHospital}
            onChange={(e) => setSelectedHospital(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="all">All Hospitals</option>
            {hospitals.map((h) => (
              <option key={h.hospital_id} value={h.hospital_id}>
                {h.hospital_id} ({h.name.split(' ')[0]})
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setNewRecord({
              hospital_id: selectedHospital === 'all' ? (hospitals[0]?.hospital_id || 'HOSP-001') : selectedHospital,
              drug_id: drugs[0]?.drug_id || 'DRUG-001',
              quantity_consumed: 50,
              daily_avg_consumption: 50,
              notes: 'ICU surgical intensive care unit log.',
            });
            setRecordModalOpen(true);
          }}
        >
          Record Daily Consumption
        </Button>
      </div>

      {/* Consumption Table */}
      <Card>
        <CardHeader
          title="Institutional Drug Administration Log"
          subtitle={`Showing ${filteredRecords.length} recorded daily consumption entries`}
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredRecords}
            loading={loading}
            emptyMessage="No consumption records found."
          />
        </CardBody>
      </Card>

      {/* System Error & Alert Dialog Box Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title={
          errorModalType === 'auth'
            ? '🔒 Access Denied'
            : '⚠️ Insufficient Inventory Stock Alert'
        }
        subtitle={
          errorModalType === 'auth'
            ? 'Unauthorized Role Action'
            : 'Requested consumption exceeds physical available stock'
        }
        maxWidth="sm"
        footer={
          <Button
            variant={errorModalType === 'auth' ? 'outline' : 'primary'}
            size="md"
            onClick={() => setErrorModalOpen(false)}
          >
            {errorModalType === 'auth' ? 'Dismiss' : 'Dismiss & Adjust Quantity'}
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-3">
            {errorModalType === 'auth' ? (
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-xs">
                {errorModalType === 'auth' ? 'Action Not Allowed' : 'Operation Blocked by System'}
              </p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-rose-800">
                {errorModalType === 'auth'
                  ? 'Not allowed as you are a non-authorized role.'
                  : stockErrorMsg || 'Physical stock balance is insufficient to record this consumption request.'}
              </p>
            </div>
          </div>

          {errorModalType === 'stock' && stockDetails && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Requested Units</span>
                <p className="text-sm font-extrabold text-rose-600 mt-0.5">{stockDetails.requested} units</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Available Stock</span>
                <p className="text-sm font-extrabold text-emerald-700 mt-0.5">{stockDetails.available} units</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Facility Location</span>
                <p className="font-semibold mt-0.5">{stockDetails.facilityId}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Drug Formulation</span>
                <p className="font-semibold mt-0.5">{stockDetails.drugName}</p>
              </div>
            </div>
          )}

          {errorModalType === 'stock' && (
            <p className="text-[11px] text-slate-500 italic border-t border-slate-100 pt-2">
              Note: Stock cannot be reduced below zero. Please adjust your requested consumption to be equal to or less than {stockDetails?.available ?? 0} units.
            </p>
          )}
        </div>
      </Modal>

      {/* Record Consumption Modal */}
      <Modal
        isOpen={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        title="Record Institutional Drug Consumption"
        subtitle="Feeds real-time usage data into Demand & Inventory AI Agents"
        maxWidth="md"
      >
        <form onSubmit={handleRecordSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Hospital Facility</label>
            <select
              value={newRecord.hospital_id}
              onChange={(e) => setNewRecord({ ...newRecord, hospital_id: e.target.value })}
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
            <label className="block font-bold text-slate-700 mb-1">Drug Formulation</label>
            <select
              value={newRecord.drug_id as string}
              onChange={(e) => setNewRecord({ ...newRecord, drug_id: e.target.value })}
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
              <label className="block font-bold text-slate-700 mb-1">Quantity Consumed (Units)</label>
              <input
                type="number"
                min={1}
                value={newRecord.quantity_consumed}
                onChange={(e) =>
                  setNewRecord({
                    ...newRecord,
                    quantity_consumed: Number(e.target.value),
                    daily_avg_consumption: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg font-bold text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Batch Lot Reference</label>
              <input
                type="text"
                value={newRecord.batch_id || 'BATCH-PRO-2026-112'}
                onChange={(e) => setNewRecord({ ...newRecord, batch_id: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Clinical Notes / Ward Context</label>
            <textarea
              rows={2}
              value={newRecord.notes || ''}
              onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
              placeholder="e.g. ICU burn unit expansion; emergency multiple trauma triage..."
              className="w-full p-2.5 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRecordModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Submit Consumption
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
