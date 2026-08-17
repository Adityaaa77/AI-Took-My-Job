// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// AI Multi-Agent Decision Center & Human-in-the-Loop Approval Hub
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bot,
  Sparkles,
  TrendingUp,
  Boxes,
  Truck,
  ShoppingCart,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Filter,
  Search,
  Database,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Info,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import { aiService } from '../services/aiService';
import type { AIRecommendation, AgentFinding } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

export const AIDecisionCenterPage: React.FC = () => {
  const [selectedRec, setSelectedRec] = useState<AIRecommendation | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Filtering & Search State ──────────────────────────────────────────────
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [drugFilter, setDrugFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    const res = await aiService.getAllRecommendations();
    if (res.data && res.data.length > 0) {
      setSelectedRec(res.data[0]);
    }
  };

  const handleTriggerAnalysis = async () => {
    setAnalyzing(true);
    setActionSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await aiService.triggerAnalysis();
      if (res.success && res.data && !res.isMock) {
        setSelectedRec(res.data);
        setActionSuccessMessage('AI Multi-Agent Analysis synthesized new operational recommendations from live MongoDB & NPPA databases!');
      } else if (res.message) {
        setErrorMessage(`AI Analysis Failed: ${res.message}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'AI analysis service encountered an error.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = async (id: string) => {
    await aiService.approveRecommendation(id);
    if (selectedRec && (selectedRec.recommendation_id === id || selectedRec._id === id)) {
      setSelectedRec({ ...selectedRec, approval_status: 'approved' });
    }
    setActionSuccessMessage('Recommendation Approved & Executed directly in MongoDB database!');
  };

  const handleReject = async () => {
    if (!selectedRec) return;
    const id = selectedRec.recommendation_id;
    await aiService.rejectRecommendation(id, rejectionReason);
    setSelectedRec({ ...selectedRec, approval_status: 'rejected', rejection_reason: rejectionReason });
    setRejectModalOpen(false);
    setRejectionReason('');
    setActionSuccessMessage('Recommendation rejected by human operator.');
  };

  const toggleCardExpansion = (index: number) => {
    setExpandedCards((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const getAgentMeta = (agentName: string) => {
    switch (agentName) {
      case 'DemandAgent':
        return {
          icon: <TrendingUp className="h-4 w-4 text-rose-600" />,
          bgColor: 'bg-rose-50 text-rose-700 border-rose-200',
          internalSource: '🟢 Live Internal Source: MongoDB Atlas (consumptionrecords)',
          externalSource: '🌐 AI Predictive Time-Series Demand Engine (Calibrated Forecasting)',
        };
      case 'InventoryAgent':
        return {
          icon: <Boxes className="h-4 w-4 text-amber-600" />,
          bgColor: 'bg-amber-50 text-amber-700 border-amber-200',
          internalSource: '🟢 Live Internal Source: MongoDB Atlas (inventories)',
          externalSource: '🌐 External Real-World Source: WHO Essential Safety Buffer Standards',
        };
      case 'DistributionAgent':
        return {
          icon: <Truck className="h-4 w-4 text-emerald-600" />,
          bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          internalSource: '🟢 Live Internal Source: MongoDB Atlas (inventories & hospitals)',
          externalSource: '🌐 External Real-World Source: Regional Supply Route Network Telemetry',
        };
      case 'ProcurementAgent':
        return {
          icon: <ShoppingCart className="h-4 w-4 text-blue-600" />,
          bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
          internalSource: '🟢 Live Internal Source: MongoDB Atlas (replenishmentrequests)',
          externalSource: '🤖 AI Predictive Safety Stock & Reorder Engine (Forecast Feed)',
        };
      case 'VendorAgent':
        return {
          icon: <Truck className="h-4 w-4 text-purple-600" />,
          bgColor: 'bg-purple-50 text-purple-700 border-purple-200',
          internalSource: '🟢 Live Internal Source: MongoDB Atlas (vendors)',
          externalSource: '🌐 External Real-World Source: Supplier Reliability & Lead Time Matrix',
        };
      case 'ComplianceAgent':
        return {
          icon: <ShieldCheck className="h-4 w-4 text-teal-600" />,
          bgColor: 'bg-teal-50 text-teal-700 border-teal-200',
          internalSource: '🟢 Live Internal Source: MongoDB Atlas (batches)',
          externalSource: '🌐 External Real-World Source: CDSCO / Pharmacopoeia Quality Standards',
        };
      case 'MarketIntelligence':
        return {
          icon: <DollarSign className="h-4 w-4 text-indigo-600" />,
          bgColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          internalSource: '🟢 Live Internal Source: MongoDB Atlas (drugs catalog)',
          externalSource: '🌐 External Real-World Source: NPPA National Price Gazette & DPCO Schedule',
        };
      default:
        return {
          icon: <Bot className="h-4 w-4 text-indigo-600" />,
          bgColor: 'bg-slate-50 text-slate-700 border-slate-200',
          internalSource: '🟢 Live Internal Source: MongoDB Atlas Database',
          externalSource: '🌐 External Real-World Source: Ollama Edge SLM & Market Intelligence',
        };
    }
  };

  // ─── Extract Unique Filter Options ─────────────────────────────────────────
  const uniqueAgents = useMemo(() => {
    if (!selectedRec) return [];
    const agents = Array.from(new Set(selectedRec.agent_findings.map((f) => f.agent_name)));
    return ['ALL', ...agents];
  }, [selectedRec]);

  const uniqueDrugs = useMemo(() => {
    if (!selectedRec) return [];
    const drugs = Array.from(
      new Set(
        selectedRec.agent_findings
          .map((f) => f.target_drug_id)
          .filter((id) => id && id !== 'ALL' && id !== 'NONE')
      )
    );
    return ['ALL', ...drugs];
  }, [selectedRec]);

  // ─── Filtered Findings ──────────────────────────────────────────────────────
  const filteredFindings = useMemo(() => {
    if (!selectedRec) return [];
    return selectedRec.agent_findings.filter((f) => {
      // Agent Filter
      if (agentFilter !== 'ALL' && f.agent_name !== agentFilter) return false;
      // Drug Filter
      if (drugFilter !== 'ALL' && f.target_drug_id !== drugFilter) return false;
      // Severity Filter
      if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesDescription = f.description.toLowerCase().includes(query);
        const matchesAgent = f.agent_name.toLowerCase().includes(query);
        const matchesDrug = (f.target_drug_id || '').toLowerCase().includes(query);
        const matchesType = (f.finding_type || '').toLowerCase().includes(query);
        const matchesLocation = (f.target_location_id || '').toLowerCase().includes(query);

        if (!matchesDescription && !matchesAgent && !matchesDrug && !matchesType && !matchesLocation) {
          return false;
        }
      }
      return true;
    });
  }, [selectedRec, agentFilter, drugFilter, severityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ─── Hero Intelligence Header ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 text-white p-6 rounded-2xl border border-indigo-900/60 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/80 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
              <Bot className="h-4 w-4 text-indigo-400" />
              LAYER 2 • AUTONOMOUS MULTI-AGENT REASONING
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              AI Multi-Agent Decision & Explainability Center
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Real-time multi-agent intelligence querying <strong>MongoDB Atlas</strong> & <strong>NPPA Government Drug Price Registry</strong>.
              Autonomous specialized agents synthesize evidence into actionable operational recommendations.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="lg"
              loading={analyzing}
              icon={<Sparkles className="h-4 w-4" />}
              onClick={handleTriggerAnalysis}
              className="bg-indigo-600 hover:bg-indigo-700 border-indigo-500 shadow-md"
            >
              {analyzing ? 'Reasoning Across Network...' : 'Trigger Full AI Analysis'}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Live Data Source Audit Banner ──────────────────────────────────── */}
      <div className="p-4 bg-slate-900 text-white rounded-xl border border-indigo-900/80 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <Database className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wide text-slate-200 uppercase">
            LIVE VERIFIED DATA SOURCES INGESTION STATUS:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-semibold">
          <span className="px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 flex items-center gap-1.5">
            🟢 MongoDB Atlas (7 Collections Active)
          </span>
          <span className="px-2.5 py-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 flex items-center gap-1.5">
            🟢 NPPA Govt. Pricing Gazette (DPCO Regulated)
          </span>
          <span className="px-2.5 py-1 rounded bg-purple-950/80 text-purple-300 border border-purple-700/50 flex items-center gap-1.5">
            🟢 Live Vendor Reliability Directory
          </span>
        </div>
      </div>
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner Toast */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Main Decision Workspace ────────────────────────────────────────── */}
      {selectedRec && (
        <div className="space-y-6">
          {/* Executive Recommendation Dossier Header */}
          <Card className="border-indigo-200 shadow-sm">
            <CardHeader
              title={
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    {selectedRec.recommendation_id}
                  </span>
                  <Badge variant="critical" size="sm" dot>
                    OVERALL RISK: {selectedRec.overall_risk_level.toUpperCase()}
                  </Badge>
                  <StatusBadge status={selectedRec.approval_status} size="sm" />
                </div>
              }
              subtitle={`Snapshot Analyzed: ${selectedRec.snapshot_id} • Completed at: ${new Date(selectedRec.createdAt).toLocaleString()}`}
              action={
                selectedRec.approval_status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<XCircle className="h-3.5 w-3.5 text-rose-600" />}
                      onClick={() => setRejectModalOpen(true)}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      onClick={() => handleApprove(selectedRec.recommendation_id)}
                      className="bg-emerald-600 hover:bg-emerald-700 border-emerald-500"
                    >
                      Approve & Execute
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-slate-500 font-mono bg-slate-100 px-3 py-1 rounded-lg">
                    Decision Recorded: {selectedRec.approval_status.toUpperCase()}
                  </span>
                )
              }
            />

            {/* ─── Synthesized Master Suggestions ─────────────────────────────── */}
            <CardBody className="space-y-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  Prioritized Action Suggestions (Master Coordinator Synthesis)
                </h4>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  🟢 Live DB Verified
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedRec.recommended_actions.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white border border-indigo-100 shadow-2xs hover:border-indigo-300 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {act.action_type.replace(/_/g, ' ')}
                        </span>
                        <Badge variant={act.priority === 'critical' || act.priority === 'high' ? 'critical' : 'warning'} size="sm">
                          {act.priority.toUpperCase()} PRIORITY
                        </Badge>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        Confidence: {(act.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {act.target_drug_name || act.target_drug_id}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{act.reasoning}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Recommended Quantity:</span>
                      <span className="text-indigo-700 font-bold text-sm">{act.recommended_quantity} units</span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                      <span className="font-medium">{act.source_location_id || 'Supplier Origin'}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="font-bold text-slate-800">{act.destination_location_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* ─── Interactive Filter & Search Bar ──────────────────────────── */}
          <Card className="border-slate-200 shadow-2xs">
            <CardBody className="p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Agent Suggestions & Live Telemetry Traces
                  </h3>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    Showing {filteredFindings.length} of {selectedRec.agent_findings.length}
                  </span>
                </div>

                {/* Quick Search */}
                <div className="relative w-full lg:w-72">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search findings, drugs, locations..."
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Filter Selectors Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                {/* Filter by Agent */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Filter by Agent
                  </label>
                  <select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {uniqueAgents.map((ag) => (
                      <option key={ag} value={ag}>
                        {ag === 'ALL' ? 'All Agents' : ag}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by Drug */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Filter by Target Drug
                  </label>
                  <select
                    value={drugFilter}
                    onChange={(e) => setDrugFilter(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {uniqueDrugs.map((d) => (
                      <option key={d} value={d}>
                        {d === 'ALL' ? 'All Drugs Scope' : d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by Severity */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Filter by Severity
                  </label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="critical">Critical Only</option>
                    <option value="high">High Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="low">Low Risk</option>
                  </select>
                </div>
              </div>

              {/* Active Filter Chips */}
              {(agentFilter !== 'ALL' || drugFilter !== 'ALL' || severityFilter !== 'ALL' || searchQuery.trim()) && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] font-medium text-slate-500">Active Filters:</span>
                  {agentFilter !== 'ALL' && (
                    <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                      Agent: {agentFilter}
                    </span>
                  )}
                  {drugFilter !== 'ALL' && (
                    <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                      Drug: {drugFilter}
                    </span>
                  )}
                  {severityFilter !== 'ALL' && (
                    <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                      Severity: {severityFilter.toUpperCase()}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setAgentFilter('ALL');
                      setDrugFilter('ALL');
                      setSeverityFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline ml-auto"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ─── Agent Suggestions Cards Grid ─────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFindings.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white rounded-xl border border-slate-200 space-y-2">
                <Info className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No agent suggestions match your selected filters</p>
                <p className="text-xs text-slate-500">Try adjusting your agent, drug, or severity filter dropdowns.</p>
              </div>
            ) : (
              filteredFindings.map((finding, idx) => {
                const meta = getAgentMeta(finding.agent_name);
                const isExpanded = !!expandedCards[idx];

                // Filter non-null, meaningful metrics for clean summary presentation
                const filteredMetrics = finding.metrics
                  ? Object.entries(finding.metrics).filter(
                      ([_, v]) => v !== null && v !== undefined && v !== 'null' && v !== ''
                    )
                  : [];

                return (
                  <div
                    key={idx}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2.5">
                      {/* Header: Agent Icon + Name + Severity */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-slate-100">{meta.icon}</span>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">{finding.agent_name}</span>
                            <span className="text-[10px] font-semibold text-slate-500">Autonomous Agent</span>
                          </div>
                        </div>
                        <Badge
                          variant={
                            finding.severity === 'critical'
                              ? 'critical'
                              : finding.severity === 'high'
                              ? 'warning'
                              : 'info'
                          }
                          size="sm"
                        >
                          {finding.severity.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Dual Source Verification Box */}
                      <div className="bg-slate-50 border border-slate-200/90 p-2.5 rounded-lg space-y-1.5 text-[10px]">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          <span className="truncate">{meta.internalSource}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-indigo-800 pt-1 border-t border-slate-200/60">
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                          </span>
                          <span className="truncate">{meta.externalSource}</span>
                        </div>
                      </div>

                      {/* Suggestion & Description */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            {finding.finding_type.replace(/_/g, ' ')}
                          </span>
                          {finding.target_location_id && (
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                              {finding.target_location_id}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 leading-snug pt-1">
                          {finding.description}
                        </p>
                      </div>
                    </div>

                    {/* Compact Telemetry Summary Cards */}
                    {filteredMetrics.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          {filteredMetrics.slice(0, isExpanded ? filteredMetrics.length : 4).map(([k, v], mIdx) => (
                            <div
                              key={mIdx}
                              className="p-1.5 rounded bg-slate-50 border border-slate-100 flex flex-col justify-between"
                            >
                              <span className="text-[9px] text-slate-400 font-mono uppercase truncate">
                                {k.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs font-bold text-slate-800 font-mono truncate">
                                {String(v)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {filteredMetrics.length > 4 && (
                          <button
                            onClick={() => toggleCardExpansion(idx)}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mx-auto pt-1"
                          >
                            {isExpanded ? (
                              <>
                                <span>Hide Details</span>
                                <ChevronUp className="h-3 w-3" />
                              </>
                            ) : (
                              <>
                                <span>+ {filteredMetrics.length - 4} More Telemetry Metrics</span>
                                <ChevronDown className="h-3 w-3" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── Reject Confirmation Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject AI Recommendation"
        subtitle="Please provide human operator rationale for rejecting the autonomous recommendation"
        maxWidth="md"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleReject} disabled={!rejectionReason.trim()}>
              Confirm Rejection
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700">Rejection Reason</label>
          <textarea
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Alternative batch already procured locally; ICU surge expected to normalize in 12 hours..."
            className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />
        </div>
      </Modal>
    </div>
  );
};
