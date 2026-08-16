import { ApiService } from './api';
import type { InventoryItem, Batch, LowStockItem } from '../types';
import { MOCK_INVENTORY, MOCK_BATCHES } from './mockData';

let localInventory: InventoryItem[] = [...MOCK_INVENTORY];
let localBatches: Batch[] = [...MOCK_BATCHES];

export const inventoryService = {
  async getAllInventory(params?: { location_id?: string; location_type?: string }) {
    let filtered = [...localInventory];
    if (params?.location_id) {
      filtered = filtered.filter((i) => i.location_id === params.location_id);
    }
    if (params?.location_type) {
      filtered = filtered.filter((i) => i.location_type === params.location_type);
    }

    const queryStr = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    const res = await ApiService.get<InventoryItem[]>(`/inventory${queryStr}`, filtered);
    if (res.success && res.data && !res.isMock) {
      localInventory = res.data;
    }
    return res;
  },

  async getLowStockItems() {
    const lowStock: LowStockItem[] = localInventory
      .filter((inv) => inv.available_stock < (inv.drug_id?.min_safety_stock ?? 0))
      .map((inv) => ({
        location_id: inv.location_id,
        location_type: inv.location_type,
        available_stock: inv.available_stock,
        reserved_stock: inv.reserved_stock,
        incoming_stock: inv.incoming_stock,
        drug: {
          drug_id: inv.drug_id.drug_id,
          name: inv.drug_id.name,
          is_critical: inv.drug_id.is_critical,
          min_safety_stock: inv.drug_id.min_safety_stock,
        },
        shortage: inv.drug_id.min_safety_stock - inv.available_stock,
      }));

    return ApiService.get<LowStockItem[]>('/inventory/low-stock', lowStock);
  },

  async getAllBatches(params?: { location_id?: string; quality_status?: string }) {
    let filtered = [...localBatches];
    if (params?.location_id) {
      filtered = filtered.filter((b) => b.location_id === params.location_id);
    }
    if (params?.quality_status) {
      filtered = filtered.filter((b) => b.quality_status === params.quality_status);
    }
    return ApiService.get<Batch[]>('/batches', filtered);
  },

  async updateStock(
    location_id: string,
    drug_id: string,
    change: { available_stock?: number; reserved_stock?: number; incoming_stock?: number }
  ) {
    const idx = localInventory.findIndex(
      (inv) =>
        inv.location_id === location_id &&
        (typeof inv.drug_id === 'string' ? inv.drug_id === drug_id : inv.drug_id.drug_id === drug_id || inv.drug_id._id === drug_id)
    );

    if (idx !== -1) {
      localInventory[idx] = {
        ...localInventory[idx],
        ...change,
        last_updated: new Date().toISOString(),
      };
      return ApiService.patch<InventoryItem>(`/inventory/${localInventory[idx]._id}`, change, localInventory[idx]);
    }
    return ApiService.post<InventoryItem>('/inventory', { location_id, drug_id, ...change }, localInventory[0]);
  },

  async transferStock(fromLocation: string, toLocation: string, drug_id: string, quantity: number) {
    const sourceIdx = localInventory.findIndex(
      (inv) =>
        inv.location_id === fromLocation &&
        (typeof inv.drug_id === 'string' ? inv.drug_id === drug_id : inv.drug_id.drug_id === drug_id || inv.drug_id._id === drug_id)
    );
    if (sourceIdx !== -1) {
      localInventory[sourceIdx].available_stock = Math.max(0, localInventory[sourceIdx].available_stock - quantity);
    }

    const destIdx = localInventory.findIndex(
      (inv) =>
        inv.location_id === toLocation &&
        (typeof inv.drug_id === 'string' ? inv.drug_id === drug_id : inv.drug_id.drug_id === drug_id || inv.drug_id._id === drug_id)
    );
    if (destIdx !== -1) {
      localInventory[destIdx].available_stock += quantity;
    }

    return {
      success: true,
      message: `Successfully transferred ${quantity} units from ${fromLocation} to ${toLocation}`,
    };
  },

  async updateBatchQuality(batch_id: string, quality_status: 'passed' | 'quarantine' | 'failed', notes?: string) {
    const idx = localBatches.findIndex((b) => b.batch_id === batch_id || b._id === batch_id);
    if (idx !== -1) {
      localBatches[idx].quality_status = quality_status;
      if (notes) localBatches[idx].inspection_notes = notes;
    }
    return { success: true, data: localBatches[idx] };
  },
};
