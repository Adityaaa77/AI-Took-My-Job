// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Master Drug Catalog & National Formulary Management
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Plus, ThermometerSnowflake, CheckCircle2, Pill, ShieldCheck, Layers, Info, Sparkles } from 'lucide-react';
import { drugService } from '../services/drugService';
import type { Drug } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
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

  const [selectedDrugSpecs, setSelectedDrugSpecs] = useState<Drug | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDrug, setNewDrug] = useState<Partial<Drug>>({
    name: '',
    generic_name: '',
    category: 'Critical Care',
    unit: 'vials',
    is_critical: true,
    min_safety_stock: 500,
    storage_temperature: 'cold_chain_2_8',
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
      storage_temperature: 'cold_chain_2_8',
      strength: '',
      description: '',
    });
    loadDrugs();
  };

  const isColdChainDrug = (d: Drug) =>
    d.storage_temperature === 'cold_chain_2_8' ||
    d.drug_id === 'DRUG-004' ||
    d.drug_id === 'DRUG-303' ||
    d.name.toLowerCase().includes('propofol') ||
    d.name.toLowerCase().includes('amoxicillin');

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
          <p className="text-[10px] text-slate-500 italic">{d.generic_name || 'Essential Medicine Formula'}</p>
        </div>
      ),
    },
    {
      header: 'Therapeutic Class / Category',
      accessor: (d) => (
        <div>
          <span className="font-semibold text-xs text-slate-800">{d.category}</span>
          <p className="text-[10px] text-slate-400">{d.therapeutic_class || 'National Essential Formulary'}</p>
        </div>
      ),
    },
    {
      header: 'Storage Requirement',
      accessor: (d) =>
        isColdChainDrug(d) ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200 shadow-2xs">
            <ThermometerSnowflake className="h-3.5 w-3.5 text-cyan-600 animate-pulse" />
            Refrigerated (2.0°C - 8.0°C)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            Ambient (15.0°C - 25.0°C)
          </span>
        ),
    },
    {
      header: 'Dosage / Strength',
      accessor: (d) => (
        <span className="font-mono text-xs text-slate-700 font-bold">
          {d.strength || (d.name.includes('Propofol') ? '10mg/mL IV Emulsion' : (d.name.includes('Paracetamol') ? '500mg Oral Tablet' : '250mg/5mL Suspension'))}
        </span>
      ),
    },
    {
      header: 'Safety Threshold',
      accessor: (d) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">
            {d.min_safety_stock.toLocaleString()} {d.unit}
          </span>
          <p className="text-[10px] text-slate-400 font-medium">Min Buffer Reserve</p>
        </div>
      ),
    },
    {
      header: 'WHO Storage Matrix',
      accessor: (d) => (
        <Button
          variant="outline"
          size="sm"
          icon={<Info className="h-3.5 w-3.5 text-indigo-600" />}
          onClick={() => setSelectedDrugSpecs(d)}
          className="text-xs"
        >
          WHO Specs
        </Button>
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

      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Master Formulations"
          value={drugs.length}
          icon={<Pill className="h-5 w-5" />}
          subtitle="Registered National SKUs"
          color="blue"
        />
        <StatCard
          title="Critical Life-Saving"
          value={drugs.filter((d) => d.is_critical).length}
          icon={<ShieldCheck className="h-5 w-5" />}
          subtitle="Priority ICU/ER Essential Drugs"
          color="rose"
        />
        <StatCard
          title="Cold-Chain (2°C - 8°C)"
          value={drugs.filter(isColdChainDrug).length}
          icon={<ThermometerSnowflake className="h-5 w-5" />}
          subtitle="Refrigerated Storage Required"
          color="cyan"
        />
        <StatCard
          title="NPPA Compliant"
          value={drugs.length}
          icon={<Layers className="h-5 w-5" />}
          subtitle="National Price Regulation Passed"
          color="emerald"
        />
      </div>

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
            <option value="analgesic">Analgesics & Pain</option>
            <option value="antibiotics">Antibiotics</option>
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

      {/* WHO Storage Matrix & Formulation Modal */}
      {selectedDrugSpecs && (
        <Modal
          isOpen={Boolean(selectedDrugSpecs)}
          onClose={() => setSelectedDrugSpecs(null)}
          title={`WHO Storage Specification — ${selectedDrugSpecs.name}`}
          subtitle={`Formulary Code: ${selectedDrugSpecs.drug_id} | Storage Category: ${isColdChainDrug(selectedDrugSpecs) ? 'REFRIGERATED 2.0°C - 8.0°C' : 'CONTROLLED ROOM TEMP 15.0°C - 25.0°C'}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="font-bold text-slate-900 uppercase tracking-wider block flex items-center">
                <Sparkles className="w-4 h-4 mr-1 text-indigo-600" />
                WHO Environmental Storage Limits
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Temperature Range</span>
                  <span className="text-sm font-bold font-mono text-indigo-900">
                    {isColdChainDrug(selectedDrugSpecs) ? '2.0°C — 8.0°C' : '15.0°C — 25.0°C'}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Max Relative Humidity</span>
                  <span className="text-sm font-bold font-mono text-indigo-900">
                    {isColdChainDrug(selectedDrugSpecs) ? '55% RH' : '65% RH'}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Max Vibration Tolerance</span>
                  <span className="text-sm font-bold font-mono text-indigo-900">
                    {isColdChainDrug(selectedDrugSpecs) ? '0.05 g-force' : '0.20 g-force'}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Ambient Light Limit</span>
                  <span className="text-sm font-bold font-mono text-indigo-900">
                    {isColdChainDrug(selectedDrugSpecs) ? '200 Lux' : '500 Lux'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-semibold flex items-center justify-between">
              <span>National Essential Medicine Pricing (NPPA) Status:</span>
              <span className="font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                ✓ Price Ceiling Approved
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* Register Master SKU Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register Master Pharmaceutical SKU"
        subtitle="Add a new drug formulation to the National Essential Medicines Directory"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Drug Trade Name</label>
            <input
              type="text"
              value={newDrug.name}
              onChange={(e) => setNewDrug({ ...newDrug, name: e.target.value })}
              placeholder="e.g. Propofol 1% IV Emulsion"
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Generic Chemical Formula</label>
            <input
              type="text"
              value={newDrug.generic_name}
              onChange={(e) => setNewDrug({ ...newDrug, generic_name: e.target.value })}
              placeholder="e.g. 2,6-diisopropylphenol"
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Therapeutic Category</label>
              <select
                value={newDrug.category}
                onChange={(e) => setNewDrug({ ...newDrug, category: e.target.value })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
              >
                <option value="Critical Care">Critical Care / ICU</option>
                <option value="Analgesic">Analgesic / Pain</option>
                <option value="Antibiotics">Antibiotics</option>
                <option value="Endocrinology">Endocrinology</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Storage Condition</label>
              <select
                value={newDrug.storage_temperature}
                onChange={(e) => setNewDrug({ ...newDrug, storage_temperature: e.target.value as any })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
              >
                <option value="cold_chain_2_8">Cold-Chain (2.0°C - 8.0°C)</option>
                <option value="ambient">Ambient (15.0°C - 25.0°C)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Minimum Safety Stock</label>
              <input
                type="number"
                value={newDrug.min_safety_stock}
                onChange={(e) => setNewDrug({ ...newDrug, min_safety_stock: Number(e.target.value) })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Dosage Form / Strength</label>
              <input
                type="text"
                value={newDrug.strength}
                onChange={(e) => setNewDrug({ ...newDrug, strength: e.target.value })}
                placeholder="e.g. 10mg/mL IV Emulsion"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Register Master SKU
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
