// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Authentication & Role Quick-Selector Portal
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Mail,
  UserCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { MOCK_USERS } from '../services/mockData';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@mohfw.gov.in');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(false);

  const roleOptions: { role: UserRole; title: string; desc: string; user: string; color: string }[] = [
    {
      role: 'admin',
      title: 'Admin / Central Authority',
      desc: 'National oversight, AI approvals & global alerts',
      user: 'Dr. Rajesh Verma (DG-MOHFW)',
      color: 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900',
    },
    {
      role: 'procurement_officer',
      title: 'Procurement Officer',
      desc: 'Purchase order generation & vendor allocation',
      user: 'Suresh Menon (CPO Central)',
      color: 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-900',
    },
    {
      role: 'warehouse_manager',
      title: 'Warehouse / Distributor',
      desc: 'Storage vaults, receipt checks & dispatches',
      user: 'Vikram Sethi (WH-001 North)',
      color: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900',
    },
    {
      role: 'hospital_staff',
      title: 'Hospital / Institution',
      desc: 'Ward consumption logs & replenishment requests',
      user: 'Dr. Ananya Sharma (AIIMS Pharmacy)',
      color: 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-900',
    },
    {
      role: 'vendor',
      title: 'Vendor / Supplier',
      desc: 'Order packaging, GPS dispatch & delivery updates',
      user: 'Arunav Patel (Sun Pharma Logistics)',
      color: 'border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-purple-900',
    },
    {
      role: 'compliance_officer',
      title: 'Quality / Compliance',
      desc: 'Batch shelf-life, quarantine & recall controls',
      user: 'Pooja Kulkarni (CDSCO Inspector)',
      color: 'border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-900',
    },
  ];

  const handleRoleQuickSelect = async (role: UserRole) => {
    setSelectedRole(role);
    const mockUser = MOCK_USERS[role];
    if (mockUser) {
      setEmail(mockUser.email);
    }
    setLoading(true);
    await login(mockUser?.email || email, 'Password123!', role);
    setLoading(false);
    navigate('/');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(email, password || 'Password123!', selectedRole);
    setLoading(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-emerald-600/10 via-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-950">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          DrugTrace AI Portal
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Intelligent Drug Inventory & Supply Chain Tracking System (PSS04)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-4xl relative z-10">
        <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-200">
          {/* Quick SIH Evaluator Role Selector Header */}
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                1-Click Role Access (Select Role to Instant-Login)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Explore the system instantly through the perspective of any of the 6 key operational stakeholders:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {roleOptions.map((opt) => (
                <div
                  key={opt.role}
                  onClick={() => handleRoleQuickSelect(opt.role)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between ${opt.color}`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{opt.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-tight">{opt.desc}</p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[10px] font-semibold text-slate-700">
                    <UserCheck className="h-3 w-3 text-emerald-600" />
                    <span className="truncate">{opt.user}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Standard Authentication Fallback Form */}
          <div className="pt-4 border-t border-slate-200">
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Authorized Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cryptographic Key / Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-500">
                  <span>Backend Protocol: </span>
                  <span className="font-mono text-emerald-600 font-bold">JWT Bearer + RBAC Guard</span>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  type="submit"
                  loading={loading}
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Enter Portal
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Closed Loop Tagline */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          AI PROPOSES → SMART CONTRACT VALIDATES → BLOCKCHAIN RECORDS → DASHBOARD MONITORS
        </p>
      </div>
    </div>
  );
};
