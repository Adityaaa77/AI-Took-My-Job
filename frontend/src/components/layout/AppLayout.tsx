import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { SevenRightsBanner } from '../ui/SevenRightsBanner';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Fixed Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header Bar */}
        <Topbar />

        {/* Dynamic Page Outlet with Responsive Container */}
        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* Top 7 Rights Compact Guarantee Strip */}
          <SevenRightsBanner compact />

          {/* Child Page Render */}
          <Outlet />
        </main>

        {/* System Footer */}
        <footer className="px-6 py-4 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Drug Inventory & Supply Chain Tracking System</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>AI Multi-Agent Intelligence Layer</span>
            <span>•</span>
            <span>Immutable Blockchain Ledger</span>
            <span>•</span>
            <span>MoHFW Compliant</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
