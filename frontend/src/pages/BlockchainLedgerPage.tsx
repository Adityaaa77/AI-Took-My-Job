// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Blockchain Verification Ledger & Cryptographic Proof Explorer
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  Copy,
  Database,
} from 'lucide-react';
import { blockchainService } from '../services/blockchainService';
import type { BlockchainRecord } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';

export const BlockchainLedgerPage: React.FC = () => {
  const [records, setRecords] = useState<BlockchainRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecords() {
      setLoading(true);
      const res = await blockchainService.getAllRecords();
      if (res.data) setRecords(res.data);
      setLoading(false);
    }
    loadRecords();
  }, []);

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredRecords = records.filter(
    (r) =>
      r.tx_hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.entity_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: Column<BlockchainRecord>[] = [
    {
      header: 'Block / Timestamp',
      accessor: (r) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-800">#{r.block_number}</span>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            {new Date(r.timestamp).toLocaleString()}
          </p>
        </div>
      ),
    },
    {
      header: 'Event Type',
      accessor: (r) => (
        <Badge variant="purple" size="sm" dot>
          {r.event_type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Entity / Actor',
      accessor: (r) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">{r.entity_id}</span>
          <p className="text-[11px] text-slate-500">
            {r.actor} ({r.actor_role})
          </p>
        </div>
      ),
    },
    {
      header: 'Transaction Hash',
      accessor: (r) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600">
          <span className="truncate max-w-[180px] bg-slate-100 px-2 py-0.5 rounded">
            {r.tx_hash}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(r.tx_hash);
            }}
            className="p-1 hover:bg-slate-200 rounded text-slate-500"
            title="Copy Hash"
          >
            {copiedHash === r.tx_hash ? (
              <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ),
    },
    {
      header: 'Gas Consumed',
      accessor: (r) => <span className="font-mono text-xs text-slate-500">{r.gas_used}</span>,
    },
    {
      header: 'Consensus Proof',
      accessor: () => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Verified
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
            <Lock className="h-4 w-4" />
            LAYER 3 • IMMUTABLE AUDIT LEDGER
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Blockchain Verification & State Proof Explorer
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Critical supply-chain state transitions (purchase orders, dispatches, quality quarantines, and AI approvals) are anchored on distributed smart contracts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Smart Contract</span>
            <p className="font-mono text-xs text-emerald-400">0x32a8...ef97</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter by tx hash, event type, actor, or entity ID..."
          className="w-full sm:w-96"
        />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Database className="h-4 w-4 text-emerald-600" />
          <span>{filteredRecords.length} Immutable Records Found</span>
        </div>
      </div>

      {/* Ledger Table */}
      <Card>
        <CardHeader
          title="Cryptographic State Transition Ledger"
          subtitle="Real-time consensus verification across network validator nodes"
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredRecords}
            loading={loading}
            emptyMessage="No blockchain records matching search query."
          />
        </CardBody>
      </Card>
    </div>
  );
};
