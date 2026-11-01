import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { FormField, Input, Select, Textarea } from '../components/FormControls';
import { ErrorState, EmptyState } from '../components/StateBoxes';
import { api } from '../services/api';
import {
  Warehouse as WarehouseIcon,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
  Plus,
  RefreshCw,
  Box,
  Shuffle,
  ShieldCheck,
  TrendingDown,
  Building2,
  FileText,
  Clock,
  ArrowRight,
  Truck,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'PANEL', label: 'Solar Panels' },
  { value: 'INVERTER', label: 'Inverters' },
  { value: 'STRUCTURE', label: 'Mounting Structures' },
  { value: 'BATTERY', label: 'Batteries' },
  { value: 'CABLE', label: 'Cables & Wiring' },
  { value: 'PROTECTION', label: 'Protection & Switchgear' },
  { value: 'METER', label: 'Bi-Directional Meters' },
  { value: 'ACCESSORIES', label: 'Accessories & Hardware' },
];

export default function InventoryPage({ refreshTrigger }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get('tab') || 'stock';
  const initialOrderId = searchParams.get('orderId');

  const setTab = (tabName) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabName);
      return next;
    });
  };

  // State: Warehouses & Stock
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // State: Allocation Planner
  const [orders, setOrders] = useState([]);
  const [allocationOrderId, setAllocationOrderId] = useState(initialOrderId ? parseInt(initialOrderId) : null);
  const [preferredWarehouseId, setPreferredWarehouseId] = useState(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [allocating, setAllocating] = useState(false);

  // State: Stock Movement History
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // State: Inter-Warehouse Transfers (Phase 1)
  const [transfers, setTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [transferFilter, setTransferFilter] = useState('ALL');
  const [catalogComponents, setCatalogComponents] = useState([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferFormData, setTransferFormData] = useState({
    source_warehouse_id: '',
    dest_warehouse_id: '',
    component_id: '',
    quantity: '10',
    notes: '',
    auto_approve: false,
  });

  // State: Errors & Success
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // State: Modals
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [adjustTargetStock, setAdjustTargetStock] = useState(null);
  const [adjustFormData, setAdjustFormData] = useState({
    warehouse_id: '',
    component_id: '',
    change_type: 'INCREASE', // 'INCREASE' or 'DECREASE'
    quantity: '10',
    notes: 'Restock shipment receipt',
  });

  const [warehouseFormData, setWarehouseFormData] = useState({
    code: '',
    name: '',
    city: '',
    state: 'Maharashtra',
    pincode: '411001',
    manager_name: '',
    contact_phone: '+91 98220 00000',
    is_primary: false,
  });

  // 1. Fetch Warehouses
  const loadWarehouses = async () => {
    try {
      const data = await api.getWarehouses();
      const list = Array.isArray(data) ? data : (data?.warehouses || []);
      setWarehouses(list);
      if (list.length > 0 && !preferredWarehouseId) {
        // Default preferred warehouse to primary hub or first warehouse
        const primary = list.find((w) => w.is_primary) || list[0];
        setPreferredWarehouseId(primary.id);
      }
    } catch (err) {
      console.error('Failed to load warehouses', err);
      setWarehouses([]);
    }
  };

  // 2. Fetch Inventory
  const loadInventory = async () => {
    setLoadingStock(true);
    try {
      const data = await api.getInventory({
        warehouse_id: selectedWarehouseId !== 'ALL' ? selectedWarehouseId : undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        low_stock_only: lowStockOnly,
      });
      setInventory(Array.isArray(data) ? data : (data?.stocks || []));
    } catch (err) {
      setError(err.message);
      setInventory([]);
    } finally {
      setLoadingStock(false);
    }
  };

  // 3. Fetch Orders for Allocation
  const loadOrders = async () => {
    try {
      const ords = await api.getOrders();
      const list = Array.isArray(ords) ? ords : (ords?.orders || []);
      setOrders(list);
      if (!allocationOrderId && list.length > 0) {
        // Prefer orders in CONFIRMED or BOM_GENERATED
        const pending = list.find((o) => o.stage === 'CONFIRMED' || o.stage === 'BOM_GENERATED');
        setAllocationOrderId(pending ? pending.id : list[0].id);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
      setOrders([]);
    }
  };

  // 4. Fetch Stock Movements
  const loadMovements = async () => {
    setLoadingMovements(true);
    try {
      const data = await api.getInventoryMovements();
      setMovements(Array.isArray(data) ? data : (data?.movements || []));
    } catch (err) {
      console.error('Failed to load movements', err);
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  };

  // 5. Fetch Inter-Warehouse Transfers
  const loadTransfers = async () => {
    setLoadingTransfers(true);
    try {
      const data = await api.getInventoryTransfers({
        status: transferFilter !== 'ALL' ? transferFilter : undefined,
      });
      setTransfers(Array.isArray(data) ? data : (data?.transfers || []));
    } catch (err) {
      console.error('Failed to load transfers', err);
      setTransfers([]);
    } finally {
      setLoadingTransfers(false);
    }
  };

  // 6. Fetch Catalog Components (for Transfer Picker)
  const loadCatalogComponents = async () => {
    try {
      const data = await api.getCatalogComponents();
      setCatalogComponents(Array.isArray(data) ? data : (data?.components || []));
    } catch (err) {
      console.error('Failed to load catalog components', err);
      setCatalogComponents([]);
    }
  };

  useEffect(() => {
    loadWarehouses();
    loadInventory();
    loadOrders();
    loadMovements();
    loadTransfers();
    loadCatalogComponents();
  }, [refreshTrigger]);

  useEffect(() => {
    loadInventory();
  }, [selectedWarehouseId, selectedCategory, lowStockOnly]);

  useEffect(() => {
    loadTransfers();
  }, [transferFilter]);

  // Inter-Warehouse Transfer Actions
  const handleCreateTransferSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!transferFormData.source_warehouse_id || !transferFormData.dest_warehouse_id) {
      setError('Please select both source and destination depots.');
      return;
    }
    if (transferFormData.source_warehouse_id === transferFormData.dest_warehouse_id) {
      setError('Source and Destination depots cannot be the same warehouse.');
      return;
    }
    if (!transferFormData.component_id) {
      setError('Please select a component to transfer.');
      return;
    }
    setTransferSubmitting(true);
    try {
      const res = await api.createInventoryTransfer({
        source_warehouse_id: parseInt(transferFormData.source_warehouse_id),
        dest_warehouse_id: parseInt(transferFormData.dest_warehouse_id),
        component_id: parseInt(transferFormData.component_id),
        quantity: parseInt(transferFormData.quantity),
        notes: transferFormData.notes,
        auto_approve: transferFormData.auto_approve,
      });
      setActionSuccess(`Transfer ${res.transfer_number} created successfully.`);
      setIsTransferModalOpen(false);
      await loadTransfers();
      await loadInventory();
      await loadMovements();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleApproveTransfer = async (id) => {
    try {
      const res = await api.approveInventoryTransfer(id);
      setActionSuccess(res.message);
      await loadTransfers();
      await loadInventory();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDispatchTransfer = async (id) => {
    try {
      const res = await api.dispatchInventoryTransfer(id);
      setActionSuccess(res.message);
      await loadTransfers();
      await loadInventory();
      await loadMovements();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReceiveTransfer = async (id) => {
    try {
      const res = await api.receiveInventoryTransfer(id);
      setActionSuccess(res.message);
      await loadTransfers();
      await loadInventory();
      await loadMovements();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancelTransfer = async (id) => {
    if (!window.confirm('Cancel this transfer? Reserved stock at the source depot will be released.')) return;
    try {
      const res = await api.cancelInventoryTransfer(id);
      setActionSuccess(res.message);
      await loadTransfers();
      await loadInventory();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Simulation Handler
  const handleSimulateAllocation = async () => {
    if (!allocationOrderId) return;
    setSimulating(true);
    setError(null);
    try {
      const res = await api.simulateOrderAllocation(allocationOrderId, preferredWarehouseId);
      setSimulationResult(res);
    } catch (err) {
      setError(err.message);
      setSimulationResult(null);
    } finally {
      setSimulating(false);
    }
  };

  // Execution Handler
  const handleExecuteAllocation = async () => {
    if (!allocationOrderId) return;
    setAllocating(true);
    setError(null);
    try {
      const res = await api.allocateOrderInventory(allocationOrderId, {
        preferred_warehouse_id: preferredWarehouseId,
        allow_partial: allowPartial,
      });
      setActionSuccess(res.message);
      setSimulationResult(null);
      await loadInventory();
      await loadMovements();
      await loadOrders();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAllocating(false);
    }
  };

  // Stock Adjustment Handler
  const handleStockAdjustSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const qtyNum = parseInt(adjustFormData.quantity);
      const qtyChange = adjustFormData.change_type === 'DECREASE' ? -Math.abs(qtyNum) : Math.abs(qtyNum);

      const payload = {
        warehouse_id: parseInt(adjustFormData.warehouse_id),
        component_id: parseInt(adjustFormData.component_id),
        quantity_change: qtyChange,
        notes: adjustFormData.notes,
      };

      const res = await api.adjustInventory(payload);
      setActionSuccess(res.message);
      setIsAdjustModalOpen(false);
      setAdjustTargetStock(null);
      await loadInventory();
      await loadMovements();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const openAdjustModal = (item) => {
    setAdjustTargetStock(item);
    setAdjustFormData({
      warehouse_id: item.warehouse_id.toString(),
      component_id: item.component_id.toString(),
      change_type: 'INCREASE',
      quantity: '10',
      notes: `Manual stock adjustment for ${item.component_name}`,
    });
    setIsAdjustModalOpen(true);
  };

  // Warehouse Creation Handler
  const handleWarehouseSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createWarehouse(warehouseFormData);
      setActionSuccess(`Regional warehouse ${warehouseFormData.name} created successfully.`);
      setIsWarehouseModalOpen(false);
      await loadWarehouses();
      await loadInventory();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Inventory Stock Table Columns
  const inventoryColumns = [
    {
      header: 'Warehouse Hub',
      accessor: 'warehouse_name',
      render: (i) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{i.warehouse_name}</span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {i.warehouse_city} · {i.warehouse_code}
          </div>
        </div>
      ),
    },
    {
      header: 'Component Details',
      accessor: 'component_name',
      render: (i) => (
        <div>
          <div style={{ fontWeight: 600 }}>{i.component_name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            SKU: <span style={{ fontWeight: 600 }}>{i.sku}</span> · {(i.category || 'OTHER').replace(/_/g, ' ')}
          </div>
        </div>
      ),
    },
    {
      header: 'On Hand',
      accessor: 'qty_on_hand',
      render: (i) => <span style={{ fontWeight: 700 }}>{i.qty_on_hand}</span>,
    },
    {
      header: 'Reserved',
      accessor: 'qty_reserved',
      render: (i) => (
        <span style={{ fontWeight: 600, color: i.qty_reserved > 0 ? 'var(--amber-600)' : 'var(--text-muted)' }}>
          {i.qty_reserved}
        </span>
      ),
    },
    {
      header: 'Available Stock',
      accessor: 'available',
      render: (i) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: '1rem',
              color: i.is_low_stock ? 'var(--red-600)' : 'var(--solar-green-600)',
            }}
          >
            {i.available}
          </span>
          {i.is_low_stock && (
            <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
              LOW STOCK
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Min Threshold',
      accessor: 'min_threshold',
      render: (i) => <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i.min_threshold} units</span>,
    },
    {
      header: 'Unit Cost',
      accessor: 'unit_cost_inr',
      render: (i) => <span>₹{i.unit_cost_inr.toLocaleString('en-IN')}</span>,
    },
    {
      header: 'Action',
      accessor: 'actions',
      align: 'right',
      render: (i) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => openAdjustModal(i)}
          title="Adjust Physical Inventory"
        >
          <ArrowRightLeft size={13} /> Adjust Stock
        </button>
      ),
    },
  ];

  // Stock Metrics
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const totalStockUnits = safeInventory.reduce((acc, i) => acc + (i.qty_on_hand || 0), 0);
  const totalReservedUnits = safeInventory.reduce((acc, i) => acc + (i.qty_reserved || 0), 0);
  const totalAvailableUnits = safeInventory.reduce((acc, i) => acc + (i.available || 0), 0);
  const lowStockCount = safeInventory.filter((i) => i.is_low_stock).length;

  return (
    <div>
      <PageHeader
        title={user?.role === 'ADMIN' ? "Central Inventory Oversight & Warehouse Valuation" : "Multi-Warehouse Inventory & Allocation"}
        description={user?.role === 'ADMIN' ? "Authoritative stock balances, warehouse valuations, low-stock alerts, and movement audit logs across regional depots." : "Live stock tracking across Pune, Mumbai, and Nashik depots with multi-warehouse order reservation."}
        action={
          activeTab === 'stock' ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setWarehouseFormData({
                  code: `WH-${Math.floor(100 + Math.random() * 900)}`,
                  name: '',
                  city: '',
                  state: 'Maharashtra',
                  pincode: '411001',
                  manager_name: '',
                  contact_phone: '+91 98220 00000',
                  is_primary: false,
                });
                setIsWarehouseModalOpen(true);
              }}
            >
              <Plus size={16} /> Add Regional Depot
            </button>
          ) : activeTab === 'transfers' ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setTransferFormData({
                  source_warehouse_id: warehouses[0]?.id?.toString() || '',
                  dest_warehouse_id: warehouses[1]?.id?.toString() || '',
                  component_id: catalogComponents[0]?.id?.toString() || '',
                  quantity: '10',
                  notes: 'Inter-depot rebalancing transfer',
                  auto_approve: false,
                });
                setIsTransferModalOpen(true);
              }}
            >
              <Plus size={16} /> New Stock Transfer
            </button>
          ) : null
        }
      />

      {/* Global Alerts */}
      {actionSuccess && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem', background: '#ecfdf5', border: '1px solid var(--solar-green-400)', borderRadius: '8px', color: 'var(--solar-green-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem', background: '#fee2e2', border: '1px solid var(--red-600)', borderRadius: '8px', color: 'var(--red-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red-600)', fontWeight: 700 }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem', paddingBottom: '0.25rem' }}>
        <button
          className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setTab('stock')}
        >
          <WarehouseIcon size={16} />
          <span>Regional Warehouse Stock</span>
          <span className="badge badge-neutral" style={{ marginLeft: '0.25rem' }}>{inventory.length}</span>
        </button>

        {user?.role !== 'ADMIN' && (
          <button
            className={`btn ${activeTab === 'allocate' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => setTab('allocate')}
          >
            <Shuffle size={16} />
            <span>Multi-Warehouse Allocation Planner</span>
          </button>
        )}

        <button
          className={`btn ${activeTab === 'transfers' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setTab('transfers')}
        >
          <Truck size={16} />
          <span>Multi-Warehouse Transfers</span>
          <span className="badge badge-neutral" style={{ marginLeft: '0.25rem' }}>{transfers.length}</span>
        </button>

        <button
          className={`btn ${activeTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setTab('movements')}
        >
          <Clock size={16} />
          <span>Stock Movement Audit Log</span>
          <span className="badge badge-neutral" style={{ marginLeft: '0.25rem' }}>{movements.length}</span>
        </button>
      </div>

      {/* ==================== TAB 1: REGIONAL WAREHOUSE STOCK ==================== */}
      {activeTab === 'stock' && (
        <div>
          {/* Warehouse Depots Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            {warehouses.map((wh) => (
              <div
                key={wh.id}
                className="card"
                style={{
                  padding: '1rem',
                  borderLeft: wh.is_primary ? '4px solid var(--solar-green-500)' : '4px solid var(--navy-600)',
                  background: selectedWarehouseId === wh.id.toString() ? '#f0fdf4' : '#ffffff',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedWarehouseId(selectedWarehouseId === wh.id.toString() ? 'ALL' : wh.id.toString())}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>{wh.code}</span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-900)', marginTop: '0.2rem' }}>
                      {wh.name}
                    </h3>
                  </div>
                  {wh.is_primary && <span className="badge badge-success">PRIMARY HUB</span>}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {wh.city}, {wh.state} · Lead: {wh.manager_name}
                </p>
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Contact: {wh.contact_phone}</span>
                  <span style={{ fontWeight: 600, color: 'var(--solar-green-600)' }}>Active Depot</span>
                </div>
              </div>
            ))}
          </div>

          {/* Aggregate Stock Statistics Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="card" style={{ padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total On Hand</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                {totalStockUnits.toLocaleString()} units
              </div>
            </div>

            <div className="card" style={{ padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reserved for Orders</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--amber-600)' }}>
                {totalReservedUnits.toLocaleString()} units
              </div>
            </div>

            <div className="card" style={{ padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net Available Stock</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
                {totalAvailableUnits.toLocaleString()} units
              </div>
            </div>

            <div className="card" style={{ padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Low Stock SKU Alerts</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: lowStockCount > 0 ? 'var(--red-600)' : 'var(--solar-green-600)' }}>
                {lowStockCount} SKUs
              </div>
            </div>
          </div>

          {/* Filtering Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Depot:</span>
              <select
                className="input"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
              >
                <option value="ALL">All Regional Hubs</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.city})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category:</span>
              <select
                className="input"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: lowStockOnly ? 'var(--red-600)' : 'var(--navy-800)',
                cursor: 'pointer',
                marginLeft: '0.5rem',
              }}
            >
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              Show Low-Stock Alerts Only
            </label>

            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={loadInventory}>
              <RefreshCw size={13} className={loadingStock ? 'spin' : ''} /> Refresh Stock
            </button>
          </div>

          <DataTable
            columns={inventoryColumns}
            data={inventory}
            searchPlaceholder="Search inventory by component, SKU, warehouse..."
            searchKey="component_name"
            isLoading={loadingStock}
            emptyMessage="No stock records match the selected warehouse and category filters."
          />
        </div>
      )}

      {/* ==================== TAB 2: MULTI-WAREHOUSE ALLOCATION PLANNER ==================== */}
      {activeTab === 'allocate' && user?.role !== 'ADMIN' && (
        <div>
          {/* Architecture Concept Banner */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
              marginBottom: '1.25rem',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '10px', color: 'var(--solar-green-400)' }}>
                <Shuffle size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-success" style={{ fontWeight: 800 }}>CORE USP ENGINE</span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Multi-Warehouse Inventory Allocation</span>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.25rem', color: '#ffffff' }}>
                  Autonomous Regional Stock Sourcing & Split Allocation
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.35rem', maxWidth: '850px' }}>
                  When project demand exceeds available stock at the primary depot, this engine calculates an atomic reservation plan: prioritizing the preferred hub, drawing remainder quantities across secondary depots, detecting any material shortages, and committing reservations transactionally.
                </p>
              </div>
            </div>
          </div>

          {/* Allocation Setup Card */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--navy-900)' }}>
              Configure Allocation Parameters
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  1. Target Installation Order
                </label>
                <select
                  className="input"
                  style={{ fontWeight: 600 }}
                  value={allocationOrderId || ''}
                  onChange={(e) => {
                    setAllocationOrderId(parseInt(e.target.value));
                    setSimulationResult(null);
                  }}
                >
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.order_number} — {ord.customer_name} ({ord.system_capacity_kw || 5} kW) [{ord.stage}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  2. Preferred Primary Dispatch Hub
                </label>
                <select
                  className="input"
                  style={{ fontWeight: 600 }}
                  value={preferredWarehouseId || ''}
                  onChange={(e) => {
                    setPreferredWarehouseId(parseInt(e.target.value));
                    setSimulationResult(null);
                  }}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.city}) {w.is_primary ? '★ Primary Hub' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--navy-800)',
                    cursor: 'pointer',
                    padding: '0.6rem 0',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allowPartial}
                    onChange={(e) => setAllowPartial(e.target.checked)}
                  />
                  <span>Allow partial allocation if complete stock is unavailable</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <button
                className="btn btn-secondary"
                onClick={handleSimulateAllocation}
                disabled={simulating || !allocationOrderId}
              >
                <RefreshCw size={14} className={simulating ? 'spin' : ''} />
                <span>{simulating ? 'Calculating Regional Stock Split...' : 'Simulate Allocation Plan'}</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={handleExecuteAllocation}
                disabled={allocating || !allocationOrderId}
              >
                <Shuffle size={14} className={allocating ? 'spin' : ''} />
                <span>{allocating ? 'Reserving Stock Across Warehouses...' : 'Execute & Commit Allocation'}</span>
              </button>
            </div>
          </div>

          {/* Simulation Output Area */}
          {simulationResult && (
            <div className="card" style={{ padding: '1.25rem', border: '1.5px solid var(--border-strong)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-info">{simulationResult.order_number}</span>
                    <span
                      className={`badge ${simulationResult.overall_status === 'FULL_ALLOCATION_POSSIBLE'
                          ? 'badge-success'
                          : 'badge-danger'
                        }`}
                    >
                      {simulationResult.overall_status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-900)', marginTop: '0.35rem' }}>
                    Multi-Warehouse Plan: {simulationResult.preferred_warehouse_name} (Preferred Hub)
                  </h3>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shortage Summary</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: simulationResult.has_shortages ? 'var(--red-600)' : 'var(--solar-green-600)' }}>
                    {simulationResult.has_shortages ? 'Shortage Detected' : '100% Stock Available'}
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Component SKU & Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'center' }}>Required Qty</th>
                      <th>Warehouse Sourcing Plan</th>
                      <th style={{ textAlign: 'center' }}>Total Sourced</th>
                      <th style={{ textAlign: 'center' }}>Shortage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.items_breakdown.map((item) => (
                      <tr key={item.bom_item_id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{item.component_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SKU: {item.sku}</div>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                            {item.category.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem' }}>
                          {item.quantity_required}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {item.allocations && item.allocations.length > 0 ? (
                              item.allocations.map((a, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    fontSize: '0.8rem',
                                    background: '#f8fafc',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-subtle)',
                                  }}
                                >
                                  <Building2 size={12} color="var(--navy-600)" />
                                  <span style={{ fontWeight: 600 }}>{a.warehouse_name}:</span>
                                  <span style={{ color: 'var(--solar-green-600)', fontWeight: 700 }}>
                                    {a.quantity_allocated} units
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span style={{ color: 'var(--red-600)', fontSize: '0.8rem', fontWeight: 600 }}>
                                Zero available stock across all depots
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {item.total_allocated_across_warehouses}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: item.shortage_quantity > 0 ? 'var(--red-600)' : 'var(--solar-green-600)',
                            }}
                          >
                            {item.shortage_quantity}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Commit Action Footer */}
              <div style={{ marginTop: '1.25rem', padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--navy-800)' }}>
                  {simulationResult.has_shortages && !allowPartial
                    ? '⚠️ Stock shortage prevents full allocation. Check "Allow partial allocation" or restock secondary depots.'
                    : '✓ Verified valid allocation plan. Commit reservations to lock inventory.'}
                </span>

                <button
                  className="btn btn-primary"
                  onClick={handleExecuteAllocation}
                  disabled={allocating || (simulationResult.has_shortages && !allowPartial)}
                >
                  <Shuffle size={14} className={allocating ? 'spin' : ''} />
                  <span>{allocating ? 'Committing...' : 'Commit & Lock Allocation Plan'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: INTER-WAREHOUSE TRANSFERS (PHASE 1) ==================== */}
      {activeTab === 'transfers' && (
        <div>
          {/* Transfer Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--navy-600)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Transfers</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy-900)' }}>{transfers.length}</div>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #7c3aed' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>In Transit</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed' }}>
                {transfers.filter((t) => t.status === 'IN_TRANSIT').length}
              </div>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending Approval</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>
                {transfers.filter((t) => t.status === 'REQUESTED').length}
              </div>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--solar-green-500)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Received & Restocked</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
                {transfers.filter((t) => t.status === 'RECEIVED').length}
              </div>
            </div>
          </div>

          {/* Filter Bar & Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status Filter:</span>
              {['ALL', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  className={`btn btn-sm ${transferFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTransferFilter(st)}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={loadTransfers}>
                <RefreshCw size={13} className={loadingTransfers ? 'spin' : ''} /> Refresh
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setTransferFormData({
                    source_warehouse_id: warehouses[0]?.id?.toString() || '',
                    dest_warehouse_id: warehouses[1]?.id?.toString() || '',
                    component_id: catalogComponents[0]?.id?.toString() || '',
                    quantity: '10',
                    notes: 'Inter-depot rebalancing transfer',
                    auto_approve: false,
                  });
                  setIsTransferModalOpen(true);
                }}
              >
                <Plus size={13} /> New Stock Transfer
              </button>
            </div>
          </div>

          {/* Transfers Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Route (Source &rarr; Dest)</th>
                  <th>Component</th>
                  <th style={{ textAlign: 'center' }}>Quantity</th>
                  <th>Status</th>
                  <th>Audit Trail</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length > 0 ? (
                  transfers.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{t.transfer_number}</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.created_at}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600, color: '#0f766e' }}>{t.source_warehouse_name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                          <span style={{ fontWeight: 600, color: '#1e40af' }}>{t.dest_warehouse_name}</span>
                        </div>
                        {t.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{t.notes}</div>}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{t.component_name}</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {t.component_category} • {t.component_sku}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--navy-900)' }}>
                          {t.quantity}
                        </span>
                      </td>
                      <td>
                        {t.status === 'REQUESTED' && (
                          <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309' }}>
                            Requested
                          </span>
                        )}
                        {t.status === 'APPROVED' && (
                          <span className="badge badge-info" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                            Approved (Stock Reserved)
                          </span>
                        )}
                        {t.status === 'IN_TRANSIT' && (
                          <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', fontWeight: 700 }}>
                            In Transit
                          </span>
                        )}
                        {t.status === 'RECEIVED' && (
                          <span className="badge badge-success" style={{ background: '#d1fae5', color: '#047857' }}>
                            Received & Restocked
                          </span>
                        )}
                        {t.status === 'CANCELLED' && (
                          <span className="badge badge-neutral" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                            Cancelled
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <div>Req: {t.requested_by_name || 'System'}</div>
                        {t.approved_by_name && <div>Appr: {t.approved_by_name}</div>}
                        {t.received_by_name && <div>Recv: {t.received_by_name}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          {t.status === 'REQUESTED' && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleApproveTransfer(t.id)}
                                title="Approve & Lock Reserved Stock"
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ color: 'var(--red-600)' }}
                                onClick={() => handleCancelTransfer(t.id)}
                                title="Cancel Transfer"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {t.status === 'APPROVED' && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                                onClick={() => handleDispatchTransfer(t.id)}
                                title="Dispatch Out of Source Depot"
                              >
                                <Truck size={13} /> Dispatch
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ color: 'var(--red-600)' }}
                                onClick={() => handleCancelTransfer(t.id)}
                                title="Cancel and Release Reservation"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {t.status === 'IN_TRANSIT' && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ background: 'var(--solar-green-600)', borderColor: 'var(--solar-green-600)' }}
                              onClick={() => handleReceiveTransfer(t.id)}
                              title="Receive & Restock at Destination Depot"
                            >
                              Receive Stock
                            </button>
                          )}
                          {t.status === 'RECEIVED' && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--solar-green-600)', fontWeight: 600 }}>
                              ✓ Restocked
                            </span>
                          )}
                          {t.status === 'CANCELLED' && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cancelled</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No inter-warehouse transfers found for the selected status filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: STOCK MOVEMENT AUDIT LOG ==================== */}
      {activeTab === 'movements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Chronological immutable ledger of all inventory transactions, order reservations, and warehouse stock adjustments.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={loadMovements}>
              <RefreshCw size={13} className={loadingMovements ? 'spin' : ''} /> Refresh Ledger
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Warehouse Depot</th>
                  <th>Component</th>
                  <th style={{ textAlign: 'center' }}>Qty Change</th>
                  <th>Movement Type</th>
                  <th>Operational Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.length > 0 ? (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {m.created_at}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{m.warehouse_name}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{m.component_name}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontWeight: 800,
                            color: m.quantity_change > 0 ? 'var(--solar-green-600)' : 'var(--red-600)',
                          }}
                        >
                          {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          {m.movement_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.notes}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No inventory movements recorded yet. Adjust stock or allocate an order to generate audit entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== ADJUST STOCK MODAL ==================== */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Adjust Stock: ${adjustTargetStock?.component_name || 'Component'}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAdjustModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleStockAdjustSubmit}>
              Commit Adjustment
            </button>
          </>
        }
      >
        <form onSubmit={handleStockAdjustSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {adjustTargetStock && (
            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Warehouse Depot:</span>
                <span style={{ fontWeight: 700 }}>{adjustTargetStock.warehouse_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current On-Hand:</span>
                <span style={{ fontWeight: 700 }}>{adjustTargetStock.qty_on_hand} units</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Currently Reserved:</span>
                <span style={{ fontWeight: 700, color: 'var(--amber-600)' }}>
                  {adjustTargetStock.qty_reserved} units
                </span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Adjustment Type" required>
              <Select
                value={adjustFormData.change_type}
                onChange={(e) => setAdjustFormData({ ...adjustFormData, change_type: e.target.value })}
              >
                <option value="INCREASE">Increase Stock (+ Inflow)</option>
                <option value="DECREASE">Decrease Stock (- Shrinkage / Return)</option>
              </Select>
            </FormField>

            <FormField label="Quantity Units" required>
              <Input
                type="number"
                min="1"
                value={adjustFormData.quantity}
                onChange={(e) => setAdjustFormData({ ...adjustFormData, quantity: e.target.value })}
                required
              />
            </FormField>
          </div>

          <FormField label="Adjustment Reason / Manifest Note" required>
            <Textarea
              rows={2}
              value={adjustFormData.notes}
              onChange={(e) => setAdjustFormData({ ...adjustFormData, notes: e.target.value })}
              placeholder="e.g. Received shipment from tier-1 factory, batch QA verified..."
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* ==================== CREATE REGIONAL DEPOT MODAL ==================== */}
      <Modal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        title="Register Regional Warehouse Depot"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsWarehouseModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleWarehouseSubmit}>
              Register Depot
            </button>
          </>
        }
      >
        <form onSubmit={handleWarehouseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <FormField label="Depot Code" required>
              <Input
                value={warehouseFormData.code}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, code: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Depot Name" required>
              <Input
                value={warehouseFormData.name}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, name: e.target.value })}
                placeholder="e.g. Pune Central Depot"
                required
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <FormField label="City" required>
              <Input
                value={warehouseFormData.city}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, city: e.target.value })}
                placeholder="Pune"
                required
              />
            </FormField>

            <FormField label="State" required>
              <Input
                value={warehouseFormData.state}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, state: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Pincode" required>
              <Input
                value={warehouseFormData.pincode}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, pincode: e.target.value })}
                required
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Logistics Manager">
              <Input
                value={warehouseFormData.manager_name}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, manager_name: e.target.value })}
                placeholder="Sunil Kulkarni"
              />
            </FormField>

            <FormField label="Contact Phone">
              <Input
                value={warehouseFormData.contact_phone}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, contact_phone: e.target.value })}
                placeholder="+91 98220 12345"
              />
            </FormField>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--navy-900)',
              cursor: 'pointer',
              marginTop: '0.5rem',
            }}
          >
            <input
              type="checkbox"
              checked={warehouseFormData.is_primary}
              onChange={(e) => setWarehouseFormData({ ...warehouseFormData, is_primary: e.target.checked })}
            />
            <span>Set as primary default dispatch hub</span>
          </label>
        </form>
      </Modal>

      {/* ==================== CREATE INTER-WAREHOUSE TRANSFER MODAL ==================== */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Initiate Inter-Warehouse Stock Transfer"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsTransferModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateTransferSubmit}
              disabled={transferSubmitting}
            >
              {transferSubmitting ? 'Creating...' : 'Create Transfer Request'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateTransferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Source Warehouse (Origin)" required>
              <Select
                value={transferFormData.source_warehouse_id}
                onChange={(e) => setTransferFormData({ ...transferFormData, source_warehouse_id: e.target.value })}
                required
              >
                <option value="">-- Select Source Depot --</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Destination Warehouse (Target)" required>
              <Select
                value={transferFormData.dest_warehouse_id}
                onChange={(e) => setTransferFormData({ ...transferFormData, dest_warehouse_id: e.target.value })}
                required
              >
                <option value="">-- Select Target Depot --</option>
                {warehouses.map((wh) => (
                  <option
                    key={wh.id}
                    value={wh.id}
                    disabled={wh.id.toString() === transferFormData.source_warehouse_id}
                  >
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Catalog Component to Transfer" required>
            <Select
              value={transferFormData.component_id}
              onChange={(e) => setTransferFormData({ ...transferFormData, component_id: e.target.value })}
              required
            >
              <option value="">-- Select Component --</option>
              {catalogComponents.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.category}] {c.name} ({c.sku})
                </option>
              ))}
            </Select>
          </FormField>

          {/* Source Stock Indicator */}
          {transferFormData.source_warehouse_id && transferFormData.component_id && (
            <div style={{ padding: '0.65rem 0.85rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '0.82rem' }}>
              {(() => {
                const stock = inventory.find(
                  (i) =>
                    i.warehouse_id === parseInt(transferFormData.source_warehouse_id) &&
                    i.component_id === parseInt(transferFormData.component_id)
                );
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0369a1' }}>
                    <span>Source Depot Stock Available:</span>
                    <span style={{ fontWeight: 700 }}>
                      {stock ? `${stock.available} units (On-hand: ${stock.qty_on_hand}, Reserved: ${stock.qty_reserved})` : '0 units available'}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          <FormField label="Quantity to Transfer" required>
            <Input
              type="number"
              min="1"
              value={transferFormData.quantity}
              onChange={(e) => setTransferFormData({ ...transferFormData, quantity: e.target.value })}
              required
            />
          </FormField>

          <FormField label="Operational Manifest / Transfer Notes">
            <Textarea
              rows={2}
              value={transferFormData.notes}
              onChange={(e) => setTransferFormData({ ...transferFormData, notes: e.target.value })}
              placeholder="e.g. Relocating 10 panels to Mumbai depot to fulfill commercial rooftop order..."
            />
          </FormField>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--navy-900)',
              cursor: 'pointer',
              marginTop: '0.25rem',
            }}
          >
            <input
              type="checkbox"
              checked={transferFormData.auto_approve}
              onChange={(e) => setTransferFormData({ ...transferFormData, auto_approve: e.target.checked })}
            />
            <span>Auto-approve transfer now (immediately lock reservation at origin)</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}

