// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// AI Multi-Agent Decision Center & Human-in-the-Loop Approval Hub
// ============================================================================

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { aiService } from '../services/aiService';
import type { AIRecommendation } from '../types';
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
        setActionSuccessMessage('AI Multi-Agent Analysis synthesized new operational recommendations!');
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
    setActionSuccessMessage('Recommendation Approved by Central Authority! Inter-hospital transfer dispatched and anchored to blockchain.');
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

  const getAgentIcon = (agentName: string) => {
    switch (agentName) {
      case 'DemandAgent':
        return <TrendingUp className="h-4 w-4 text-rose-600" />;
      case 'InventoryAgent':
        return <Boxes className="h-4 w-4 text-amber-600" />;
      case 'DistributionAgent':
        return <Truck className="h-4 w-4 text-emerald-600" />;
      case 'ProcurementAgent':
        return <ShoppingCart className="h-4 w-4 text-blue-600" />;
      case 'ComplianceAgent':
        return <ShieldCheck className="h-4 w-4 text-teal-600" />;
      case 'CoordinatorAgent':
        return <Bot className="h-4 w-4 text-indigo-600" />;
      default:
        return <Sparkles className="h-4 w-4 text-purple-600" />;
    }
  };

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
              Continuous multi-agent reasoning: <strong>SENSE → UNDERSTAND → REASON → DECIDE → VALIDATE</strong>.
              Autonomous agents collaborate across demand forecasting, stock deficit checks, inter-hospital surplus matching, and regulatory compliance.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="lg"
              loading={analyzing}
              icon={<Sparkles className="h-4 w-4" />}
              onClick={handleTriggerAnalysis}
              className="bg-indigo-600 hover:bg-indigo-700 border-indigo-500"
            >
              {analyzing ? 'Reasoning Across Network...' : 'Trigger Full AI Analysis'}
            </Button>
          </div>
        </div>
      </div>

      {/* Action Banner Toast */}
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
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
            <XCircle className="h-5 w-5 text-rose-600" />
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
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-indigo-900">
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
                    >
                      Approve & Execute
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    Decision Recorded: {selectedRec.approval_status.toUpperCase()}
                  </span>
                )
              }
            />

            {/* ─── Synthesized Recommended Actions ──────────────────────────── */}
            <CardBody className="space-y-4 bg-slate-50/40">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Prioritized Action Recommendations (Coordinator Synthesis)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedRec.recommended_actions.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {act.action_type.replace(/_/g, ' ')}
                        </span>
                        <Badge variant="critical" size="sm">
                          {act.priority.toUpperCase()} PRIORITY
                        </Badge>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Confidence: {(act.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {act.target_drug_name || act.target_drug_id}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{act.reasoning}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Recommended Quantity:</span>
                      <span className="text-indigo-700 font-bold">{act.recommended_quantity} units</span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span>{act.source_location_id || 'Supplier Origin'}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="font-bold text-slate-800">{act.destination_location_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* ─── Multi-Agent Explainability Matrix (6 Agent Findings) ───────── */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Multi-Agent Individual Reasoning Traces</h3>
                <p className="text-xs text-slate-500">
                  Inspect granular evidence and empirical findings generated by each specialized autonomous agent
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                {selectedRec.agent_findings.length} Specialized Findings
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedRec.agent_findings.map((finding, idx) => (
                <div
                  key={idx}
                  className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Agent Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-slate-100">{getAgentIcon(finding.agent_name)}</span>
                        <span className="font-bold text-xs text-slate-900">{finding.agent_name}</span>
                      </div>
                      <Badge variant={finding.severity === 'critical' ? 'critical' : finding.severity === 'high' ? 'warning' : 'info'} size="sm">
                        {finding.severity.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Target & Issue Description */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                        {finding.finding_type.replace(/_/g, ' ')}
                      </span>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5 leading-snug">
                        {finding.description}
                      </p>
                    </div>
                  </div>

                  {/* Supporting Metrics */}
                  {finding.metrics && Object.keys(finding.metrics).length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 bg-slate-50/80 p-2 rounded-lg space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Supporting Telemetry</span>
                      {Object.entries(finding.metrics).map(([k, v], mIdx) => (
                        <div key={mIdx} className="flex items-between justify-between text-[11px]">
                          <span className="text-slate-500 font-mono">{k.replace(/_/g, ' ')}:</span>
                          <span className="font-bold text-slate-800 font-mono">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
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
