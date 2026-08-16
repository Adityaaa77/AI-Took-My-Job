// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Network Directory: Verified Hospitals, Warehouses & Certified Suppliers
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Building2, Boxes, Users, Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { networkService } from '../services/networkService';
import type { Hospital, Warehouse, Vendor } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Tabs } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';

export const NetworkDirectoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('hospitals');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDirectory() {
      setLoading(true);
      const [hRes, wRes, vRes] = await Promise.all([
        networkService.getAllHospitals(),
        networkService.getAllWarehouses(),
        networkService.getAllVendors(),
      ]);
      if (hRes.data) setHospitals(hRes.data);
      if (wRes.data) setWarehouses(wRes.data);
      if (vRes.data) setVendors(vRes.data);
      setLoading(false);
    }
    loadDirectory();
  }, []);

  const hospitalColumns: Column<Hospital>[] = [
    {
      header: 'Hospital Name / Code',
      accessor: (h) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs text-slate-900">{h.hospital_id}</span>
            <Badge variant="purple" size="sm">
              {h.tier}
            </Badge>
          </div>
          <p className="font-bold text-xs text-slate-800 mt-0.5">{h.name}</p>
          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-slate-400" />
            {h.location_zone}
          </span>
        </div>
      ),
    },
    {
      header: 'Capacity & Wards',
      accessor: (h) => (
        <div className="text-xs">
          <span className="font-bold text-slate-800">{h.bed_capacity?.toLocaleString()} Total Beds</span>
          <p className="text-slate-500 font-medium mt-0.5">{h.icu_beds} Dedicated ICU Beds</p>
        </div>
      ),
    },
    {
      header: 'Pharmacy Contact',
      accessor: (h) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-800">{h.contact_person}</p>
          <p className="text-slate-500 font-mono flex items-center gap-1">
            <Phone className="h-3 w-3 text-slate-400" />
            {h.contact_phone}
          </p>
          <p className="text-slate-500 flex items-center gap-1">
            <Mail className="h-3 w-3 text-slate-400" />
            {h.contact_email}
          </p>
        </div>
      ),
    },
    {
      header: 'Network Status',
      accessor: () => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Connected & Verified
        </span>
      ),
    },
  ];

  const warehouseColumns: Column<Warehouse>[] = [
    {
      header: 'Depot Name / Code',
      accessor: (w) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">{w.warehouse_id}</span>
          <p className="font-bold text-xs text-slate-800 mt-0.5">{w.name}</p>
          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-slate-400" />
            {w.location_zone}
          </span>
        </div>
      ),
    },
    {
      header: 'Storage Capacity',
      accessor: (w) => (
        <div>
          <span className="font-bold text-xs text-slate-900 font-mono">
            {w.capacity.toLocaleString()} Pallet Units
          </span>
          {w.cold_storage_available && (
            <p className="text-[10px] text-cyan-700 font-semibold mt-0.5">
              ✓ Automated Cold Chain Vault (2°C - 8°C)
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Address',
      accessor: (w) => <span className="text-xs text-slate-600 max-w-xs block">{w.address}</span>,
    },
  ];

  const vendorColumns: Column<Vendor>[] = [
    {
      header: 'Supplier / Manufacturer',
      accessor: (v) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs text-slate-900">{v.vendor_id}</span>
            {v.compliance_certified && (
              <Badge variant="success" size="sm">
                CDSCO CERTIFIED
              </Badge>
            )}
          </div>
          <p className="font-bold text-xs text-slate-800 mt-0.5">{v.name}</p>
        </div>
      ),
    },
    {
      header: 'Reliability Rating',
      accessor: (v) => (
        <div>
          <span className="font-bold text-xs text-emerald-700 font-mono">{v.reliability_score}% Reliable</span>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            Avg Lead Time: {v.avg_lead_time_days} days
          </p>
        </div>
      ),
    },
    {
      header: 'Contact Info',
      accessor: (v) => (
        <div className="text-xs space-y-0.5 font-mono text-slate-600">
          <p>{v.contact_email}</p>
          <p>{v.contact_phone}</p>
        </div>
      ),
    },
    {
      header: 'Active POs',
      accessor: (v) => (
        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
          {v.active_orders_count || 0} active orders
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
            <Building2 className="h-4 w-4" />
            NATIONAL HEALTHCARE LOGISTICS DIRECTORY
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Verified Institutions, Hubs & Certified Suppliers
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Directory of licensed hospitals, central medical services society (CMSS) warehouses, and certified pharmaceutical manufacturers.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'hospitals', label: 'Hospital Network', icon: <Building2 className="h-4 w-4" />, count: hospitals.length },
          { id: 'warehouses', label: 'Central Warehouses', icon: <Boxes className="h-4 w-4" />, count: warehouses.length },
          { id: 'vendors', label: 'Certified Suppliers', icon: <Users className="h-4 w-4" />, count: vendors.length },
        ]}
      />

      {/* Tables based on active tab */}
      {activeTab === 'hospitals' && (
        <Card>
          <CardHeader
            title="Connected Hospitals & Medical Institutions"
            subtitle="Tier-1/2/3 government hospitals reporting real-time bed & pharmacy metrics"
          />
          <CardBody className="p-0">
            <Table columns={hospitalColumns} data={hospitals} loading={loading} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'warehouses' && (
        <Card>
          <CardHeader
            title="Central & Regional Medical Storage Hubs"
            subtitle="Cold-chain compliant regional buffering depots"
          />
          <CardBody className="p-0">
            <Table columns={warehouseColumns} data={warehouses} loading={loading} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'vendors' && (
        <Card>
          <CardHeader
            title="Certified Pharmaceutical Suppliers & Manufacturers"
            subtitle="Monitored on lead-time compliance and delivery performance scorecards"
          />
          <CardBody className="p-0">
            <Table columns={vendorColumns} data={vendors} loading={loading} />
          </CardBody>
        </Card>
      )}
    </div>
  );
};
