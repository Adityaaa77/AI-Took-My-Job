// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Adaptive Executive Dashboard for All 6 Operational Roles
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Truck,
  ShoppingCart,
  ShieldAlert,
  Bot,
  Activity,
  ArrowUpRight,
  Sparkles,
  Building2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import { inventoryService } from '../services/inventoryService';
import { procurementService } from '../services/procurementService';
import { shipmentService } from '../services/shipmentService';
import { aiService } from '../services/aiService';
import { drugService } from '../services/drugService';
import type {
  InventoryItem,
  PurchaseOrder,
  Shipment,
  AIRecommendation,
  Drug,
} from '../types';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, Badge } from '../components/ui/Badge';
import { Table, type Column } from '../components/ui/Table';

export const DashboardPage: React.FC = () => {
  const { role, user } = useAuth();
  const { criticalCount } = useAlerts();
  const navigate = useNavigate();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [aiRec, setAiRec] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      const [invRes, poRes, shpRes, drugRes, aiRes] = await Promise.all([
        inventoryService.getAllInventory(),
        procurementService.getAllOrders(),
        shipmentService.getAllShipments(),
        drugService.getAllDrugs(),
        aiService.getAllRecommendations(),
      ]);

      if (invRes.data) setInventory(invRes.data);
      if (poRes.data) setOrders(poRes.data);
      if (shpRes.data) setShipments(shpRes.data);
      if (drugRes.data) setDrugs(drugRes.data);
      if (aiRes.data && aiRes.data.length > 0) setAiRec(aiRes.data[0]);
      setLoading(false);
    }

    loadDashboardData();
  }, []);

  const totalStockUnits = inventory.reduce((sum, item) => sum + item.available_stock, 0);
  const lowStockCount = inventory.filter(
    (item) => item.available_stock < (item.drug_id?.min_safety_stock ?? 0)
  ).length;
  const activeShipmentsCount = shipments.filter(
    (s) => s.status === 'in_transit' || s.status === 'preparing' || s.status === 'dispatched'
  ).length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'pending' || o.status === 'draft').length;

  const shipmentColumns: Column<Shipment>[] = [
    {
      header: 'Shipment ID',
      accessor: (s) => (
        <span className="font-mono font-bold text-xs text-slate-800">{s.shipment_id}</span>
      ),
    },
    {
      header: 'Drug Name',
      accessor: (s) => (
        <div>
          <p className="font-semibold text-slate-900 text-xs">
            {typeof s.drug_id === 'string' ? s.drug_id : s.drug_id?.name}
          </p>
          <span className="text-[10px] text-slate-400 font-mono">
            Qty: {s.quantity.toLocaleString()} units
          </span>
        </div>
      ),
    },
    {
      header: 'Route',
      accessor: (s) => (
        <div className="text-xs">
          <span className="text-slate-500">{s.origin_id.split(' ')[0]}</span>
          <span className="text-slate-400 mx-1">➔</span>
          <span className="font-medium text-slate-800">{s.destination_id.split(' ')[0]}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (s) => <StatusBadge status={s.status} size="sm" />,
    },
    {
      header: 'Blockchain Proof',
      accessor: (s) =>
        s.blockchain_tx_hash ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <Lock className="h-3 w-3" />
            Verified
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">Pending Block</span>
        ),
    },
  ];

  const lowStockColumns: Column<InventoryItem>[] = [
    {
      header: 'Drug Name',
      accessor: (inv) => (
        <div>
          <p className="font-semibold text-slate-900 text-xs">{inv.drug_id?.name}</p>
          <span className="text-[10px] text-slate-400 font-mono">{inv.drug_id?.drug_id}</span>
        </div>
      ),
    },
    {
      header: 'Facility',
      accessor: (inv) => (
        <span className="font-medium text-xs text-slate-700">{inv.location_id}</span>
      ),
    },
    {
      header: 'Available Stock',
      accessor: (inv) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs text-rose-600">{inv.available_stock.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400">/ min {inv.drug_id?.min_safety_stock}</span>
        </div>
      ),
    },
    {
      header: 'Deficit',
      accessor: (inv) => {
        const deficit = (inv.drug_id?.min_safety_stock || 0) - inv.available_stock;
        return (
          <Badge variant="critical" size="sm" dot>
            -{deficit} shortage
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Hero Overview Banner with Role Indicator ─────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-700/60">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/30 text-emerald-400 text-xs font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              ROLE PERSPECTIVE: {role.replace(/_/g, ' ').toUpperCase()}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {user?.name || 'Supply Authority'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              {role === 'admin' && 'Central command monitoring national drug reserves, inter-hospital redistribution, and automated emergency dispatches.'}
              {role === 'procurement_officer' && 'Procurement desk: Review autonomous demand forecasts, approve bulk purchase orders, and monitor vendor lead times.'}
              {role === 'warehouse_manager' && 'Warehouse terminal: Manage central inventory receipts, cold-chain batch preservation, and emergency dispatches.'}
              {role === 'hospital_staff' && 'Institutional pharmacy: Track daily ward consumption, monitor safety buffers, and submit replenishment requisitions.'}
              {role === 'vendor' && 'Supplier logistics portal: Fulfill purchase orders, update packaging status, and log GPS/IoT shipment milestones.'}
              {role === 'compliance_officer' && 'Regulatory desk: Enforce batch quality standards, investigate temperature excursions, and inspect recall lots.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="md"
              className="bg-slate-800/80 hover:bg-slate-700 text-white border-slate-600"
              icon={<Truck className="h-4 w-4 text-emerald-400" />}
              onClick={() => navigate('/tracking')}
            >
              End-to-End Tracker
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Bot className="h-4 w-4" />}
              onClick={() => navigate('/ai-decisions')}
            >
              AI Decision Center
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Metric Stat Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Drug SKUs"
          value={drugs.length}
          icon={<Boxes className="h-5 w-5" />}
          subtitle="100% cataloged on ledger"
          trend={{ value: '+2 new', isPositive: true }}
          color="emerald"
          onClick={() => navigate('/drugs')}
        />
        <StatCard
          title="Total Available Units"
          value={totalStockUnits.toLocaleString()}
          icon={<Activity className="h-5 w-5" />}
          subtitle="Across warehouses & hospitals"
          color="blue"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title="Critical Stockouts"
          value={lowStockCount}
          icon={<ShieldAlert className="h-5 w-5" />}
          subtitle="Below safety threshold"
          trend={{ value: `${lowStockCount} urgent`, isPositive: false }}
          color="rose"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title="Active Shipments"
          value={activeShipmentsCount}
          icon={<Truck className="h-5 w-5" />}
          subtitle="In-transit cold chain"
          trend={{ value: `${activeShipmentsCount} live`, isPositive: true }}
          color="cyan"
          onClick={() => navigate('/shipments')}
        />
      </div>

      {/* ─── AI Real-Time Decision Recommendation Spotlight (The SIH USP) ──── */}
      {aiRec && (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-900/90 via-slate-900 to-slate-900 text-white shadow-md">
          <CardBody className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-3xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                    AI AGENT INTELLIGENCE ALERT • OVERALL RISK: CRITICAL
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{aiRec.recommendation_id}</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  ICU Propofol Surge Detected at AIIMS New Delhi (+209%)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Coordinator Agent synthesized a 2-pronged resolution: (1) Instant inter-hospital transfer of 200 units from Safdarjung surplus (1.2 km away) prevents stockout within 4 hours; (2) Bulk PO-2026-0891 with Sun Pharma replenishes network buffers.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="primary"
                  size="md"
                  icon={<ArrowUpRight className="h-4 w-4" />}
                  onClick={() => navigate('/ai-decisions')}
                >
                  Review AI Resolution
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ─── Main Two-Column Operational Grids ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Active Shipments In-Transit */}
        <Card>
          <CardHeader
            title="Live Supply Chain Shipments"
            subtitle="Active transport corridors & cold-chain monitoring"
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                onClick={() => navigate('/shipments')}
              >
                View All
              </Button>
            }
          />
          <CardBody className="p-0">
            <Table
              columns={shipmentColumns}
              data={shipments.slice(0, 4)}
              loading={loading}
              emptyMessage="No active shipments in transit."
              onRowClick={() => navigate('/shipments')}
            />
          </CardBody>
        </Card>

        {/* Right: Low-Stock & Critical Reserves Alert */}
        <Card>
          <CardHeader
            title="Stockout Risk & Safety Thresholds"
            subtitle="Facilities requiring immediate replenishment"
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                onClick={() => navigate('/inventory')}
              >
                Manage Stock
              </Button>
            }
          />
          <CardBody className="p-0">
            <Table
              columns={lowStockColumns}
              data={inventory.filter((i) => i.available_stock < (i.drug_id?.min_safety_stock ?? 0))}
              loading={loading}
              emptyMessage="All facilities are operating above safety stock thresholds."
              onRowClick={() => navigate('/inventory')}
            />
          </CardBody>
        </Card>
      </div>

      {/* ─── Quick Role-Specific Shortcuts ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => navigate('/tracking')}
          className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-md text-center"
        >
          <Truck className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
          <p className="font-bold text-slate-800 text-xs">Tracking Pipeline</p>
          <p className="text-[11px] text-slate-400 mt-0.5">End-to-end</p>
        </div>

        <div
          onClick={() => navigate('/procurement')}
          className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-md text-center"
        >
          <ShoppingCart className="h-6 w-6 text-blue-600 mx-auto mb-2" />
          <p className="font-bold text-slate-800 text-xs">Purchase Orders</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{pendingOrdersCount} pending</p>
        </div>

        <div
          onClick={() => navigate('/consumption')}
          className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-md text-center"
        >
          <Activity className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
          <p className="font-bold text-slate-800 text-xs">Consumption</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Daily Logs & Trends</p>
        </div>

        <div
          onClick={() => navigate('/blockchain-ledger')}
          className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-md text-center"
        >
          <Lock className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
          <p className="font-bold text-slate-800 text-xs">Blockchain Proof</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Verified Events</p>
        </div>

        <div
          onClick={() => navigate('/alerts')}
          className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-md text-center"
        >
          <ShieldAlert className="h-6 w-6 text-rose-600 mx-auto mb-2" />
          <p className="font-bold text-slate-800 text-xs">Alert Center</p>
          <p className="text-[11px] text-rose-500 font-bold mt-0.5">{criticalCount} Critical</p>
        </div>

        <div
          onClick={() => navigate('/network')}
          className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-md text-center"
        >
          <Building2 className="h-6 w-6 text-amber-600 mx-auto mb-2" />
          <p className="font-bold text-slate-800 text-xs">Network Directory</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Hospitals & Vendors</p>
        </div>
      </div>
    </div>
  );
};
