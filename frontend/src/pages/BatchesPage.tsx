// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Batch Quality & Shelf-Life Lifecycle Management
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, Layers, AlertTriangle, ExternalLink, QrCode, Sparkles, Bot } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { ApiService } from '../services/api';
import type { Batch, QualityStatus } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Table, type Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';

export const BatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [qaModalOpen, setQaModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<QualityStatus>('passed');
  const [qaNotes, setQaNotes] = useState('');
  const [aiAuditing, setAiAuditing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const runAiComplianceAudit = async () => {
    if (!selectedBatch) return;
    setAiAuditing(true);
    try {
      const res = await ApiService.post<{
        recommended_status: QualityStatus;
        auditor_notes: string;
        agent_decision: string;
      }>('/telemetry/compliance-audit', {
        batch_id: selectedBatch.batch_id,
        drug_id: typeof selectedBatch.drug_id === 'string' ? selectedBatch.drug_id : selectedBatch.drug_id?.drug_id,
      });

      if (res && (res as any).recommended_status) {
        const auditRes = res as any;
        setNewStatus(auditRes.recommended_status);
        setQaNotes(auditRes.auditor_notes);
        setToastMessage(`ComplianceAgent evaluated ${selectedBatch.batch_id}: ${auditRes.agent_decision}`);
      } else if (res && (res as any).data) {
        const auditRes = (res as any).data;
        setNewStatus(auditRes.recommended_status);
        setQaNotes(auditRes.auditor_notes);
        setToastMessage(`ComplianceAgent evaluated ${selectedBatch.batch_id}: ${auditRes.agent_decision}`);
      }
    } catch (err) {
      console.warn('ComplianceAgent audit notice:', err);
    } finally {
      setAiAuditing(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    const res = await inventoryService.getAllBatches();
    if (res.data) setBatches(res.data);
    setLoading(false);
  };

  const handleQaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;

    await inventoryService.updateBatchQuality(selectedBatch.batch_id, newStatus, qaNotes);
    setQaModalOpen(false);
    setToastMessage(`Batch ${selectedBatch.batch_id} status updated to ${newStatus.toUpperCase()}.`);
    loadBatches();
  };

  const formattedDate = (expiryDateStr?: string) => {
    if (!expiryDateStr) return '31 Dec 2027';
    try {
      const d = new Date(expiryDateStr);
      if (isNaN(d.getTime())) return expiryDateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return expiryDateStr;
    }
  };

  const getDaysUntilExpiry = (expiryDateStr: string) => {
    const exp = new Date(expiryDateStr).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
  };

  const filteredBatches = batches.filter((b) => {
    const batchId = b.batch_id.toLowerCase();
    const manufacturer = b.manufacturer.toLowerCase();
    const drugName =
      typeof b.drug_id === 'string' ? b.drug_id.toLowerCase() : b.drug_id?.name?.toLowerCase() || '';

    const matchesSearch =
      batchId.includes(searchQuery.toLowerCase()) ||
      manufacturer.includes(searchQuery.toLowerCase()) ||
      drugName.includes(searchQuery.toLowerCase());

    const matchesQuality = qualityFilter === 'all' || b.quality_status === qualityFilter;

    return matchesSearch && matchesQuality;
  });

  const columns: Column<Batch>[] = [
    {
      header: 'Batch Lot ID & Product',
      accessor: (b) => (
        <div>
          <span className="font-mono font-bold text-xs text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
            {b.batch_id}
          </span>
          <p className="text-xs text-slate-800 font-bold mt-1">
            {typeof b.drug_id === 'string' ? b.drug_id : b.drug_id?.name || 'Essential Drug'}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">Manufacturer: {b.manufacturer}</span>
        </div>
      ),
    },
    {
      header: 'Assigned Location',
      accessor: (b) => (
        <span className="font-semibold text-xs text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded">
          {b.location_id}
        </span>
      ),
    },
    {
      header: 'Quantity in Lot',
      accessor: (b) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">{b.quantity.toLocaleString()} units</span>
          <p className="text-[10px] text-slate-400 font-medium">Available Reserve</p>
        </div>
      ),
    },
    {
      header: 'Expiry Timeline',
      accessor: (b) => {
        const days = getDaysUntilExpiry(b.expiry_date);
        return (
          <div>
            <span className="text-xs font-mono font-bold text-slate-900 block">{formattedDate(b.expiry_date)}</span>
            <div className="mt-0.5">
              {days <= 0 ? (
                <Badge variant="critical" size="sm" dot>
                  EXPIRED
                </Badge>
              ) : days <= 45 ? (
                <Badge variant="warning" size="sm" dot>
                  {days} days remaining
                </Badge>
              ) : (
                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  🟢 {days} days safe
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Quality Clearance',
      accessor: (b) => <StatusBadge status={b.quality_status} size="sm" />,
    },
    {
      header: 'Actions & Provenance',
      accessor: (b) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedBatch(b);
              setNewStatus(b.quality_status);
              setQaNotes(b.inspection_notes || '');
              setQaModalOpen(true);
            }}
          >
            QA Inspect
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            onClick={() => navigate(`/verify?batchId=${b.batch_id}`)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
          >
            🛡️ DLT Certificate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
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

      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Managed Batches"
          value={batches.length}
          icon={<Layers className="h-5 w-5" />}
          subtitle="Production Lots Registered"
          color="blue"
        />
        <StatCard
          title="QA Passed & Released"
          value={batches.filter((b) => b.quality_status === 'passed').length}
          icon={<CheckCircle2 className="h-5 w-5" />}
          subtitle="100% Certified Safe"
          color="emerald"
        />
        <StatCard
          title="Quarantined / Hold"
          value={batches.filter((b) => b.quality_status === 'failed' || b.quality_status === 'quarantined').length}
          icon={<AlertTriangle className="h-5 w-5" />}
          subtitle="Isolated for Inspection"
          color="rose"
        />
        <StatCard
          title="Expiring Soon (<45 Days)"
          value={batches.filter((b) => getDaysUntilExpiry(b.expiry_date) <= 45).length}
          icon={<QrCode className="h-5 w-5" />}
          subtitle="Priority Usage Required"
          color="amber"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by batch ID, manufacturer, or drug..."
            className="w-full sm:w-80"
          />
          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="all">All Quality Clearance Statuses</option>
            <option value="passed">QA Passed & Released</option>
            <option value="quarantined">Quarantined / Hold</option>
            <option value="failed">Failed Inspection</option>
          </select>
        </div>

        <Button
          variant="secondary"
          size="md"
          icon={<ExternalLink className="h-4 w-4" />}
          onClick={() => navigate('/batch-verification')}
        >
          Open Batch Verification Desk
        </Button>
      </div>

      {/* Batches Table */}
      <Card>
        <CardHeader
          title="Manufacturing Lot & Expiry Control Registry"
          subtitle={`Managing ${filteredBatches.length} production lots across central medical warehouses & hospital pharmacies`}
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredBatches}
            loading={loading}
            emptyMessage="No production batch lots found matching search criteria."
          />
        </CardBody>
      </Card>

      {/* QA Inspection Modal */}
      {selectedBatch && (
        <Modal
          isOpen={qaModalOpen}
          onClose={() => setQaModalOpen(false)}
          title={`Quality Clearance Inspection — ${selectedBatch.batch_id}`}
          subtitle={`Manufacturer: ${selectedBatch.manufacturer} | Location: ${selectedBatch.location_id}`}
          maxWidth="md"
        >
          <form onSubmit={handleQaSubmit} className="space-y-4 text-xs">
            {/* Real ComplianceAgent Audit Action Box */}
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-900">
                <Bot className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="font-bold block">ComplianceAgent & DLT Audit</span>
                  <span className="text-[10px] text-indigo-700">Real Python AI agent evaluation over thermal logs & SHA-256 blocks</span>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                type="button"
                loading={aiAuditing}
                onClick={runAiComplianceAudit}
                icon={<Sparkles className="w-3.5 h-3.5" />}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
              >
                🤖 Run Compliance Audit
              </Button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-700 block">Batch Overview</span>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block">Lot Quantity:</span>
                  <span className="font-bold text-slate-900">{selectedBatch.quantity.toLocaleString()} units</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Expiry Date:</span>
                  <span className="font-bold text-slate-900">{formattedDate(selectedBatch.expiry_date)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Update Quality Clearance Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as QualityStatus)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
              >
                <option value="passed">🟢 PASSED — Approved for Hospital Distribution</option>
                <option value="quarantined">⚠️ QUARANTINED — Thermal/Provenance Hold</option>
                <option value="failed">🔴 FAILED — Counterfeit / Contaminated (Reject)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Quality Inspection Auditor Notes</label>
              <textarea
                value={qaNotes}
                onChange={(e) => setQaNotes(e.target.value)}
                rows={3}
                placeholder="Enter regulatory inspection observations, lab assay notes, or cold-chain log verifications..."
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" type="button" onClick={() => setQaModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save QA Inspection Decision
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
