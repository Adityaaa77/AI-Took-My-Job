// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Real-Time Inventory & Multi-Facility Stock Management
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  ArrowRightLeft,
  ShieldAlert,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { drugService } from '../services/drugService';
import { networkService } from '../services/networkService';
import type { InventoryItem, Drug, Hospital, Warehouse } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';

export const InventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);

  // Form states
  const [transferForm, setTransferForm] = useState({
    fromLocation: '',
    toLocation: '',
    drug_id: '',
    quantity: 100,
  });

  const [adjustForm, setAdjustForm] = useState({
    location_id: '',
    drug_id: '',
    available_stock: 0,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [invRes, drugRes, hospRes, whRes] = await Promise.all([
      inventoryService.getAllInventory(),
      drugService.getAllDrugs(),
      networkService.getAllHospitals(),
      networkService.getAllWarehouses(),
    ]);

    if (invRes.data) setInventory(invRes.data);
    if (drugRes.data) setDrugs(drugRes.data);
    if (hospRes.data) setHospitals(hospRes.data);
    if (whRes.data) setWarehouses(whRes.data);
    setLoading(false);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.fromLocation || !transferForm.toLocation || !transferForm.drug_id) return;

    await inventoryService.transferStock(
      transferForm.fromLocation,
      transferForm.toLocation,
      transferForm.drug_id,
      Number(transferForm.quantity)
    );

    setTransferModalOpen(false);
    setToastMessage(`Stock transfer of ${transferForm.quantity} units successfully executed.`);
    loadData();
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.location_id || !adjustForm.drug_id) return;

    await inventoryService.updateStock(adjustForm.location_id, adjustForm.drug_id, {
      available_stock: Number(adjustForm.available_stock),
    });

    setAdjustModalOpen(false);
    setToastMessage('Stock numbers updated successfully.');
    loadData();
  };

  const filteredInventory = inventory.filter((item) => {
    const drugName = item.drug_id?.name || '';
    const drugCode = item.drug_id?.drug_id || '';
    const location = item.location_id || '';

    const matchesSearch =
      drugName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drugCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.toLowerCase().includes(searchQuery.toLowerCase());

    const cleanFilter = facilityFilter.split(' ')[0].trim().toLowerCase();
    const cleanLoc = location.split(' ')[0].trim().toLowerCase();
    const matchesFacility =
      facilityFilter === 'all' ||
      cleanLoc === cleanFilter ||
      location.toLowerCase().includes(facilityFilter.toLowerCase()) ||
      facilityFilter.toLowerCase().includes(location.toLowerCase());

    return matchesSearch && matchesFacility;
  });

  const totalStock = filteredInventory.reduce((acc, i) => acc + i.available_stock, 0);
  const totalReserved = filteredInventory.reduce((acc, i) => acc + i.reserved_stock, 0);
  const totalIncoming = filteredInventory.reduce((acc, i) => acc + i.incoming_stock, 0);
  const totalDeficits = filteredInventory.filter((i) => i.available_stock < (i.drug_id?.min_safety_stock ?? 0)).length;

  const columns: Column<InventoryItem>[] = [
    {
      header: 'Drug Formulation',
      accessor: (inv) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900 text-xs">{inv.drug_id?.name}</p>
            {inv.drug_id?.is_critical && (
              <Badge variant="critical" size="sm">
                CRITICAL
              </Badge>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {inv.drug_id?.drug_id} • {inv.drug_id?.category}
          </span>
        </div>
      ),
    },
    {
      header: 'Facility Location',
      accessor: (inv) => (
        <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          {inv.location_id}
        </span>
      ),
    },
    {
      header: 'Available Stock',
      accessor: (inv) => {
        const isLow = inv.available_stock < (inv.drug_id?.min_safety_stock || 0);
        return (
          <div>
            <span className={`font-bold text-xs ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
              {inv.available_stock.toLocaleString()} {inv.drug_id?.unit}
            </span>
            <p className="text-[10px] text-slate-400 font-mono">Min buffer: {inv.drug_id?.min_safety_stock}</p>
          </div>
        );
      },
    },
    {
      header: 'Reserved / Incoming',
      accessor: (inv) => (
        <div className="text-xs">
          <span className="text-amber-700 font-semibold">{inv.reserved_stock} res.</span>
          <span className="text-slate-400 mx-1.5">•</span>
          <span className="text-emerald-700 font-semibold">+{inv.incoming_stock} in-bound</span>
        </div>
      ),
    },
    {
      header: 'Buffer Status',
      accessor: (inv) => {
        const min = inv.drug_id?.min_safety_stock || 0;
        if (inv.available_stock === 0) {
          return (
            <Badge variant="critical" size="sm" dot>
              STOCKOUT
            </Badge>
          );
        }
        if (inv.available_stock < min) {
          return (
            <Badge variant="warning" size="sm" dot>
              LOW (-{min - inv.available_stock})
            </Badge>
          );
        }
        return (
          <Badge variant="success" size="sm" dot>
            OPTIMAL BUFFER
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      accessor: (inv) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAdjustForm({
                location_id: inv.location_id,
                drug_id: typeof inv.drug_id === 'string' ? inv.drug_id : inv.drug_id.drug_id,
                available_stock: inv.available_stock,
              });
              setAdjustModalOpen(true);
            }}
          >
            Adjust
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Available Stock"
          value={totalStock.toLocaleString()}
          icon={<Boxes className="h-5 w-5" />}
          subtitle="Real-time units on hand"
          color="emerald"
        />
        <StatCard
          title="Reserved Units"
          value={totalReserved.toLocaleString()}
          icon={<Building2 className="h-5 w-5" />}
          subtitle="Allocated to ICU & wards"
          color="blue"
        />
        <StatCard
          title="Incoming In-Transit"
          value={totalIncoming.toLocaleString()}
          icon={<Boxes className="h-5 w-5" />}
          subtitle="En route from suppliers"
          color="cyan"
        />
        <StatCard
          title="Safety Deficits"
          value={totalDeficits}
          icon={<ShieldAlert className="h-5 w-5" />}
          subtitle="Facilities below threshold"
          trend={{ value: `${totalDeficits} critical`, isPositive: false }}
          color="rose"
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

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by drug name or facility..."
            className="w-full sm:w-80"
          />
          <select
            value={facilityFilter}
            onChange={(e) => setFacilityFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="all">All Facilities</option>
            {hospitals.map((h) => (
              <option key={h.hospital_id} value={h.hospital_id}>
                {h.hospital_id} ({h.name.split(' ')[0]})
              </option>
            ))}
            {warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.warehouse_id} ({w.name.split(' ')[0]})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="md"
            icon={<ArrowRightLeft className="h-4 w-4" />}
            onClick={() => {
              setTransferForm({
                fromLocation: hospitals[1]?.hospital_id || 'HOSP-002',
                toLocation: hospitals[0]?.hospital_id || 'HOSP-001',
                drug_id: drugs[1]?.drug_id || 'DRUG-002',
                quantity: 200,
              });
              setTransferModalOpen(true);
            }}
          >
            Inter-Facility Transfer
          </Button>
        </div>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader
          title="Facility Inventory & Stock Buffer Balances"
          subtitle={`Showing ${filteredInventory.length} facility stock records`}
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredInventory}
            loading={loading}
            emptyMessage="No stock records found matching filters."
          />
        </CardBody>
      </Card>

      {/* ─── Transfer Stock Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Inter-Facility Stock Transfer"
        subtitle="Redistribute emergency surplus stock between regional hospitals and warehouses"
        maxWidth="md"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Drug Formulation</label>
            <select
              value={transferForm.drug_id}
              onChange={(e) => setTransferForm({ ...transferForm, drug_id: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
              required
            >
              <option value="">Select Drug</option>
              {drugs.map((d) => (
                <option key={d.drug_id} value={d.drug_id}>
                  {d.drug_id} • {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Source Facility</label>
              <select
                value={transferForm.fromLocation}
                onChange={(e) => setTransferForm({ ...transferForm, fromLocation: e.target.value })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
                required
              >
                <option value="">Source</option>
                {hospitals.map((h) => (
                  <option key={h.hospital_id} value={h.hospital_id}>
                    {h.hospital_id} ({h.name.split(' ')[0]})
                  </option>
                ))}
                {warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>
                    {w.warehouse_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Destination Facility</label>
              <select
                value={transferForm.toLocation}
                onChange={(e) => setTransferForm({ ...transferForm, toLocation: e.target.value })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
                required
              >
                <option value="">Destination</option>
                {hospitals.map((h) => (
                  <option key={h.hospital_id} value={h.hospital_id}>
                    {h.hospital_id} ({h.name.split(' ')[0]})
                  </option>
                ))}
                {warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>
                    {w.warehouse_id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Transfer Quantity (Units)</label>
            <input
              type="number"
              min={1}
              value={transferForm.quantity}
              onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
              className="w-full p-2.5 border border-slate-300 rounded-lg font-bold text-slate-900"
              required
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Execute Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Adjust Stock Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Adjust Physical Inventory Stock"
        subtitle={`Facility: ${adjustForm.location_id}`}
        maxWidth="sm"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Physical Count (Available Units)</label>
            <input
              type="number"
              min={0}
              value={adjustForm.available_stock}
              onChange={(e) => setAdjustForm({ ...adjustForm, available_stock: Number(e.target.value) })}
              className="w-full p-2.5 border border-slate-300 rounded-lg font-bold text-slate-900 text-sm"
              required
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
