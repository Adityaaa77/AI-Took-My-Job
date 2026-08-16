// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Master Drug Catalog & National Formulary Management
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Plus, ThermometerSnowflake, CheckCircle2 } from 'lucide-react';
import { drugService } from '../services/drugService';
import type { Drug } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';

export const DrugsPage: React.FC = () => {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDrug, setNewDrug] = useState<Partial<Drug>>({
    name: '',
    generic_name: '',
    category: 'Critical Care',
    unit: 'vials',
    is_critical: true,
    min_safety_stock: 500,
    storage_temperature: 'ambient',
    therapeutic_class: '',
    strength: '',
    description: '',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDrugs();
  }, []);

  const loadDrugs = async () => {
    setLoading(true);
    const res = await drugService.getAllDrugs();
    if (res.data) setDrugs(res.data);
    setLoading(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrug.name) return;

    await drugService.createDrug(newDrug);
    setCreateModalOpen(false);
    setToastMessage(`Drug SKU "${newDrug.name}" registered successfully.`);
    setNewDrug({
      name: '',
      generic_name: '',
      category: 'Critical Care',
      unit: 'vials',
      is_critical: true,
      min_safety_stock: 500,
      storage_temperature: 'ambient',
      strength: '',
      description: '',
    });
    loadDrugs();
  };

  const filteredDrugs = drugs.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.drug_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.generic_name && d.generic_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat = categoryFilter === 'all' || d.category.toLowerCase().includes(categoryFilter.toLowerCase());

    return matchesSearch && matchesCat;
  });

  const columns: Column<Drug>[] = [
    {
      header: 'Drug Code & Formulation',
      accessor: (d) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs text-slate-900">{d.drug_id}</span>
            {d.is_critical && (
              <Badge variant="critical" size="sm">
                CRITICAL LIFE-SAVING
              </Badge>
            )}
          </div>
          <p className="font-bold text-xs text-slate-800 mt-0.5">{d.name}</p>
          <p className="text-[10px] text-slate-500 italic">{d.generic_name}</p>
        </div>
      ),
    },
    {
      header: 'Therapeutic Class / Category',
      accessor: (d) => (
        <div>
          <span className="font-semibold text-xs text-slate-800">{d.category}</span>
          <p className="text-[10px] text-slate-400">{d.therapeutic_class || 'Standard Form'}</p>
        </div>
      ),
    },
    {
      header: 'Storage Requirement',
      accessor: (d) =>
        d.storage_temperature === 'cold_chain_2_8' ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
            <ThermometerSnowflake className="h-3.5 w-3.5" />
            Cold-Chain (2°C - 8°C)
          </span>
        ) : (
          <span className="text-xs text-slate-600 font-medium">Ambient (15°C - 25°C)</span>
        ),
    },
    {
      header: 'Dosage / Strength',
      accessor: (d) => (
        <span className="font-mono text-xs text-slate-700 font-medium">{d.strength || d.dosage_form || 'N/A'}</span>
      ),
    },
    {
      header: 'Safety Threshold',
      accessor: (d) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">
            {d.min_safety_stock.toLocaleString()} {d.unit}
          </span>
          <p className="text-[10px] text-slate-400">Min Buffer</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
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
            placeholder="Search by drug name, code, or generic formula..."
            className="w-full sm:w-80"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="all">All Therapeutic Categories</option>
            <option value="critical">Critical Care / ICU</option>
            <option value="antibiotics">Antibiotics</option>
            <option value="endocrinology">Endocrinology</option>
            <option value="antivirals">Antivirals</option>
          </select>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setCreateModalOpen(true)}
        >
          Register Master SKU
        </Button>
      </div>

      {/* Drugs Table */}
      <Card>
        <CardHeader
          title="National Master Formulary Catalog"
          subtitle={`Showing ${filteredDrugs.length} registered pharmaceutical SKUs`}
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredDrugs}
            loading={loading}
            emptyMessage="No drug SKUs found matching search filters."
          />
        </CardBody>
      </Card>

      {/* Register Drug Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register Master Drug SKU"
        subtitle="Add a new therapeutic formulation to the national drug inventory registry"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Commercial Brand Name</label>
              <input
                type="text"
                required
                value={newDrug.name}
                onChange={(e) => setNewDrug({ ...newDrug, name: e.target.value })}
                placeholder="e.g. Propofol 1% IV Emulsion"
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Generic / Chemical Name</label>
              <input
                type="text"
                value={newDrug.generic_name}
                onChange={(e) => setNewDrug({ ...newDrug, generic_name: e.target.value })}
                placeholder="e.g. Propofol Injection"
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Therapeutic Category</label>
              <input
                type="text"
                required
                value={newDrug.category}
                onChange={(e) => setNewDrug({ ...newDrug, category: e.target.value })}
                placeholder="e.g. Anesthetics / ICU"
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Unit of Measure</label>
              <select
                value={newDrug.unit}
                onChange={(e) => setNewDrug({ ...newDrug, unit: e.target.value })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg"
              >
                <option value="vials">Vials</option>
                <option value="ampoules">Ampoules</option>
                <option value="bottles">Bottles</option>
                <option value="tablets">Tablets</option>
                <option value="syringes">Syringes</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Strength</label>
              <input
                type="text"
                value={newDrug.strength}
                onChange={(e) => setNewDrug({ ...newDrug, strength: e.target.value })}
                placeholder="e.g. 10 mg/ml"
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Storage Condition</label>
              <select
                value={newDrug.storage_temperature}
                onChange={(e) => setNewDrug({ ...newDrug, storage_temperature: e.target.value as any })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg"
              >
                <option value="ambient">Ambient (15°C - 25°C)</option>
                <option value="cold_chain_2_8">Cold-Chain (2°C - 8°C)</option>
                <option value="frozen">Frozen (&lt; -15°C)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Min. Safety Stock Buffer</label>
              <input
                type="number"
                min={10}
                value={newDrug.min_safety_stock}
                onChange={(e) => setNewDrug({ ...newDrug, min_safety_stock: Number(e.target.value) })}
                className="w-full p-2.5 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Clinical Description & Indications</label>
            <textarea
              rows={2}
              value={newDrug.description}
              onChange={(e) => setNewDrug({ ...newDrug, description: e.target.value })}
              placeholder="e.g. Short-acting intravenous anesthetic for ICU induction..."
              className="w-full p-2.5 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Register Formulation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
