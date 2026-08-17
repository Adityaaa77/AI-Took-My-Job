import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  ShoppingCart,
  Activity,
  Bot,
  ShieldAlert,
  FileText,
  Pill,
  Building2,
  Lock,
  Layers,
  ChevronRight,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAlerts } from '../../context/AlertContext';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
  highlight?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { role, user } = useAuth();
  const { unreadCount } = useAlerts();

  const navGroups: NavGroup[] = [
    {
      group: 'Core Operations',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Supply Chain Tracking', path: '/tracking', icon: Truck, highlight: true },
        { name: 'Inventory & Stock', path: '/inventory', icon: Boxes },
        { name: 'Drug Catalog', path: '/drugs', icon: Pill },
        { name: 'Batch & Quality', path: '/batches', icon: Layers },
      ],
    },
    {
      group: 'Procurement & Logistics',
      items: [
        { name: 'Purchase Orders', path: '/procurement', icon: ShoppingCart },
        { name: 'Shipments & Transit', path: '/shipments', icon: Truck },
        { name: 'Hospital Consumption', path: '/consumption', icon: Activity },
        { name: 'Replenishment', path: '/replenishment', icon: Building2 },
      ],
    },
    {
      group: 'Intelligence & Trust',
      items: [
        {
          name: 'AI Decision Center',
          path: '/ai-decisions',
          icon: Bot,
          badge: 'AI Agents',
          badgeColor: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
        },
        {
          name: 'Batch Verification & Provenance',
          path: '/batch-verification',
          icon: ShieldCheck,
          badge: 'Verified',
          badgeColor: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        },
        {
          name: 'IoT Telemetry Simulation',
          path: '/telemetry-simulation',
          icon: Activity,
        },
        {
          name: 'Alerts & Incidents',
          path: '/alerts',
          icon: ShieldAlert,
          badge: unreadCount > 0 ? `${unreadCount}` : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
        { name: 'Audit Trail', path: '/audit-log', icon: FileText },
        { name: 'Network Directory', path: '/network', icon: Building2 },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 shrink-0 border-r border-slate-800 select-none z-30">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-950">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-bold text-white text-sm tracking-tight leading-none">DrugTrace AI</h1>
          <p className="text-[11px] text-emerald-400 font-medium mt-1">National Health Supply Chain</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {group.group}
            </p>
            {group.items.map((item, iIdx) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={iIdx}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-600/90 text-white font-semibold shadow-xs shadow-emerald-900/50'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge ? (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.badgeColor || ''}`}>
                      {item.badge}
                    </span>
                  ) : item.highlight ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  ) : (
                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Role / Current User Capsule */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800/80">
          <div className="h-8 w-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {user?.name ? user.name.charAt(0) : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'Authorized User'}</p>
            <p className="text-[10px] text-emerald-400 font-mono capitalize truncate">
              {role.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
