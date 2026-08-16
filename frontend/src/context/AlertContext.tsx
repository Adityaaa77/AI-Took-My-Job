// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// AlertContext: Real-Time Alerts, Notification Center & Incident Dispatcher
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Alert } from '../types';
import { alertService } from '../services/alertService';

interface AlertContextType {
  alerts: Alert[];
  unresolvedAlerts: Alert[];
  criticalCount: number;
  unreadCount: number;
  loading: boolean;
  refreshAlerts: () => Promise<void>;
  resolveAlert: (id: string, notes?: string) => Promise<void>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const res = await alertService.getAllAlerts();
    if (res.data) {
      setAlerts(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const unresolvedAlerts = alerts.filter((a) => !a.is_resolved);
  const criticalCount = unresolvedAlerts.filter((a) => a.severity === 'critical').length;
  const unreadCount = unresolvedAlerts.length;

  const resolveAlert = async (id: string, notes?: string) => {
    await alertService.resolveAlert(id, notes);
    setAlerts((prev) =>
      prev.map((a) => (a._id === id || a.alert_id === id ? { ...a, is_resolved: true } : a))
    );
  };

  return (
    <AlertContext.Provider
      value={{
        alerts,
        unresolvedAlerts,
        criticalCount,
        unreadCount,
        loading,
        refreshAlerts: fetchAlerts,
        resolveAlert,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
};
