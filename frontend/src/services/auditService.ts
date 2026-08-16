import { ApiService } from './api';
import type { AuditLog } from '../types';
import { MOCK_AUDIT_LOGS } from './mockData';

let localAuditLogs: AuditLog[] = [...MOCK_AUDIT_LOGS];

export const auditService = {
  async getAllLogs(params?: { entity_type?: string; action?: string }) {
    let filtered = [...localAuditLogs];
    if (params?.entity_type) {
      filtered = filtered.filter((l) => l.entity_type === params.entity_type);
    }
    if (params?.action) {
      filtered = filtered.filter((l) => l.action.toLowerCase().includes(params.action!.toLowerCase()));
    }
    return ApiService.get<AuditLog[]>('/audit-logs', filtered);
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
      blockchain_tx_hash: actionData.blockchain_tx_hash,
      is_blockchain_verified: !!actionData.blockchain_tx_hash,
      createdAt: new Date().toISOString(),
    };
    localAuditLogs = [newLog, ...localAuditLogs];
    return { success: true, data: newLog };
  },
};
