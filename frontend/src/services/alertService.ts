import { ApiService } from './api';
import type { Alert, SeverityLevel } from '../types';
import { MOCK_ALERTS, MOCK_USERS } from './mockData';

let localAlerts: Alert[] = [...MOCK_ALERTS];

export const alertService = {
  async getAllAlerts(params?: { is_resolved?: boolean; severity?: SeverityLevel; alert_type?: string }) {
    let filtered = [...localAlerts];
    if (params?.is_resolved !== undefined) {
      filtered = filtered.filter((a) => a.is_resolved === params.is_resolved);
    }
    if (params?.severity) {
      filtered = filtered.filter((a) => a.severity === params.severity);
    }
    if (params?.alert_type) {
      filtered = filtered.filter((a) => a.alert_type === params.alert_type);
    }

    const queryStr = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    return ApiService.get<Alert[]>(`/alerts${queryStr}`, filtered);
  },

  async createAlert(alertData: Partial<Alert>) {
    const newAlert: Alert = {
      _id: `alt_${Date.now()}`,
      alert_id: `ALT-2026-0${90 + localAlerts.length + 1}`,
      alert_type: alertData.alert_type || 'low_stock',
      severity: alertData.severity || 'medium',
      drug_id: alertData.drug_id,
      location_id: alertData.location_id,
      message: alertData.message || 'System alert triggered.',
      is_resolved: false,
      createdAt: new Date().toISOString(),
    };
    localAlerts = [newAlert, ...localAlerts];
    return ApiService.post<Alert>('/alerts', alertData, newAlert);
  },

  async resolveAlert(id: string, notes?: string) {
    const idx = localAlerts.findIndex((a) => a._id === id || a.alert_id === id);
    if (idx !== -1) {
      localAlerts[idx] = {
        ...localAlerts[idx],
        is_resolved: true,
        resolved_by: MOCK_USERS.admin,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes || 'Resolved via operator action.',
      };
      return ApiService.patch<Alert>(`/alerts/${id}/resolve`, { resolution_notes: notes }, localAlerts[idx]);
    }
    return { success: false, data: null as unknown as Alert };
  },
};
