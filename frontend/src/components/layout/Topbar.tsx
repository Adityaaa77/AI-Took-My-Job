import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bell,
  UserCheck,
  Zap,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAlerts } from '../../context/AlertContext';
import type { UserRole } from '../../types';

export const Topbar: React.FC = () => {
  const { user, role, switchRole, logout } = useAuth();
  const { unreadCount, criticalCount } = useAlerts();
  const navigate = useNavigate();
  const location = useLocation();

  const roleLabels: Record<UserRole, { label: string; tag: string; color: string }> = {
    admin: { label: 'Admin / Central Authority', tag: 'DG-MOHFW', color: 'bg-emerald-100 text-emerald-800' },
    procurement_officer: { label: 'Procurement Officer', tag: 'CPO-CENTRAL', color: 'bg-blue-100 text-blue-800' },
    warehouse_manager: { label: 'Warehouse / Distributor', tag: 'WH-001 NORTH', color: 'bg-amber-100 text-amber-800' },
    hospital_staff: { label: 'Hospital / Institution', tag: 'AIIMS PHARMACY', color: 'bg-indigo-100 text-indigo-800' },
    vendor: { label: 'Vendor / Supplier', tag: 'SUN PHARMA', color: 'bg-purple-100 text-purple-800' },
    compliance_officer: { label: 'Quality / Compliance', tag: 'CDSCO QA', color: 'bg-rose-100 text-rose-800' },
  };

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return { title: 'Executive Command Center', desc: 'Real-time overview of national drug availability & operational metrics' };
      case '/tracking':
        return { title: 'End-to-End Supply Chain Tracker', desc: 'Live visual pipeline: Vendor → PO → Shipment → Warehouse → Hospital → Consumption' };
      case '/ai-decisions':
        return { title: 'AI Decision Center (Multi-Agent Reasoning)', desc: 'Autonomous intelligence layer: Sense → Understand → Reason → Decide → Validate' };
      case '/blockchain-ledger':
        return { title: 'Blockchain Verification Ledger', desc: 'Cryptographically anchored immutable audit events & state proofs' };
      case '/inventory':
        return { title: 'Inventory & Stock Management', desc: 'Real-time stock across regional warehouses and hospitals' };
      case '/drugs':
        return { title: 'Drug Master Catalog', desc: 'Active therapeutic formulas, criticality ratings, and cold chain rules' };
      case '/batches':
        return { title: 'Batch & Quality Assurance', desc: 'Manufacturing lots, shelf-life monitoring, and quarantine controls' };
      case '/procurement':
        return { title: 'Procurement & Purchase Orders', desc: 'Order lifecycle from automated reorder suggestion to delivery' };
      case '/shipments':
        return { title: 'Shipment Logistics & Transit', desc: 'Live reefer truck tracking, IoT temperatures, and milestone updates' };
      case '/consumption':
        return { title: 'Hospital Consumption & Analytics', desc: 'Institution daily drug usage and automatic anomaly detection' };
      case '/replenishment':
        return { title: 'Replenishment & Allocation', desc: 'Inter-hospital transfers and central warehouse replenishment requests' };
      case '/alerts':
        return { title: 'Incident & Alert Management', desc: 'Critical stockouts, temperature excursions, and expiry warnings' };
      case '/audit-log':
        return { title: 'System Audit Trail', desc: 'Compliance tracking of all state transitions and human-in-the-loop actions' };
      case '/network':
        return { title: 'Healthcare Network Directory', desc: 'Verified hospitals, regional warehouses, and certified pharmaceutical suppliers' };
      default:
        return { title: 'Drug Supply Chain System', desc: 'National Health Command Center & AI Logistics' };
    }
  };

  const pageInfo = getPageTitle(location.pathname);

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between shadow-2xs">
      {/* Left: Page Title & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900 leading-none">{pageInfo.title}</h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <Zap className="h-3 w-3 text-emerald-600" />
            MoHFW
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 hidden sm:block">{pageInfo.desc}</p>
      </div>

      {/* Right: Role Switcher & Actions */}
      <div className="flex items-center gap-3">
        {/* Quick SIH Evaluation Role Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
          <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1 hidden md:flex">
            <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
            Active Role:
          </span>
          <select
            value={role}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-md px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer shadow-2xs"
          >
            <option value="admin">Admin / Central Authority</option>
            <option value="procurement_officer">Procurement Officer</option>
            <option value="warehouse_manager">Warehouse / Distributor</option>
            <option value="hospital_staff">Hospital / Institution</option>
            <option value="vendor">Vendor / Supplier</option>
            <option value="compliance_officer">Quality / Compliance</option>
          </select>
        </div>

        {/* AI Quick Analysis Shortcut */}
        <button
          onClick={() => navigate('/ai-decisions')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shadow-2xs"
          title="Open AI Multi-Agent Decision Center"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          <span className="hidden sm:inline">AI Decision Hub</span>
        </button>

        {/* Alert Notification Center */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="View Incidents & Alerts"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={`absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${
                criticalCount > 0 ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* User / Logout */}
        <div className="pl-2 border-l border-slate-200 flex items-center gap-2">
          <div className="hidden lg:block text-right">
            <p className="text-xs font-bold text-slate-800 leading-none">{user?.name}</p>
            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${roleLabels[role].color}`}>
              {roleLabels[role].tag}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
            title="Logout / Reset Session"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
