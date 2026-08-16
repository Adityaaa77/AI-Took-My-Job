// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Master Application Router & Context Providers
// ============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { AppLayout } from './components/layout/AppLayout';
import { RoleGuard } from './components/layout/RoleGuard';

// Domain Pages
import { DashboardPage } from './pages/DashboardPage';
import { SupplyChainTrackingPage } from './pages/SupplyChainTrackingPage';
import { AIDecisionCenterPage } from './pages/AIDecisionCenterPage';
import { BlockchainLedgerPage } from './pages/BlockchainLedgerPage';
import { InventoryPage } from './pages/InventoryPage';
import { DrugsPage } from './pages/DrugsPage';
import { BatchesPage } from './pages/BatchesPage';
import { ProcurementPage } from './pages/ProcurementPage';
import { ShipmentsPage } from './pages/ShipmentsPage';
import { HospitalConsumptionPage } from './pages/HospitalConsumptionPage';
import { ReplenishmentPage } from './pages/ReplenishmentPage';
import { AlertsPage } from './pages/AlertsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { NetworkDirectoryPage } from './pages/NetworkDirectoryPage';
import { LoginPage } from './pages/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AlertProvider>
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Application Routes wrapped in AppLayout Shell */}
            <Route
              path="/"
              element={
                <RoleGuard>
                  <AppLayout />
                </RoleGuard>
              }
            >
              {/* Executive Dashboard (Adaptive for all 6 roles) */}
              <Route index element={<DashboardPage />} />

              {/* End-to-End Tracking Pipeline */}
              <Route path="tracking" element={<SupplyChainTrackingPage />} />

              {/* Layer 2: AI Multi-Agent Decision Center */}
              <Route path="ai-decisions" element={<AIDecisionCenterPage />} />

              {/* Layer 3: Blockchain Cryptographic Ledger */}
              <Route path="blockchain-ledger" element={<BlockchainLedgerPage />} />

              {/* Core Inventory & Master Data */}
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="drugs" element={<DrugsPage />} />
              <Route path="batches" element={<BatchesPage />} />

              {/* Procurement & Logistics */}
              <Route path="procurement" element={<ProcurementPage />} />
              <Route path="shipments" element={<ShipmentsPage />} />

              {/* Hospital Consumption & Replenishment */}
              <Route path="consumption" element={<HospitalConsumptionPage />} />
              <Route path="replenishment" element={<ReplenishmentPage />} />

              {/* Alerts, Audit & Healthcare Network */}
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="audit-log" element={<AuditLogPage />} />
              <Route path="network" element={<NetworkDirectoryPage />} />
            </Route>

            {/* Fallback Catch-all Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AlertProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
