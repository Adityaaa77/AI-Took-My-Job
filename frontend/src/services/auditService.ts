import { ApiService } from './api';
import type { AuditLog } from '../types';
import { MOCK_AUDIT_LOGS } from './mockData';

let localAuditLogs: AuditLog[] = [...MOCK_AUDIT_LOGS];

export const auditService = {
  async getAllLogs(params?: { entity_type?: string; action?: string; search?: string }) {
    let filtered = [...localAuditLogs];
    if (params?.entity_type && params.entity_type !== 'all') {
      filtered = filtered.filter((l) => l.entity_type === params.entity_type);
    }
    if (params?.action && params.action !== 'all') {
      filtered = filtered.filter((l) => l.action.toLowerCase().includes(params.action!.toLowerCase()));
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q) ||
          l.entity_id.toLowerCase().includes(q)
      );
    }

    const queryStr = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== 'all')
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    const res = await ApiService.get<AuditLog[]>(`/audit-logs${queryStr}`, filtered);
    if (res.success && res.data && !res.isMock) {
      localAuditLogs = res.data;
    }
    return res;
  },

  async logAction(actionData: Partial<AuditLog>) {
    const newLog: AuditLog = {
      _id: `aud_${Date.now()}`,
      action: actionData.action || 'SYSTEM_ACTION',
      performed_by: actionData.performed_by || { name: 'System Automated Daemon', role: 'system' },
      entity_type: actionData.entity_type || 'System',
      entity_id: actionData.entity_id || 'SYS-001',
      changes: actionData.changes,
      ip_address: actionData.ip_address || '127.0.0.1',
      createdAt: new Date().toISOString(),
    };
    localAuditLogs = [newLog, ...localAuditLogs];
    return { success: true, data: newLog };
  },
};
