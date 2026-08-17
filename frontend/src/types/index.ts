// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Central Type System Architecture
// ============================================================================

export type UserRole =
  | 'admin'
  | 'procurement_officer'
  | 'warehouse_manager'
  | 'hospital_staff'
  | 'vendor'
  | 'compliance_officer';

export type EntityType = 'central' | 'warehouse' | 'hospital' | 'vendor';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle?: string;
  associated_entity_id?: string;
  associated_entity_type?: EntityType;
  is_active: boolean;
}

// ─── Master Drugs ───────────────────────────────────────────────────────────

export type StorageTemperature = 'ambient' | 'cold_chain_2_8' | 'frozen';

export interface Drug {
  _id?: string;
  drug_id: string;
  name: string;
  generic_name?: string;
  category: string;
  unit: string;
  is_critical: boolean;
  min_safety_stock: number;
  description?: string;
  storage_temperature?: StorageTemperature;
  therapeutic_class?: string;
  dosage_form?: string;
  strength?: string;
  createdAt?: string;
}

// ─── Batches & QA ───────────────────────────────────────────────────────────

export type QualityStatus = 'passed' | 'quarantine' | 'failed';

export interface Batch {
  _id?: string;
  batch_id: string;
  drug_id: Drug | string;
  location_id: string;
  location_type: 'warehouse' | 'hospital';
  manufacturer: string;
  quantity: number;
  manufacturing_date: string;
  expiry_date: string;
  quality_status: QualityStatus;
  inspection_notes?: string;
  createdAt?: string;
}

// ─── Hospitals, Warehouses & Vendors ────────────────────────────────────────

export interface Hospital {
  _id?: string;
  hospital_id: string;
  name: string;
  tier: 'Tier-1' | 'Tier-2' | 'Tier-3';
  location_zone: string;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  bed_capacity?: number;
  icu_beds?: number;
}

export interface Warehouse {
  _id?: string;
  warehouse_id: string;
  name: string;
  location_zone: string;
  capacity: number;
  used_capacity?: number;
  address?: string;
  manager_user_id?: string;
  cold_storage_available?: boolean;
}

export interface Vendor {
  _id?: string;
  vendor_id: string;
  name: string;
  avg_lead_time_days: number;
  reliability_score: number;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  is_active: boolean;
  active_orders_count?: number;
  compliance_certified?: boolean;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export type LocationType = 'warehouse' | 'hospital';

export interface InventoryItem {
  _id?: string;
  location_id: string;
  location_type: LocationType;
  drug_id: Drug;
  available_stock: number;
  reserved_stock: number;
  incoming_stock: number;
  expired_stock: number;
  last_updated?: string;
  reorder_level?: number;
}

export interface LowStockItem {
  location_id: string;
  location_type: LocationType;
  available_stock: number;
  reserved_stock: number;
  incoming_stock: number;
  drug: {
    drug_id: string;
    name: string;
    is_critical: boolean;
    min_safety_stock: number;
  };
  shortage: number;
}

// ─── Procurement & Purchase Orders ──────────────────────────────────────────

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'ordered'
  | 'shipped'
  | 'partially_received'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export interface PurchaseOrder {
  _id?: string;
  order_id: string;
  vendor_id: Vendor | string;
  drug_id: Drug | string;
  quantity: number;
  unit_price?: number;
  total_amount?: number;
  destination_location_id: string;
  destination_location_type: LocationType;
  expected_delivery: string;
  actual_delivery?: string;
  status: PurchaseOrderStatus;
  created_by?: User | string;
  approved_by?: User | string;
  notes?: string;
  blockchain_tx_hash?: string;
  createdAt?: string;
}

// ─── Shipments & Logistics ──────────────────────────────────────────────────

export type ShipmentStatus =
  | 'preparing'
  | 'dispatched'
  | 'in_transit'
  | 'delayed'
  | 'delivered'
  | 'cancelled';

export interface ShipmentMilestone {
  stage: string;
  location: string;
  timestamp: string;
  status: 'completed' | 'current' | 'pending';
  temperature?: number;
  note?: string;
}

export interface Shipment {
  _id?: string;
  shipment_id: string;
  order_id: PurchaseOrder | string;
  origin_id: string;
  origin_type: 'warehouse' | 'vendor' | 'hospital';
  destination_id: string;
  destination_type: 'warehouse' | 'hospital';
  drug_id: Drug | string;
  quantity: number;
  status: ShipmentStatus;
  estimated_arrival: string;
  actual_arrival?: string;
  carrier_name?: string;
  tracking_number?: string;
  tracking_note?: string;
  temperature_log?: number[];
  milestones?: ShipmentMilestone[];
  blockchain_tx_hash?: string;
  createdAt: string;
}

// ─── Hospital Consumption ───────────────────────────────────────────────────

export interface ConsumptionRecord {
  _id?: string;
  hospital_id: string;
  drug_id: Drug | string;
  batch_id?: string;
  period_start: string;
  period_end: string;
  quantity_consumed: number;
  daily_avg_consumption?: number;
  is_anomaly: boolean;
  anomaly_reason?: string;
  recorded_by?: User | string;
  notes?: string;
  createdAt: string;
}

// ─── Replenishment & Allocations ────────────────────────────────────────────

export type ReplenishmentStatus =
  | 'pending'
  | 'approved'
  | 'allocated'
  | 'dispatched'
  | 'received'
  | 'rejected';

export interface ReplenishmentRequest {
  _id?: string;
  request_id: string;
  hospital_id: string;
  hospital_name?: string;
  drug_id: Drug | string;
  requested_quantity: number;
  approved_quantity?: number;
  urgency: 'standard' | 'urgent' | 'critical';
  reason?: string;
  attached_image?: string;
  image_hash?: string;
  status: ReplenishmentStatus;
  allocated_from?: string;
  shipment_id?: string;
  requested_by?: string;
  createdAt: string;
}

// ─── Alerts & Incidents ──────────────────────────────────────────────────────

export type AlertType =
  | 'low_stock'
  | 'critical_stock'
  | 'stockout'
  | 'expiry_warning'
  | 'expiring_drug'
  | 'expired_drug'
  | 'vendor_delay'
  | 'shipment_delay'
  | 'unusual_consumption'
  | 'pending_approval'
  | 'quality_issue'
  | 'temperature_excursion';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
  _id?: string;
  alert_id?: string;
  alert_type: AlertType;
  severity: SeverityLevel;
  drug_id?: Drug | string;
  location_id?: string;
  message: string;
  is_resolved: boolean;
  resolved_by?: User | string;
  resolved_at?: string;
  resolution_notes?: string;
  createdAt: string;
}

// ─── Audit Trail & Blockchain Verification ───────────────────────────────────

export interface AuditLog {
  _id?: string;
  action: string;
  performed_by: User | { name: string; role: string } | string;
  entity_type: string;
  entity_id: string;
  changes?: Record<string, { before: unknown; after: unknown }> | Record<string, unknown>;
  ip_address?: string;
  blockchain_tx_hash?: string;
  is_blockchain_verified?: boolean;
  createdAt: string;
}

export interface BlockchainRecord {
  tx_hash: string;
  block_number: number;
  timestamp: string;
  event_type: 'PO_CREATED' | 'SHIPMENT_DISPATCHED' | 'SHIPMENT_DELIVERED' | 'BATCH_QUARANTINED' | 'AI_RECOMMENDATION_APPROVED' | 'STOCK_REDISTRIBUTED';
  actor: string;
  actor_role: string;
  entity_id: string;
  entity_type: string;
  payload_hash: string;
  gas_used: string;
  is_verified: boolean;
  block_explorer_url?: string;
}

// ─── AI Decision Center & Multi-Agent Layer ──────────────────────────────────

export interface AgentFinding {
  agent_name: 'DemandAgent' | 'InventoryAgent' | 'DistributionAgent' | 'ProcurementAgent' | 'VendorAgent' | 'ComplianceAgent' | 'CoordinatorAgent' | string;
  finding_type: string;
  severity: SeverityLevel;
  target_drug_id: string;
  target_drug_name?: string;
  target_location_id?: string;
  description: string;
  metrics?: Record<string, string | number | boolean>;
}

export interface ActionRecommendation {
  action_type: 'redistribute' | 'procure' | 'quarantine' | 'expedite' | 'adjust_safety_stock';
  target_drug_id: string;
  target_drug_name?: string;
  source_location_id?: string;
  destination_location_id?: string;
  recommended_quantity: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  confidence: number;
}

export interface AIRecommendation {
  _id?: string;
  recommendation_id: string;
  snapshot_id: string;
  overall_risk_level: 'low' | 'medium' | 'high' | 'critical';
  agent_findings: AgentFinding[];
  recommended_actions: ActionRecommendation[];
  requires_human_approval: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: User | string;
  approved_at?: string;
  rejection_reason?: string;
  createdAt: string;
}
