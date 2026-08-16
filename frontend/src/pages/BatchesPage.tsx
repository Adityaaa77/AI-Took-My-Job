// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Batch Quality & Shelf-Life Lifecycle Management
// ============================================================================

import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import type { Batch, QualityStatus } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';

export const BatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [qaModalOpen, setQaModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<QualityStatus>('passed');
  const [qaNotes, setQaNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const getDaysUntilExpiry = (expiryDateStr: string) => {
    const exp = new Date(expiryDateStr).getTime();
    const now = new Date('2026-08-16').getTime();
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  };

  const columns: Column<Batch>[] = [
    {
      header: 'Batch ID / Manufacturer',
      accessor: (b) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">{b.batch_id}</span>
          <p className="text-xs text-slate-700 font-semibold mt-0.5">
            {typeof b.drug_id === 'string' ? b.drug_id : b.drug_id?.name}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Mfg: {b.manufacturer}</span>
        </div>
      ),
    },
    {
      header: 'Location',
      accessor: (b) => <span className="font-semibold text-xs text-slate-800">{b.location_id}</span>,
    },
    {
      header: 'Quantity in Lot',
      accessor: (b) => (
        <span className="font-mono font-bold text-xs text-slate-900">{b.quantity.toLocaleString()} units</span>
      ),
    },
    {
      header: 'Expiry Timeline',
      accessor: (b) => {
        const days = getDaysUntilExpiry(b.expiry_date);
        return (
          <div>
            <span className="text-xs font-mono text-slate-800">{b.expiry_date}</span>
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
                <span className="text-[11px] text-emerald-700 font-semibold">{days} days remaining</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Quality Status',
      accessor: (b) => <StatusBadge status={b.quality_status} size="sm" />,
    },
    {
      header: 'Actions',
      accessor: (b) => (
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

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by batch number or manufacturer..."
            className="w-full sm:w-80"
          />
          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="all">All Quality Statuses</option>
            <option value="passed">Passed Inspection</option>
            <option value="quarantine">Quarantine / QA Hold</option>
            <option value="failed">Failed / Recall</option>
          </select>
        </div>
      </div>

      {/* Batches Table */}
      <Card>
        <CardHeader
          title="Manufacturing Lot & Expiry Control Registry"
          subtitle={`Showing ${filteredBatches.length} batch lots across institutions`}
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredBatches}
            loading={loading}
            emptyMessage="No batch lots found matching search filters."
          />
        </CardBody>
      </Card>

      {/* QA Inspection Modal */}
      <Modal
        isOpen={qaModalOpen}
        onClose={() => setQaModalOpen(false)}
        title="Quality & Regulatory Inspection Review"
        subtitle={`Inspecting Batch: ${selectedBatch?.batch_id}`}
        maxWidth="md"
      >
        <form onSubmit={handleQaSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Quality Release Determination</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as QualityStatus)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
            >
              <option value="passed">PASSED (Release for Dispensation)</option>
              <option value="quarantine">QUARANTINE (Hold for Secondary Testing)</option>
              <option value="failed">FAILED (Flag for Regulatory Recall)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Inspection & Assay Notes</label>
            <textarea
              rows={3}
              value={qaNotes}
              onChange={(e) => setQaNotes(e.target.value)}
              placeholder="e.g. Verified cold chain integrity logs; visual particulate check satisfactory..."
              className="w-full p-2.5 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setQaModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save QA Status
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
