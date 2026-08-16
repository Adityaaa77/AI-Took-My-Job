import { ApiService } from './api';
import type { Drug } from '../types';
import { MOCK_DRUGS } from './mockData';

let localDrugs: Drug[] = [...MOCK_DRUGS];

export const drugService = {
  async getAllDrugs(params?: { category?: string; is_critical?: boolean; search?: string }) {
    let filtered = [...localDrugs];
    if (params?.category) {
      filtered = filtered.filter((d) => d.category.toLowerCase().includes(params.category!.toLowerCase()));
    }
    if (params?.is_critical !== undefined) {
      filtered = filtered.filter((d) => d.is_critical === params.is_critical);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.drug_id.toLowerCase().includes(q) ||
          (d.generic_name && d.generic_name.toLowerCase().includes(q))
      );
    }

    const queryStr = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    const res = await ApiService.get<Drug[]>(`/drugs${queryStr}`, filtered);
    if (!res.isMock && res.data) {
      localDrugs = res.data;
    }
    return res;
  },

  async getDrugById(id: string) {
    const fallback = localDrugs.find((d) => d.drug_id === id || d._id === id);
    return ApiService.get<Drug>(`/drugs/${id}`, fallback);
  },

  async createDrug(drug: Partial<Drug>) {
    const newDrug: Drug = {
      _id: `d_${Date.now()}`,
      drug_id: drug.drug_id || `DRUG-00${localDrugs.length + 1}`,
      name: drug.name || '',
      generic_name: drug.generic_name,
      category: drug.category || 'General',
      unit: drug.unit || 'units',
      is_critical: drug.is_critical || false,
      min_safety_stock: drug.min_safety_stock || 100,
      description: drug.description,
      storage_temperature: drug.storage_temperature || 'ambient',
      strength: drug.strength,
      createdAt: new Date().toISOString(),
    };
    localDrugs = [newDrug, ...localDrugs];
    return ApiService.post<Drug>('/drugs', drug, newDrug);
  },

  async updateDrug(id: string, updates: Partial<Drug>) {
    const idx = localDrugs.findIndex((d) => d.drug_id === id || d._id === id);
    if (idx !== -1) {
      localDrugs[idx] = { ...localDrugs[idx], ...updates };
    }
    return ApiService.patch<Drug>(`/drugs/${id}`, updates, localDrugs[idx]);
  },
};
