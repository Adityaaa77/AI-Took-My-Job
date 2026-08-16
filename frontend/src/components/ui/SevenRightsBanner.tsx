import React from 'react';
import { Package, ShieldCheck, MapPin, Clock, ThermometerSnowflake, DollarSign, Users } from 'lucide-react';

export const SevenRightsBanner: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const rights = [
    { title: 'Right Product', desc: 'Accidental mix-up prevention', icon: <Package className="h-4 w-4" />, color: 'emerald' },
    { title: 'Right Quantity', desc: 'Safety buffers & no waste', icon: <ShieldCheck className="h-4 w-4" />, color: 'blue' },
    { title: 'Right Place', desc: 'Institution & ward allocation', icon: <MapPin className="h-4 w-4" />, color: 'indigo' },
    { title: 'Right Time', desc: 'Vendor lead-time & speed', icon: <Clock className="h-4 w-4" />, color: 'amber' },
    { title: 'Right Condition', desc: 'Cold chain & batch expiry', icon: <ThermometerSnowflake className="h-4 w-4" />, color: 'cyan' },
    { title: 'Right Cost', desc: 'Optimized bulk procurement', icon: <DollarSign className="h-4 w-4" />, color: 'teal' },
    { title: 'Right People', desc: 'Role-authenticated actions', icon: <Users className="h-4 w-4" />, color: 'rose' },
  ];

  if (compact) {
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between overflow-x-auto gap-4 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-slate-800">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">7 Rights Guarantees</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {rights.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 shrink-0 text-slate-300 font-medium">
              <span className="text-emerald-400">{r.icon}</span>
              <span>{r.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            HEALTHCARE SUPPLY CHAIN NORTH STAR
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">The 7 Rights Operational Framework</h2>
          <p className="text-xs text-slate-400">
            Intelligent closed-loop architecture: <strong>SENSE → UNDERSTAND → REASON → DECIDE → VALIDATE → RECORD → MONITOR</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-300">Closed-Loop AI + Blockchain</p>
            <p className="text-[11px] text-emerald-400">SIH - Problem Statement PSS04</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-4">
        {rights.map((r, idx) => (
          <div
            key={idx}
            className="bg-slate-800/60 hover:bg-slate-800 transition-colors p-3 rounded-xl border border-slate-700/50 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-1.5 rounded-lg bg-slate-700/70 text-emerald-400">{r.icon}</span>
              <span className="text-[10px] font-mono text-slate-400">0{idx + 1}</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-100">{r.title}</p>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
