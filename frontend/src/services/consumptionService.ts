import { ApiService } from './api';
import type { ConsumptionRecord } from '../types';
import { MOCK_CONSUMPTION, MOCK_DRUGS, MOCK_USERS } from './mockData';

let localConsumption: ConsumptionRecord[] = [...MOCK_CONSUMPTION];

export const consumptionService = {
  async getAllConsumption(params?: { hospital_id?: string; is_anomaly?: boolean }) {
    let filtered = [...localConsumption];
    if (params?.hospital_id) {
      filtered = filtered.filter((c) => c.hospital_id === params.hospital_id);
    }
    if (params?.is_anomaly !== undefined) {
      filtered = filtered.filter((c) => c.is_anomaly === params.is_anomaly);
    }

    const queryStr = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    return ApiService.get<ConsumptionRecord[]>(`/consumption${queryStr}`, filtered);
  },

  async getConsumptionByHospital(hospital_id: string) {
    const filtered = localConsumption.filter((c) => c.hospital_id === hospital_id);
    return ApiService.get<ConsumptionRecord[]>(`/consumption/hospital/${hospital_id}`, filtered);
  },

  async recordConsumption(data: Partial<ConsumptionRecord>) {
    const drugObj =
      typeof data.drug_id === 'string'
        ? MOCK_DRUGS.find((d) => d.drug_id === data.drug_id || d._id === data.drug_id) || MOCK_DRUGS[0]
        : data.drug_id || MOCK_DRUGS[0];

    const quantity = data.quantity_consumed || 10;
    const dailyAvg = data.daily_avg_consumption || quantity;
    const isAnomaly = data.is_anomaly ?? dailyAvg > 45;

    const newRecord: ConsumptionRecord = {
      _id: `c_${Date.now()}`,
      hospital_id: data.hospital_id || 'HOSP-001',
      drug_id: drugObj,
      batch_id: data.batch_id || 'BATCH-PRO-2026-112',
      period_start: data.period_start || new Date(Date.now() - 86400000).toISOString(),
      period_end: data.period_end || new Date().toISOString(),
      quantity_consumed: quantity,
      daily_avg_consumption: dailyAvg,
      is_anomaly: isAnomaly,
      anomaly_reason: isAnomaly ? 'Unusual spike detected: consumption exceeds normal baseline threshold.' : undefined,
      recorded_by: MOCK_USERS.hospital_staff,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    localConsumption = [newRecord, ...localConsumption];
    return ApiService.post<ConsumptionRecord>('/consumption', data, newRecord);
  },
};
