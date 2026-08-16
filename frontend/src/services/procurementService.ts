import { ApiService } from './api';
import type { PurchaseOrder, PurchaseOrderStatus } from '../types';
import { MOCK_PURCHASE_ORDERS, MOCK_DRUGS, MOCK_VENDORS } from './mockData';

let localOrders: PurchaseOrder[] = [...MOCK_PURCHASE_ORDERS];

export const procurementService = {
  async getAllOrders(params?: { status?: string; destination_location_id?: string }) {
    let filtered = [...localOrders];
    if (params?.status) {
      filtered = filtered.filter((o) => o.status === params.status);
    }
    if (params?.destination_location_id) {
      filtered = filtered.filter((o) => o.destination_location_id === params.destination_location_id);
    }

    const queryStr = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    return ApiService.get<PurchaseOrder[]>(`/purchase-orders${queryStr}`, filtered);
  },

  async getOrderById(id: string) {
    const fallback = localOrders.find((o) => o.order_id === id || o._id === id);
    return ApiService.get<PurchaseOrder>(`/purchase-orders/${id}`, fallback);
  },

  async createOrder(orderData: Partial<PurchaseOrder>) {
    const drugObj =
      typeof orderData.drug_id === 'string'
        ? MOCK_DRUGS.find((d) => d.drug_id === orderData.drug_id || d._id === orderData.drug_id) || MOCK_DRUGS[0]
        : orderData.drug_id || MOCK_DRUGS[0];

    const vendorObj =
      typeof orderData.vendor_id === 'string'
        ? MOCK_VENDORS.find((v) => v.vendor_id === orderData.vendor_id || v._id === orderData.vendor_id) || MOCK_VENDORS[0]
        : orderData.vendor_id || MOCK_VENDORS[0];

    const newOrder: PurchaseOrder = {
      _id: `po_${Date.now()}`,
      order_id: `PO-2026-0${890 + localOrders.length + 1}`,
      vendor_id: vendorObj,
      drug_id: drugObj,
      quantity: orderData.quantity || 100,
      unit_price: orderData.unit_price || 150,
      total_amount: (orderData.quantity || 100) * (orderData.unit_price || 150),
      destination_location_id: orderData.destination_location_id || 'WH-001',
      destination_location_type: orderData.destination_location_type || 'warehouse',
      expected_delivery: orderData.expected_delivery || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      status: orderData.status || 'pending',
      notes: orderData.notes,
      blockchain_tx_hash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      createdAt: new Date().toISOString(),
    };

    localOrders = [newOrder, ...localOrders];
    return ApiService.post<PurchaseOrder>('/purchase-orders', orderData, newOrder);
  },

  async updateOrderStatus(id: string, status: PurchaseOrderStatus) {
    const idx = localOrders.findIndex((o) => o.order_id === id || o._id === id);
    if (idx !== -1) {
      localOrders[idx] = {
        ...localOrders[idx],
        status,
        ...(status === 'delivered' && { actual_delivery: new Date().toISOString() }),
      };
      return ApiService.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, { status }, localOrders[idx]);
    }
    return { success: false, data: null as unknown as PurchaseOrder };
  },
};
