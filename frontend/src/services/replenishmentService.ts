import { ApiService } from './api';
import type { ReplenishmentRequest, ReplenishmentStatus } from '../types';
import { MOCK_REPLENISHMENTS, MOCK_DRUGS } from './mockData';

let localReplenishments: ReplenishmentRequest[] = [...MOCK_REPLENISHMENTS];

export const replenishmentService = {
  async getAllRequests(params?: { hospital_id?: string; status?: string }) {
    let filtered = [...localReplenishments];
    if (params?.hospital_id && params.hospital_id !== 'all') {
      filtered = filtered.filter((r) => r.hospital_id === params.hospital_id);
    }
    if (params?.status && params.status !== 'all') {
      filtered = filtered.filter((r) => r.status === params.status);
    }

    const queryStr = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== 'all')
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    const res = await ApiService.get<ReplenishmentRequest[]>(`/replenishments${queryStr}`, filtered);
    if (res.success && res.data && !res.isMock) {
      localReplenishments = res.data;
    }
    return res;
  },

  async createRequest(reqData: Partial<ReplenishmentRequest>) {
    const drugObj =
      typeof reqData.drug_id === 'string'
        ? MOCK_DRUGS.find((d) => d.drug_id === reqData.drug_id || d._id === reqData.drug_id) || MOCK_DRUGS[0]
        : reqData.drug_id || MOCK_DRUGS[0];

    const newReq: ReplenishmentRequest = {
      _id: `req_${Date.now()}`,
      request_id: `REQ-2026-0${100 + localReplenishments.length + 1}`,
      hospital_id: reqData.hospital_id || 'HOSP-001',
      hospital_name: reqData.hospital_name || 'AIIMS New Delhi',
      drug_id: drugObj,
      requested_quantity: reqData.requested_quantity || 100,
      urgency: reqData.urgency || 'standard',
      reason: reqData.reason,
      status: 'pending',
      requested_by: 'Hospital Pharmacy Staff',
      createdAt: new Date().toISOString(),
    };

    const res = await ApiService.post<ReplenishmentRequest>('/replenishments', reqData, newReq);
    if (res.success && res.data && !res.isMock) {
      localReplenishments = [res.data, ...localReplenishments];
    }
    return res;
  },

  async updateRequestStatus(id: string, status: ReplenishmentStatus, allocated_from?: string) {
    const idx = localReplenishments.findIndex((r) => r.request_id === id || r._id === id);
    if (idx !== -1) {
      localReplenishments[idx] = {
        ...localReplenishments[idx],
        status,
        ...(allocated_from && { allocated_from }),
        ...(status === 'approved' && { approved_quantity: localReplenishments[idx].requested_quantity }),
      };
    }
    const fallback = idx !== -1 ? localReplenishments[idx] : undefined;
    return ApiService.patch<ReplenishmentRequest>(`/replenishments/${id}/status`, { status, allocated_from }, fallback);
  },
};
