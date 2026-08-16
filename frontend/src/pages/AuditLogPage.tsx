// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Regulatory Compliance & State Transition Audit Trail
// ============================================================================

import React, { useState, useEffect } from 'react';
import { FileText, Lock } from 'lucide-react';
import { auditService } from '../services/auditService';
import type { AuditLog } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      const res = await auditService.getAllLogs();
      if (res.data) setLogs(res.data);
      setLoading(false);
    }
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const action = l.action.toLowerCase();
    const entity = l.entity_type.toLowerCase();
    let actor = '';
    if (typeof l.performed_by === 'string') {
      actor = l.performed_by.toLowerCase();
    } else if (l.performed_by && typeof l.performed_by === 'object') {
      actor = (l.performed_by.name || '').toLowerCase();
    }

    return (
      action.includes(searchQuery.toLowerCase()) ||
      entity.includes(searchQuery.toLowerCase()) ||
      actor.includes(searchQuery.toLowerCase())
    );
  });

  const columns: Column<AuditLog>[] = [
    {
      header: 'Timestamp',
      accessor: (l) => (
        <span className="font-mono text-xs text-slate-800">
          {new Date(l.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Operational Action',
      accessor: (l) => (
        <Badge variant="purple" size="sm">
          {l.action.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Authorized Actor',
      accessor: (l) => {
        let actorName = 'System';
        let actorRole = 'System';
        if (typeof l.performed_by === 'string') {
          actorName = l.performed_by;
          actorRole = 'User';
        } else if (l.performed_by && typeof l.performed_by === 'object') {
          actorName = l.performed_by.name || 'User';
          actorRole = (l.performed_by.role || 'User').replace(/_/g, ' ');
        }
        return (
          <div>
            <p className="font-bold text-xs text-slate-900">{actorName}</p>
            <span className="text-[10px] text-slate-500 capitalize">{actorRole}</span>
          </div>
        );
      },
    },
    {
      header: 'Target Entity',
      accessor: (l) => (
        <div>
          <span className="font-semibold text-xs text-slate-800">{l.entity_type}</span>
          <p className="text-[10px] font-mono text-slate-400">{l.entity_id}</p>
        </div>
      ),
    },
    {
      header: 'Audit Modification Details',
      accessor: (l) => (
        <div className="text-[11px] font-mono text-slate-600 max-w-sm truncate bg-slate-50 px-2 py-1 rounded border border-slate-100">
          {JSON.stringify(l.changes || {})}
        </div>
      ),
    },
    {
      header: 'Blockchain Cryptography',
      accessor: (l) =>
        l.blockchain_tx_hash ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <Lock className="h-3 w-3" />
            Anchored
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 font-mono">App Layer</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
            <FileText className="h-4 w-4" />
            REGULATORY COMPLIANCE AUDIT TRAIL
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Immutable Activity & Compliance Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Append-only record of all stock movements, human-in-the-loop AI approvals, purchase orders, and QA quarantine actions.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter by action, actor, or entity..."
          className="w-full sm:w-80"
        />
        <span className="text-xs text-slate-500 font-medium">
          {filteredLogs.length} Audit Events Recorded
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardHeader
          title="System Audit Log Entries"
          subtitle="Non-repudiable history of system-wide operations"
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredLogs}
            loading={loading}
            emptyMessage="No audit logs matching search query."
          />
        </CardBody>
      </Card>
    </div>
  );
};
