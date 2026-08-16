import { ApiService } from './api';
import type { Hospital, Warehouse, Vendor } from '../types';
import { MOCK_HOSPITALS, MOCK_WAREHOUSES, MOCK_VENDORS } from './mockData';

let localHospitals: Hospital[] = [...MOCK_HOSPITALS];
let localWarehouses: Warehouse[] = [...MOCK_WAREHOUSES];
let localVendors: Vendor[] = [...MOCK_VENDORS];

export const networkService = {
  async getAllHospitals(params?: { tier?: string; location_zone?: string }) {
    let filtered = [...localHospitals];
    if (params?.tier) {
      filtered = filtered.filter((h) => h.tier === params.tier);
    }
    if (params?.location_zone) {
      filtered = filtered.filter((h) => h.location_zone.includes(params.location_zone!));
    }
    return ApiService.get<Hospital[]>('/hospitals', filtered);
  },

  async getAllWarehouses(params?: { location_zone?: string }) {
    let filtered = [...localWarehouses];
    if (params?.location_zone) {
      filtered = filtered.filter((w) => w.location_zone.includes(params.location_zone!));
    }
    return ApiService.get<Warehouse[]>('/warehouses', filtered);
  },

  async getAllVendors(params?: { is_active?: boolean }) {
    let filtered = [...localVendors];
    if (params?.is_active !== undefined) {
      filtered = filtered.filter((v) => v.is_active === params.is_active);
    }
    return ApiService.get<Vendor[]>('/vendors', filtered);
  },

  async createHospital(hosp: Partial<Hospital>) {
    const newHosp: Hospital = {
      _id: `h_${Date.now()}`,
      hospital_id: hosp.hospital_id || `HOSP-00${localHospitals.length + 1}`,
      name: hosp.name || '',
      tier: hosp.tier || 'Tier-2',
      location_zone: hosp.location_zone || 'Zone-North',
      address: hosp.address,
      contact_person: hosp.contact_person,
      contact_phone: hosp.contact_phone,
      contact_email: hosp.contact_email,
      bed_capacity: hosp.bed_capacity || 500,
    };
    localHospitals = [...localHospitals, newHosp];
    return ApiService.post<Hospital>('/hospitals', hosp, newHosp);
  },

  async createWarehouse(wh: Partial<Warehouse>) {
    const newWh: Warehouse = {
      _id: `w_${Date.now()}`,
      warehouse_id: wh.warehouse_id || `WH-00${localWarehouses.length + 1}`,
      name: wh.name || '',
      location_zone: wh.location_zone || 'Zone-North',
      capacity: wh.capacity || 100000,
      used_capacity: 0,
      address: wh.address,
      cold_storage_available: wh.cold_storage_available ?? true,
    };
    localWarehouses = [...localWarehouses, newWh];
    return ApiService.post<Warehouse>('/warehouses', wh, newWh);
  },

  async createVendor(vend: Partial<Vendor>) {
    const newVend: Vendor = {
      _id: `v_${Date.now()}`,
      vendor_id: vend.vendor_id || `VEND-00${localVendors.length + 1}`,
      name: vend.name || '',
      avg_lead_time_days: vend.avg_lead_time_days || 4,
      reliability_score: vend.reliability_score || 95,
      contact_email: vend.contact_email || 'info@vendor.com',
      contact_phone: vend.contact_phone,
      address: vend.address,
      is_active: true,
      active_orders_count: 0,
      compliance_certified: vend.compliance_certified ?? true,
    };
    localVendors = [...localVendors, newVend];
    return ApiService.post<Vendor>('/vendors', vend, newVend);
  },
};
