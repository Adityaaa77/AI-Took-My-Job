import { ApiService } from './api';
import type { Shipment, ShipmentStatus } from '../types';
import { MOCK_SHIPMENTS, MOCK_DRUGS, MOCK_PURCHASE_ORDERS } from './mockData';

let localShipments: Shipment[] = [...MOCK_SHIPMENTS];

export const shipmentService = {
  async getAllShipments(params?: { status?: string; destination_id?: string; origin_id?: string }) {
    let filtered = [...localShipments];
    if (params?.status) {
      filtered = filtered.filter((s) => s.status === params.status);
    }
    if (params?.destination_id) {
      filtered = filtered.filter((s) => s.destination_id.includes(params.destination_id!));
    }
    if (params?.origin_id) {
      filtered = filtered.filter((s) => s.origin_id.includes(params.origin_id!));
    }

    const queryStr = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    return ApiService.get<Shipment[]>(`/shipments${queryStr}`, filtered);
  },

  async getShipmentById(id: string) {
    const fallback = localShipments.find((s) => s.shipment_id === id || s._id === id);
    return ApiService.get<Shipment>(`/shipments/${id}`, fallback);
  },

  async createShipment(shipmentData: Partial<Shipment>) {
    const drugObj =
      typeof shipmentData.drug_id === 'string'
        ? MOCK_DRUGS.find((d) => d.drug_id === shipmentData.drug_id || d._id === shipmentData.drug_id) || MOCK_DRUGS[0]
        : shipmentData.drug_id || MOCK_DRUGS[0];

    const newShipment: Shipment = {
      _id: `shp_${Date.now()}`,
      shipment_id: `SHP-2026-0${420 + localShipments.length + 1}`,
      order_id: shipmentData.order_id || MOCK_PURCHASE_ORDERS[0],
      origin_id: shipmentData.origin_id || 'WH-001 (CMSS North Hub)',
      origin_type: shipmentData.origin_type || 'warehouse',
      destination_id: shipmentData.destination_id || 'HOSP-001 (AIIMS New Delhi)',
      destination_type: shipmentData.destination_type || 'hospital',
      drug_id: drugObj,
      quantity: shipmentData.quantity || 500,
      status: 'preparing',
      estimated_arrival: shipmentData.estimated_arrival || new Date(Date.now() + 2 * 86400000).toISOString(),
      carrier_name: shipmentData.carrier_name || 'Express Logistics Service',
      tracking_number: `TRK-${Math.floor(1000000 + Math.random() * 9000000)}`,
      tracking_note: shipmentData.tracking_note || 'Order packaging initialized at dispatch dock.',
      temperature_log: [4.2, 4.3, 4.1],
      blockchain_tx_hash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      createdAt: new Date().toISOString(),
      milestones: [
        {
          stage: 'Shipment Created & Dock Assigned',
          location: shipmentData.origin_id || 'Facility Dispatch Dock',
          timestamp: new Date().toISOString(),
          status: 'completed',
        },
        {
          stage: 'Carrier Picked Up / Dispatched',
          location: 'Origin Terminal',
          timestamp: new Date(Date.now() + 3600000).toISOString(),
          status: 'current',
        },
        {
          stage: 'Destination Receiving & Verification',
          location: shipmentData.destination_id || 'Destination Depot',
          timestamp: shipmentData.estimated_arrival || new Date(Date.now() + 86400000).toISOString(),
          status: 'pending',
        },
      ],
    };

    localShipments = [newShipment, ...localShipments];
    return ApiService.post<Shipment>('/shipments', shipmentData, newShipment);
  },

  async updateShipmentStatus(id: string, status: ShipmentStatus, tracking_note?: string) {
    const idx = localShipments.findIndex((s) => s.shipment_id === id || s._id === id);
    if (idx !== -1) {
      localShipments[idx] = {
        ...localShipments[idx],
        status,
        ...(tracking_note && { tracking_note }),
        ...(status === 'delivered' && { actual_arrival: new Date().toISOString() }),
      };
      return ApiService.patch<Shipment>(`/shipments/${id}/status`, { status, tracking_note }, localShipments[idx]);
    }
    return { success: false, data: null as unknown as Shipment };
  },
};
