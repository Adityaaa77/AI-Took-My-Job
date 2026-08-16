// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Procurement Desk & Purchase Order Lifecycle Workflow
// ============================================================================

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, CheckCircle2, Lock } from 'lucide-react';
import { procurementService } from '../services/procurementService';
import { drugService } from '../services/drugService';
import { networkService } from '../services/networkService';
import type { PurchaseOrder, Drug, Vendor, Warehouse, PurchaseOrderStatus } from '../types';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Table, type Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';

export const ProcurementPage: React.FC = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newOrder, setNewOrder] = useState<Partial<PurchaseOrder>>({
    vendor_id: '',
    drug_id: '',
    quantity: 1000,
    unit_price: 180,
    destination_location_id: 'WH-001',
    destination_location_type: 'warehouse',
    expected_delivery: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [poRes, drugRes, vendRes, whRes] = await Promise.all([
      procurementService.getAllOrders(),
      drugService.getAllDrugs(),
      networkService.getAllVendors(),
      networkService.getAllWarehouses(),
    ]);

    if (poRes.data) setOrders(poRes.data);
    if (drugRes.data) setDrugs(drugRes.data);
    if (vendRes.data) setVendors(vendRes.data);
    if (whRes.data) setWarehouses(whRes.data);
    setLoading(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.drug_id || !newOrder.vendor_id) return;

    await procurementService.createOrder(newOrder);
    setCreateModalOpen(false);
    setToastMessage('New purchase order created and logged onto procurement schedule.');
    loadData();
  };

  const handleStatusUpdate = async (id: string, status: PurchaseOrderStatus) => {
    await procurementService.updateOrderStatus(id, status);
    setToastMessage(`Purchase order ${id} status advanced to ${status.toUpperCase()}.`);
    loadData();
  };

  const filteredOrders = orders.filter((o) => {
    const orderId = o.order_id.toLowerCase();
    const vendorName =
      typeof o.vendor_id === 'string' ? o.vendor_id.toLowerCase() : o.vendor_id?.name?.toLowerCase() || '';
    const drugName =
      typeof o.drug_id === 'string' ? o.drug_id.toLowerCase() : o.drug_id?.name?.toLowerCase() || '';

    const matchesSearch =
      orderId.includes(searchQuery.toLowerCase()) ||
      vendorName.includes(searchQuery.toLowerCase()) ||
      drugName.includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = orders.filter((o) => o.status === 'pending' || o.status === 'draft').length;
  const approvedCount = orders.filter((o) => o.status === 'approved' || o.status === 'ordered').length;
  const inTransitCount = orders.filter((o) => o.status === 'shipped').length;
  const fulfilledCount = orders.filter((o) => o.status === 'delivered' || o.status === 'completed').length;

  const columns: Column<PurchaseOrder>[] = [
    {
      header: 'Order Code / Date',
      accessor: (o) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">{o.order_id}</span>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'Active'}
          </p>
        </div>
      ),
    },
    {
      header: 'Drug & Quantity',
      accessor: (o) => (
        <div>
          <p className="font-bold text-xs text-slate-800">
            {typeof o.drug_id === 'string' ? o.drug_id : o.drug_id?.name}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">
            {o.quantity.toLocaleString()} units @ ₹{o.unit_price || 150}/unit
          </span>
        </div>
      ),
    },
    {
      header: 'Supplier / Vendor',
      accessor: (o) => (
        <span className="text-xs font-semibold text-slate-700">
          {typeof o.vendor_id === 'string' ? o.vendor_id : o.vendor_id?.name}
        </span>
      ),
    },
    {
      header: 'Delivery Destination',
      accessor: (o) => (
        <span className="text-xs font-medium text-slate-800">{o.destination_location_id}</span>
      ),
    },
    {
      header: 'Workflow State',
      accessor: (o) => <StatusBadge status={o.status} size="sm" />,
    },
    {
      header: 'Actions',
      accessor: (o) => (
        <div className="flex items-center gap-1.5">
          {o.status === 'pending' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStatusUpdate(o.order_id, 'approved')}
            >
              Approve
            </Button>
          )}
          {o.status === 'approved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusUpdate(o.order_id, 'shipped')}
            >
              Dispatch
            </Button>
          )}
          {o.status === 'shipped' && (
            <Button
              variant="success"
              size="sm"
              onClick={() => handleStatusUpdate(o.order_id, 'delivered')}
            >
              Mark Received
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Approval"
          value={pendingCount}
          icon={<ShoppingCart className="h-5 w-5" />}
          subtitle="Requisitions awaiting sanction"
          color="amber"
        />
        <StatCard
          title="Approved / In Production"
          value={approvedCount}
          icon={<CheckCircle2 className="h-5 w-5" />}
          subtitle="Suppliers actively preparing"
          color="blue"
        />
        <StatCard
          title="Dispatched / En Route"
          value={inTransitCount}
          icon={<ShoppingCart className="h-5 w-5" />}
          subtitle="Live logistics in motion"
          color="cyan"
        />
        <StatCard
          title="Delivered & Verified"
          value={fulfilledCount}
          icon={<Lock className="h-5 w-5" />}
          subtitle="100% anchored on ledger"
          color="emerald"
        />
      </div>

      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by order ID, vendor, or drug..."
            className="w-full sm:w-80"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="all">All Order Statuses</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setNewOrder({
              drug_id: drugs[0]?.drug_id || 'DRUG-001',
              vendor_id: vendors[0]?.vendor_id || 'VEND-001',
              quantity: 2000,
              unit_price: 185,
              destination_location_id: warehouses[0]?.warehouse_id || 'WH-001',
              destination_location_type: 'warehouse',
              expected_delivery: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
              notes: 'Routine seasonal buffer replenishment.',
            });
            setCreateModalOpen(true);
          }}
        >
          Create Purchase Order
        </Button>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader
          title="National Procurement Order Schedule"
          subtitle={`Managing ${filteredOrders.length} active and fulfilled supply orders`}
        />
        <CardBody className="p-0">
          <Table
            columns={columns}
            data={filteredOrders}
            loading={loading}
            emptyMessage="No purchase orders found matching search query."
          />
        </CardBody>
      </Card>

      {/* Create PO Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Generate New Purchase Order"
        subtitle="Sanction institutional replenishment with certified pharmaceutical vendors"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Drug Formulation</label>
            <select
              value={newOrder.drug_id as string}
              onChange={(e) => setNewOrder({ ...newOrder, drug_id: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
              required
            >
              <option value="">Select Drug</option>
              {drugs.map((d) => (
                <option key={d.drug_id} value={d.drug_id}>
                  {d.drug_id} • {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Certified Vendor</label>
              <select
                value={newOrder.vendor_id as string}
                onChange={(e) => setNewOrder({ ...newOrder, vendor_id: e.target.value })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
                required
              >
                <option value="">Select Vendor</option>
                {vendors.map((v) => (
                  <option key={v.vendor_id} value={v.vendor_id}>
                    {v.name.split(' ')[0]} ({v.reliability_score}% Rel.)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Receiving Warehouse</label>
              <select
                value={newOrder.destination_location_id}
                onChange={(e) => setNewOrder({ ...newOrder, destination_location_id: e.target.value })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-semibold"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>
                    {w.warehouse_id} ({w.name.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quantity (Units)</label>
              <input
                type="number"
                min={50}
                value={newOrder.quantity}
                onChange={(e) => setNewOrder({ ...newOrder, quantity: Number(e.target.value) })}
                className="w-full p-2.5 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Unit Price (₹)</label>
              <input
                type="number"
                min={1}
                value={newOrder.unit_price}
                onChange={(e) => setNewOrder({ ...newOrder, unit_price: Number(e.target.value) })}
                className="w-full p-2.5 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Requisition Notes</label>
            <textarea
              rows={2}
              value={newOrder.notes || ''}
              onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
              placeholder="e.g. Expedited order for ICU reserve buffers..."
              className="w-full p-2.5 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Sanction Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
