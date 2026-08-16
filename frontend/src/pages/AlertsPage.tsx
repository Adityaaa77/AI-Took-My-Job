// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Real-Time Incident & Alert Triage Center
// ============================================================================

import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Bell,
  ThermometerSnowflake,
  Boxes,
} from 'lucide-react';
import { useAlerts } from '../context/AlertContext';
import type { Alert, SeverityLevel } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { StatCard } from '../components/ui/StatCard';
import { Modal } from '../components/ui/Modal';

export const AlertsPage: React.FC = () => {
  const { alerts, unresolvedAlerts, criticalCount, resolveAlert } = useAlerts();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;

    await resolveAlert(selectedAlert._id || selectedAlert.alert_id || '', resolutionNotes);
    setResolveModalOpen(false);
    setResolutionNotes('');
    setToastMessage('Alert incident marked as resolved and action recorded in audit log.');
  };

  const filteredAlerts = alerts.filter((a) => {
    const msg = a.message.toLowerCase();
    const type = a.alert_type.toLowerCase();
    const loc = (a.location_id || '').toLowerCase();

    const matchesSearch =
      msg.includes(searchQuery.toLowerCase()) ||
      type.includes(searchQuery.toLowerCase()) ||
      loc.includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'unresolved' && !a.is_resolved) ||
      (statusFilter === 'resolved' && a.is_resolved);

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical_stock':
      case 'low_stock':
        return <Boxes className="h-4 w-4 text-rose-600" />;
      case 'temperature_excursion':
      case 'quality_issue':
        return <ThermometerSnowflake className="h-4 w-4 text-amber-600" />;
      case 'unusual_consumption':
        return <AlertTriangle className="h-4 w-4 text-purple-600" />;
      default:
        return <ShieldAlert className="h-4 w-4 text-blue-600" />;
    }
  };

  const columns: Column<Alert>[] = [
    {
      header: 'Incident Alert & Location',
      accessor: (a) => (
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-lg bg-slate-100 mt-0.5 shrink-0">{getAlertIcon(a.alert_type)}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900 font-mono">
                {a.alert_id || a._id?.slice(-8)}
              </span>
              {a.location_id && (
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                  {a.location_id}
                </span>
              )}
            </div>
            <p className="font-semibold text-xs text-slate-800 mt-1 leading-snug">{a.message}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Logged: {new Date(a.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Severity',
      accessor: (a) => (
        <Badge
          variant={a.severity === 'critical' ? 'critical' : a.severity === 'high' ? 'danger' : 'warning'}
          size="sm"
          dot
        >
          {(a.severity as SeverityLevel).toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Status',
      accessor: (a) =>
        a.is_resolved ? (
          <div>
            <Badge variant="success" size="sm" dot>
              RESOLVED
            </Badge>
            {a.resolution_notes && (
              <p className="text-[10px] text-slate-500 mt-0.5 max-w-xs truncate">{a.resolution_notes}</p>
            )}
          </div>
        ) : (
          <Badge variant="critical" size="sm" dot>
            ACTIVE UNRESOLVED
          </Badge>
        ),
    },
    {
      header: 'Actions',
      accessor: (a) =>
        !a.is_resolved ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedAlert(a);
              setResolutionNotes('');
              setResolveModalOpen(true);
            }}
          >
            Resolve Incident
          </Button>
        ) : (
          <span className="text-[11px] text-slate-400 font-mono">Completed</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Unresolved Incidents"
          value={unresolvedAlerts.length}
          icon={<ShieldAlert className="h-5 w-5" />}
          subtitle="Awaiting operator resolution"
          color="rose"
        />
        <StatCard
          title="Critical Severity"
          value={criticalCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          subtitle="Immediate response required"
          trend={{ value: `${criticalCount} urgent`, isPositive: false }}
          color="rose"
        />
        <StatCard
          title="Total Historical Alerts"
          value={alerts.length}
          icon={<Bell className="h-5 w-5" />}
          subtitle="All system incident events"
          color="blue"
        />
        <StatCard
          title="Resolved Incidents"
          value={alerts.filter((a) => a.is_resolved).length}
          icon={<CheckCircle2 className="h-5 w-5" />}
          subtitle="Successfully mitigated"
          color="emerald"
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

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search alerts by keyword, location, or code..."
            className="w-full sm:w-80"
          />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="unresolved">Active Only</option>
            <option value="resolved">Resolved Only</option>
            <option value="all">All Statuses</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <Card>
        <CardHeader
          title="National Drug Supply Chain Incident Feed"
          subtitle={`Showing ${filteredAlerts.length} filtered incident alerts`}
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredAlerts}
            emptyMessage="No alerts found matching search criteria."
          />
        </CardBody>
      </Card>

      {/* Resolve Incident Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Resolve Incident Alert"
        subtitle={`Incident: ${selectedAlert?.alert_id || selectedAlert?._id}`}
        maxWidth="md"
      >
        <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="font-semibold text-slate-800">{selectedAlert?.message}</p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Mitigation & Resolution Notes</label>
            <textarea
              rows={3}
              required
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="e.g. Emergency replenishment dispatched from Central Hub; ward stock restored to safety baseline..."
              className="w-full p-2.5 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setResolveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Confirm Resolution
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
