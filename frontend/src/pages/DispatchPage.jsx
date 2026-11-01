import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import CameraCapture from '../components/CameraCapture';
import { FormField, Input, Select, Textarea } from '../components/FormControls';
import { ErrorState } from '../components/StateBoxes';
import { api } from '../services/api';
import {
  Truck,
  QrCode,
  Barcode,
  CheckCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Box,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Building2,
  Check,
  Send,
  Trash2,
  Camera,
  Layers,
  FileCheck,
} from 'lucide-react';

export default function DispatchPage({ refreshTrigger }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get('tab') || 'dispatch-prep';
  const selectedDispatchIdParam = searchParams.get('dispatchId');

  const setTab = (tabName, dispatchId = null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabName);
      if (dispatchId) {
        next.set('dispatchId', dispatchId.toString());
      }
      return next;
    });
  };

  // State: Dispatches
  const [dispatches, setDispatches] = useState([]);
  const [loadingDispatches, setLoadingDispatches] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // State: Orders & BOM
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderBom, setSelectedOrderBom] = useState(null);
  const [loadingBom, setLoadingBom] = useState(false);

  // State: Scanned Components for Stage A Dispatch & Passport
  const [scannedSerials, setScannedSerials] = useState([]);
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [validatingSerial, setValidatingSerial] = useState(false);

  // State: Dispatch Form
  const [dispatchDetails, setDispatchDetails] = useState({
    warehouse_id: 1,
    vehicle_number: 'MH-12-SP-2026',
    driver_name: 'Kishore Gaikwad',
    driver_phone: '+91 98220 77112',
    notes: 'Dispatched with verified serials and Digital Solar Passport certificate.',
  });

  // State: Action feedback
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [createdPassportResult, setCreatedPassportResult] = useState(null);
  const [submittingDispatch, setSubmittingDispatch] = useState(false);
  const [isPartial, setIsPartial] = useState(false);

  // State: Serial Numbers Registry (Warehouse Manager)
  const [serials, setSerials] = useState([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [serialSearch, setSerialSearch] = useState('');
  const [serialStatusFilter, setSerialStatusFilter] = useState('ALL');
  const [serialCategoryFilter, setSerialCategoryFilter] = useState('ALL');
  const [serialWhFilter, setSerialWhFilter] = useState('ALL');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [warehousesList, setWarehousesList] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [showRegisterCamera, setShowRegisterCamera] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    serial_number: '',
    component_id: '',
    warehouse_id: '1',
    barcode_format: 'CODE128',
    lifecycle_status: 'AVAILABLE',
  });

  // 1. Load Dispatches
  const loadDispatches = async () => {
    setLoadingDispatches(true);
    try {
      const data = await api.getDispatches({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setDispatches(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDispatches(false);
    }
  };

  // 2. Load Orders
  const loadOrders = async () => {
    try {
      const ords = await api.getOrders();
      setOrders(ords);
      if (ords.length > 0 && !selectedOrder) {
        const eligible = ords.find((o) => o.stage === 'INVENTORY_ALLOCATED' || o.stage === 'CONFIRMED') || ords[0];
        handleSelectOrder(eligible);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    }
  };

  // 3. Load Serials
  const loadSerials = async () => {
    setLoadingSerials(true);
    try {
      const data = await api.getSerialNumbers({
        status: serialStatusFilter !== 'ALL' ? serialStatusFilter : undefined,
        category: serialCategoryFilter !== 'ALL' ? serialCategoryFilter : undefined,
        warehouse_id: serialWhFilter !== 'ALL' ? parseInt(serialWhFilter) : undefined,
        search: serialSearch.trim() || undefined,
      });
      setSerials(data || []);
    } catch (err) {
      console.error('Failed to load serials', err);
    } finally {
      setLoadingSerials(false);
    }
  };

  // 4. Handle Serial Registration
  const handleRegisterSerial = async (e) => {
    e.preventDefault();
    if (!registerForm.serial_number.trim() || !registerForm.component_id) {
      setError('Please select a component and enter a serial number.');
      return;
    }
    try {
      await api.registerSerialNumber({
        serial_number: registerForm.serial_number.trim(),
        component_id: parseInt(registerForm.component_id, 10),
        warehouse_id: registerForm.warehouse_id ? parseInt(registerForm.warehouse_id, 10) : 1,
        barcode_format: registerForm.barcode_format,
        lifecycle_status: registerForm.lifecycle_status,
      });
      setActionSuccess(`Component serial '${registerForm.serial_number}' registered into warehouse inventory.`);
      setShowRegisterModal(false);
      setRegisterForm({
        serial_number: '',
        component_id: catalogProducts[0]?.id?.toString() || '',
        warehouse_id: '1',
        barcode_format: 'CODE128',
        lifecycle_status: 'AVAILABLE',
      });
      loadSerials();
    } catch (err) {
      setError(err.message);
    }
  };

  // 5. Update Serial Lifecycle Status
  const handleUpdateSerialLifecycle = async (serialId, newStatus) => {
    try {
      await api.updateSerialStatus(serialId, { lifecycle_status: newStatus });
      setActionSuccess(`Serial status transitioned to ${newStatus}.`);
      loadSerials();
    } catch (err) {
      setError(err.message);
    }
  };

  // 3. Handle Order Selection & Load BOM
  const handleSelectOrder = async (order) => {
    if (!order) return;
    setSelectedOrder(order);
    setScannedSerials([]);
    setCreatedPassportResult(null);
    setValidationResult(null);
    setLoadingBom(true);
    try {
      const bomData = await api.getBOMByOrderId(order.id);
      setSelectedOrderBom(bomData);
      if (bomData?.items && bomData.items.length > 0) {
        setSelectedComponentId(bomData.items[0].component_id.toString());
      }
    } catch (err) {
      console.warn('No BOM for order', err.message);
      setSelectedOrderBom(null);
    } finally {
      setLoadingBom(false);
    }
  };

  useEffect(() => {
    loadDispatches();
    loadOrders();
    loadSerials();
    api.getWarehouses().then((res) => setWarehousesList(res || [])).catch(() => {});
    api.getProducts().then((res) => {
      setCatalogProducts(res || []);
      if (res && res.length > 0) {
        setRegisterForm((prev) => ({ ...prev, component_id: res[0].id.toString() }));
      }
    }).catch(() => {});
  }, [refreshTrigger]);

  useEffect(() => {
    loadDispatches();
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === 'serials') {
      loadSerials();
    }
  }, [activeTab, serialStatusFilter, serialCategoryFilter, serialWhFilter]);

  // Handle Barcode/QR Scan from Camera Scanner
  const handleScanSerial = async (rawCode, format = 'CODE128') => {
    const sn = rawCode.trim();
    if (!sn) return;

    // Check if already in current scan queue
    if (scannedSerials.some((s) => s.serial_number === sn)) {
      setValidationResult({
        valid: false,
        message: `Serial '${sn}' is already in your current dispatch scanning queue.`,
      });
      return;
    }

    setValidatingSerial(true);
    setValidationResult(null);
    try {
      const res = await api.validateSerial({
        serial_number: sn,
        component_id: selectedComponentId ? parseInt(selectedComponentId) : undefined,
        order_id: selectedOrder?.id,
      });

      if (res.valid) {
        const comp = selectedOrderBom?.items?.find((it) => it.component_id === parseInt(selectedComponentId));
        setScannedSerials((prev) => [
          ...prev,
          {
            serial_number: sn,
            component_id: parseInt(selectedComponentId) || 1,
            component_name: comp?.component_name || res.component_name,
            category: comp?.category || res.category,
            manufacturer: comp?.manufacturer || res.manufacturer,
            barcode_format: format,
            scanned_at: new Date().toLocaleTimeString(),
          },
        ]);
        setValidationResult({
          valid: true,
          message: `Serial '${sn}' verified against hardware catalog and queued.`,
        });
      } else {
        setValidationResult({
          valid: false,
          message: res.message || `Validation failed for '${sn}'.`,
        });
      }
    } catch (err) {
      setValidationResult({
        valid: false,
        message: err.message || 'Error validating serial number.',
      });
    } finally {
      setValidatingSerial(false);
    }
  };

  // Remove a scanned serial before confirmation
  const handleRemoveScannedSerial = (indexToRemove) => {
    setScannedSerials((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Confirm Dispatch & Create Digital Passport (Stage A)
  const handleConfirmDispatchAndPassport = async () => {
    if (!selectedOrder) {
      setError('Please select an order to dispatch.');
      return;
    }

    if (scannedSerials.length === 0) {
      setError('Serial Scanning Required: You must scan at least one component serial number before confirming dispatch.');
      return;
    }

    setSubmittingDispatch(true);
    setError(null);
    try {
      const payload = {
        order_id: selectedOrder.id,
        warehouse_id: parseInt(dispatchDetails.warehouse_id) || 1,
        vehicle_number: dispatchDetails.vehicle_number,
        driver_name: dispatchDetails.driver_name,
        driver_phone: dispatchDetails.driver_phone,
        notes: dispatchDetails.notes,
        is_partial: isPartial,
        scanned_serials: scannedSerials.map((s) => ({
          component_id: s.component_id,
          serial_number: s.serial_number,
          barcode_format: s.barcode_format,
        })),
      };

      const result = await api.confirmDispatchWithPassport(payload);
      setCreatedPassportResult(result);
      setActionSuccess(`Order ${selectedOrder.order_number} successfully dispatched! Digital Solar Passport ${result.passport_number} created.`);
      
      // Reload dispatches
      loadDispatches();
      loadOrders();
    } catch (err) {
      setError(err.message || 'Failed to confirm dispatch and create passport.');
    } finally {
      setSubmittingDispatch(false);
    }
  };

  // Mark Dispatch as Delivered
  const handleMarkDelivered = async (dispatchId) => {
    try {
      await api.markDispatchDelivered(dispatchId);
      setActionSuccess(`Dispatch marked as DELIVERED. Installation Worksheet unlocked for field engineers.`);
      loadDispatches();
    } catch (err) {
      setError(err.message || 'Failed to update delivery status.');
    }
  };

  // Cancel In-Transit Dispatch (Problem 14)
  const handleCancelDispatch = async (dispatchId) => {
    if (!window.confirm('Are you sure you want to cancel this dispatch? Reserved inventory will be returned to physical warehouse stock.')) return;
    try {
      await api.cancelDispatch(dispatchId);
      setActionSuccess('Dispatch cancelled successfully. Stock restored to warehouse inventory.');
      loadDispatches();
      loadOrders();
    } catch (err) {
      setError(err.message || 'Failed to cancel dispatch.');
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Warehouse Logistics & Digital Passport Hub"
        subtitle="Stage A: Physical component barcode scanning, stock relief, dispatch manifests, and Digital Solar Passport creation."
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn ${activeTab === 'dispatch-prep' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('dispatch-prep')}
          >
            <Camera size={14} /> Scan & Dispatch with Passport
          </button>
          <button
            className={`btn ${activeTab === 'manifests' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('manifests')}
          >
            <Truck size={14} /> Dispatch Manifests ({dispatches.length})
          </button>
          <button
            className={`btn ${activeTab === 'serials' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('serials')}
          >
            <Barcode size={14} /> Serial Numbers Registry ({serials.length})
          </button>
        </div>
      </PageHeader>

      {/* Action Banners */}
      {error && (
        <div style={{ padding: '0.85rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red-600)', borderRadius: '8px', color: '#b91c1c', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>✕</button>
        </div>
      )}



      {/* TAB 3: Serial Numbers Registry & Lifecycle Tracking */}
      {activeTab === 'serials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>REGISTERED SERIALS</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{serials.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>Across all categories</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#059669' }}>AVAILABLE IN DEPOTS</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'AVAILABLE' || s.lifecycle_status === 'REGISTERED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem' }}>Ready for allocation</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ea580c' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#ea580c' }}>RESERVED / ALLOCATED</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#c2410c', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'RESERVED' || s.lifecycle_status === 'ALLOCATED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#ea580c', marginTop: '0.2rem' }}>Committed to orders</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#8b5cf6' }}>DISPATCHED / INSTALLED</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#6d28d9', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'DISPATCHED' || s.lifecycle_status === 'INSTALLED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '0.2rem' }}>Linked to solar passports</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#dc2626' }}>DAMAGED / RMA</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'DAMAGED' || s.lifecycle_status === 'RETURNED' || s.lifecycle_status === 'UNDER_INSPECTION').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.2rem' }}>Quarantined stock</div>
            </div>
          </div>

          {/* Filter & Registration Action Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '320px' }}>
              <input
                type="text"
                placeholder="Search serial number, component name, or SKU..."
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                style={{ flex: 1, minWidth: '220px', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />

              <select
                value={serialStatusFilter}
                onChange={(e) => setSerialStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Lifecycle Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="REGISTERED">Registered</option>
                <option value="RESERVED">Reserved</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="INSTALLED">Installed</option>
                <option value="RETURNED">Returned</option>
                <option value="DAMAGED">Damaged</option>
                <option value="UNDER_INSPECTION">Under Inspection</option>
              </select>

              <select
                value={serialCategoryFilter}
                onChange={(e) => setSerialCategoryFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Hardware Types</option>
                <option value="PANEL">Panels (PV Modules)</option>
                <option value="INVERTER">Inverters</option>
                <option value="BATTERY">Batteries</option>
              </select>

              <select
                value={serialWhFilter}
                onChange={(e) => setSerialWhFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Warehouses</option>
                {warehousesList.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadSerials}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowRegisterModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} />
                <span>Register Serial Number</span>
              </button>
            </div>
          </div>

          {/* Serials Registry Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            {loadingSerials ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading serial inventory...</div>
            ) : serials.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <Barcode size={48} style={{ strokeWidth: 1.5, margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#475569' }}>No serial numbers found</div>
                <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Register incoming panel, inverter, or battery serials above.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Serial Number</th>
                      <th>Component / Model</th>
                      <th>Category</th>
                      <th>Depot Warehouse</th>
                      <th>Lifecycle Status</th>
                      <th>Project / Dispatch Link</th>
                      <th>Scanned / Logged</th>
                      <th>Transition Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serials.map((s) => {
                      const isInstalled = s.lifecycle_status === 'INSTALLED';
                      const isDispatched = s.lifecycle_status === 'DISPATCHED';
                      const isAvailable = s.lifecycle_status === 'AVAILABLE' || s.lifecycle_status === 'REGISTERED';
                      const isDamaged = s.lifecycle_status === 'DAMAGED' || s.lifecycle_status === 'RETURNED';

                      let badgeClass = 'badge-neutral';
                      if (isInstalled || isDispatched) badgeClass = 'badge-success';
                      else if (isAvailable) badgeClass = 'badge-info';
                      else if (isDamaged) badgeClass = 'badge-warning';

                      return (
                        <tr key={s.id}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                              {s.serial_number}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b' }}>
                              Format: {s.barcode_format || 'CODE128'}
                            </span>
                          </td>
                          <td>
                            <strong>{s.component_name}</strong>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                              SKU: {s.component_sku}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {s.component_category}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#334155' }}>{s.warehouse_name}</span>
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.72rem' }}>
                              {s.lifecycle_status}
                            </span>
                          </td>
                          <td>
                            {s.dispatch_number ? (
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                                Dispatch #{s.dispatch_number}
                              </span>
                            ) : s.order_id ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>
                                Order #{s.order_id}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Unassigned (Depot Stock)</span>
                            )}
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : 'N/A'}
                          </td>
                          <td>
                            <select
                              value={s.lifecycle_status}
                              onChange={(e) => handleUpdateSerialLifecycle(s.id, e.target.value)}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="AVAILABLE">AVAILABLE</option>
                              <option value="RESERVED">RESERVED</option>
                              <option value="ALLOCATED">ALLOCATED</option>
                              <option value="DISPATCHED">DISPATCHED</option>
                              <option value="INSTALLED">INSTALLED</option>
                              <option value="UNDER_INSPECTION">UNDER INSPECTION</option>
                              <option value="DAMAGED">DAMAGED</option>
                              <option value="RETURNED">RETURNED</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Register Serial Number Modal */}
          {showRegisterModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
                  Register Component Serial Number
                </h3>
                <form onSubmit={handleRegisterSerial} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Hardware Component</label>
                    <select
                      value={registerForm.component_id}
                      onChange={(e) => setRegisterForm({ ...registerForm, component_id: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {catalogProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {p.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Manufacturer Serial Number</label>
                      <button
                        type="button"
                        onClick={() => setShowRegisterCamera(!showRegisterCamera)}
                        style={{ fontSize: '0.72rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Camera size={13} />
                        <span>{showRegisterCamera ? 'Close Camera' : 'Use Camera Scanner'}</span>
                      </button>
                    </div>

                    {showRegisterCamera && (
                      <div style={{ marginBottom: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', padding: '0.5rem', background: '#f8fafc' }}>
                        <CameraCapture
                          onCapture={(file) => {
                            setShowRegisterCamera(false);
                          }}
                          onScanBarcode={(code) => {
                            setRegisterForm(prev => ({ ...prev, serial_number: code }));
                            setShowRegisterCamera(false);
                          }}
                          title="Point at manufacturer barcode / QR label"
                        />
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="e.g. WRE-550-2026-90412"
                      value={registerForm.serial_number}
                      onChange={(e) => setRegisterForm({ ...registerForm, serial_number: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                      Duplicate serials are rejected. Must match physical component barcode label.
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Warehouse Depot</label>
                      <select
                        value={registerForm.warehouse_id}
                        onChange={(e) => setRegisterForm({ ...registerForm, warehouse_id: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        {warehousesList.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Initial Status</label>
                      <select
                        value={registerForm.lifecycle_status}
                        onChange={(e) => setRegisterForm({ ...registerForm, lifecycle_status: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="AVAILABLE">AVAILABLE (Depot Stock)</option>
                        <option value="REGISTERED">REGISTERED (Intake Log)</option>
                        <option value="UNDER_INSPECTION">UNDER INSPECTION</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowRegisterModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                    >
                      Register Serial
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {actionSuccess && (
        <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.15)', border: '1.5px solid var(--solar-green-500)', borderRadius: '8px', color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} color="var(--solar-green-600)" />
          <span style={{ fontWeight: 600 }}>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}



      {/* TAB 3: Serial Numbers Registry & Lifecycle Tracking */}
      {activeTab === 'serials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>REGISTERED SERIALS</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{serials.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>Across all categories</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#059669' }}>AVAILABLE IN DEPOTS</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'AVAILABLE' || s.lifecycle_status === 'REGISTERED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem' }}>Ready for allocation</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ea580c' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#ea580c' }}>RESERVED / ALLOCATED</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#c2410c', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'RESERVED' || s.lifecycle_status === 'ALLOCATED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#ea580c', marginTop: '0.2rem' }}>Committed to orders</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#8b5cf6' }}>DISPATCHED / INSTALLED</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#6d28d9', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'DISPATCHED' || s.lifecycle_status === 'INSTALLED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '0.2rem' }}>Linked to solar passports</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#dc2626' }}>DAMAGED / RMA</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'DAMAGED' || s.lifecycle_status === 'RETURNED' || s.lifecycle_status === 'UNDER_INSPECTION').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.2rem' }}>Quarantined stock</div>
            </div>
          </div>

          {/* Filter & Registration Action Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '320px' }}>
              <input
                type="text"
                placeholder="Search serial number, component name, or SKU..."
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                style={{ flex: 1, minWidth: '220px', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />

              <select
                value={serialStatusFilter}
                onChange={(e) => setSerialStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Lifecycle Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="REGISTERED">Registered</option>
                <option value="RESERVED">Reserved</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="INSTALLED">Installed</option>
                <option value="RETURNED">Returned</option>
                <option value="DAMAGED">Damaged</option>
                <option value="UNDER_INSPECTION">Under Inspection</option>
              </select>

              <select
                value={serialCategoryFilter}
                onChange={(e) => setSerialCategoryFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Hardware Types</option>
                <option value="PANEL">Panels (PV Modules)</option>
                <option value="INVERTER">Inverters</option>
                <option value="BATTERY">Batteries</option>
              </select>

              <select
                value={serialWhFilter}
                onChange={(e) => setSerialWhFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Warehouses</option>
                {warehousesList.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadSerials}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowRegisterModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} />
                <span>Register Serial Number</span>
              </button>
            </div>
          </div>

          {/* Serials Registry Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            {loadingSerials ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading serial inventory...</div>
            ) : serials.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <Barcode size={48} style={{ strokeWidth: 1.5, margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#475569' }}>No serial numbers found</div>
                <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Register incoming panel, inverter, or battery serials above.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Serial Number</th>
                      <th>Component / Model</th>
                      <th>Category</th>
                      <th>Depot Warehouse</th>
                      <th>Lifecycle Status</th>
                      <th>Project / Dispatch Link</th>
                      <th>Scanned / Logged</th>
                      <th>Transition Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serials.map((s) => {
                      const isInstalled = s.lifecycle_status === 'INSTALLED';
                      const isDispatched = s.lifecycle_status === 'DISPATCHED';
                      const isAvailable = s.lifecycle_status === 'AVAILABLE' || s.lifecycle_status === 'REGISTERED';
                      const isDamaged = s.lifecycle_status === 'DAMAGED' || s.lifecycle_status === 'RETURNED';

                      let badgeClass = 'badge-neutral';
                      if (isInstalled || isDispatched) badgeClass = 'badge-success';
                      else if (isAvailable) badgeClass = 'badge-info';
                      else if (isDamaged) badgeClass = 'badge-warning';

                      return (
                        <tr key={s.id}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                              {s.serial_number}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b' }}>
                              Format: {s.barcode_format || 'CODE128'}
                            </span>
                          </td>
                          <td>
                            <strong>{s.component_name}</strong>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                              SKU: {s.component_sku}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {s.component_category}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#334155' }}>{s.warehouse_name}</span>
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.72rem' }}>
                              {s.lifecycle_status}
                            </span>
                          </td>
                          <td>
                            {s.dispatch_number ? (
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                                Dispatch #{s.dispatch_number}
                              </span>
                            ) : s.order_id ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>
                                Order #{s.order_id}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Unassigned (Depot Stock)</span>
                            )}
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : 'N/A'}
                          </td>
                          <td>
                            <select
                              value={s.lifecycle_status}
                              onChange={(e) => handleUpdateSerialLifecycle(s.id, e.target.value)}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="AVAILABLE">AVAILABLE</option>
                              <option value="RESERVED">RESERVED</option>
                              <option value="ALLOCATED">ALLOCATED</option>
                              <option value="DISPATCHED">DISPATCHED</option>
                              <option value="INSTALLED">INSTALLED</option>
                              <option value="UNDER_INSPECTION">UNDER INSPECTION</option>
                              <option value="DAMAGED">DAMAGED</option>
                              <option value="RETURNED">RETURNED</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Register Serial Number Modal */}
          {showRegisterModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
                  Register Component Serial Number
                </h3>
                <form onSubmit={handleRegisterSerial} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Hardware Component</label>
                    <select
                      value={registerForm.component_id}
                      onChange={(e) => setRegisterForm({ ...registerForm, component_id: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {catalogProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {p.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Manufacturer Serial Number</label>
                      <button
                        type="button"
                        onClick={() => setShowRegisterCamera(!showRegisterCamera)}
                        style={{ fontSize: '0.72rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Camera size={13} />
                        <span>{showRegisterCamera ? 'Close Camera' : 'Use Camera Scanner'}</span>
                      </button>
                    </div>

                    {showRegisterCamera && (
                      <div style={{ marginBottom: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', padding: '0.5rem', background: '#f8fafc' }}>
                        <CameraCapture
                          onCapture={(file) => {
                            setShowRegisterCamera(false);
                          }}
                          onScanBarcode={(code) => {
                            setRegisterForm(prev => ({ ...prev, serial_number: code }));
                            setShowRegisterCamera(false);
                          }}
                          title="Point at manufacturer barcode / QR label"
                        />
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="e.g. WRE-550-2026-90412"
                      value={registerForm.serial_number}
                      onChange={(e) => setRegisterForm({ ...registerForm, serial_number: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                      Duplicate serials are rejected. Must match physical component barcode label.
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Warehouse Depot</label>
                      <select
                        value={registerForm.warehouse_id}
                        onChange={(e) => setRegisterForm({ ...registerForm, warehouse_id: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        {warehousesList.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Initial Status</label>
                      <select
                        value={registerForm.lifecycle_status}
                        onChange={(e) => setRegisterForm({ ...registerForm, lifecycle_status: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="AVAILABLE">AVAILABLE (Depot Stock)</option>
                        <option value="REGISTERED">REGISTERED (Intake Log)</option>
                        <option value="UNDER_INSPECTION">UNDER INSPECTION</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowRegisterModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                    >
                      Register Serial
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: Dispatch Preparation, Serial Scanning & Passport Creation */}
      {activeTab === 'dispatch-prep' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Order & BOM Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.5rem' }}>
                1. Select Customer Order
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Only confirmed orders with allocated BOM inventory can be dispatched.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    onClick={() => handleSelectOrder(ord)}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: selectedOrder?.id === ord.id ? '2px solid var(--solar-green-500)' : '1px solid #e2e8f0',
                      background: selectedOrder?.id === ord.id ? 'rgba(16, 185, 129, 0.08)' : '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--navy-900)' }}>{ord.order_number}</strong>
                      <span className={`badge ${ord.stage === 'INVENTORY_ALLOCATED' ? 'badge-success' : 'badge-secondary'}`}>
                        {ord.stage}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {ord.customer_name} · ₹{(ord.total_contract_paise / 100).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Order BOM Line Items */}
            {selectedOrder && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.3rem' }}>
                  2. Bill of Materials ({selectedOrderBom?.items?.length || 0} Components)
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Order #{selectedOrder.order_number} · Select active component for barcode scanning:
                </p>

                {loadingBom ? (
                  <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Loading BOM items...
                  </div>
                ) : selectedOrderBom?.items && selectedOrderBom.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedOrderBom.items.map((it) => (
                      <div
                        key={it.component_id}
                        onClick={() => setSelectedComponentId(it.component_id.toString())}
                        style={{
                          padding: '0.55rem 0.75rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          border: selectedComponentId === it.component_id.toString() ? '1.5px solid var(--navy-800)' : '1px solid #e2e8f0',
                          background: selectedComponentId === it.component_id.toString() ? '#f1f5f9' : '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <strong style={{ color: 'var(--navy-900)' }}>{it.component_name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {it.category} · Qty: {it.quantity_required}
                          </div>
                        </div>
                        <span className="badge badge-info">{it.category}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#b91c1c' }}>
                    No BOM allocated yet for this order. Execute BOM allocation first.
                  </div>
                )}
              </div>
            )}

            {/* Transport Logistics Details */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.5rem' }}>
                3. Dispatch Logistics
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <FormField label="Vehicle Number" required>
                  <Input
                    value={dispatchDetails.vehicle_number}
                    onChange={(e) => setDispatchDetails({ ...dispatchDetails, vehicle_number: e.target.value })}
                  />
                </FormField>
                <FormField label="Driver Name">
                  <Input
                    value={dispatchDetails.driver_name}
                    onChange={(e) => setDispatchDetails({ ...dispatchDetails, driver_name: e.target.value })}
                  />
                </FormField>
                <FormField label="Driver Contact">
                  <Input
                    value={dispatchDetails.driver_phone}
                    onChange={(e) => setDispatchDetails({ ...dispatchDetails, driver_phone: e.target.value })}
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Right Column: Camera Scanner, Scanned Serials & Passport Generator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Component Camera Scanner */}
            <div className="card" style={{ padding: '1.25rem', background: '#0b1329', border: '1.5px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    4. Component Barcode & Serial Scanner
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                    Point camera at component barcode labels (Code128 / QR). Scans validate in real time against inventory records.
                  </p>
                </div>
                <span className="badge badge-success" style={{ background: 'var(--solar-green-500)', color: '#ffffff' }}>
                  Target: {selectedOrderBom?.items?.find((i) => i.component_id === parseInt(selectedComponentId))?.component_name || 'Component'}
                </span>
              </div>

              <CameraCapture
                mode="scan"
                title="Warehouse Dispatch Barcode Scanner"
                onScan={handleScanSerial}
                placeholderManual="Scan or enter manufacturer serial number (e.g. SN-WAAREE-550-019)..."
              />

              {/* Validation Result Box */}
              {validationResult && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: validationResult.valid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${validationResult.valid ? 'var(--solar-green-500)' : 'var(--red-600)'}`,
                    color: validationResult.valid ? 'var(--solar-green-400)' : '#fca5a5',
                  }}
                >
                  {validationResult.valid ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span>{validationResult.message}</span>
                </div>
              )}
            </div>

            {/* Scanned Serial Numbers Review Ledger */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy-900)', margin: 0 }}>
                    5. Scanned Components Manifest ({scannedSerials.length})
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                    Physical hardware serial numbers mapped to this order dispatch and Digital Passport.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--navy-900)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isPartial}
                      onChange={(e) => setIsPartial(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Partial Dispatch</span>
                  </label>

                  <button
                    type="button"
                    disabled={scannedSerials.length === 0 || submittingDispatch}
                    onClick={handleConfirmDispatchAndPassport}
                    className="btn btn-primary"
                    style={{
                      padding: '0.55rem 1.15rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, var(--solar-green-500), var(--solar-green-600))',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Send size={15} />
                    {submittingDispatch ? 'Confirming Dispatch...' : (isPartial ? 'Confirm Partial Dispatch' : 'Confirm Dispatch & Create Passport')}
                  </button>
                </div>
              </div>

              {scannedSerials.length > 0 ? (
                <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Physical Serial Number</th>
                        <th>Component</th>
                        <th>Category</th>
                        <th>Manufacturer</th>
                        <th>Time</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedSerials.map((s, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <strong style={{ fontFamily: 'monospace', color: 'var(--navy-900)' }}>
                              {s.serial_number}
                            </strong>
                          </td>
                          <td>{s.component_name}</td>
                          <td>
                            <span className="badge badge-info">{s.category}</span>
                          </td>
                          <td>{s.manufacturer}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.scanned_at}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleRemoveScannedSerial(idx)}
                              style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}
                              title="Remove serial"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#f8fafc', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Barcode size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                  <div>No serialized items scanned yet for Order #{selectedOrder?.order_number || 'N/A'}.</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Scan barcodes using device camera above or enter serial numbers manually.
                  </div>
                </div>
              )}
            </div>

            {/* Created Digital Solar Passport Certificate Card (Immediate Feedback) */}
            {createdPassportResult && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  borderRadius: '12px',
                  border: '1.5px solid var(--solar-green-500)',
                  padding: '1.5rem',
                  color: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--solar-green-400)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Digital Solar Passport Initialized
                    </span>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff', margin: '0.2rem 0' }}>
                      {createdPassportResult.passport_number}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0 }}>
                      Lifecycle Status:{' '}
                      <strong style={{ color: 'var(--solar-green-400)' }}>
                        {createdPassportResult.lifecycle_status}
                      </strong>{' '}
                      · Manifest #{createdPassportResult.dispatch_number}
                    </p>
                  </div>

                  <a
                    href={createdPassportResult.public_lookup_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <QrCode size={15} />
                    Open Public Passport Page
                  </a>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  {createdPassportResult.qr_code_svg && (
                    <div
                      style={{
                        background: '#ffffff',
                        padding: '0.5rem',
                        borderRadius: '8px',
                        width: '100px',
                        height: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      dangerouslySetInnerHTML={{ __html: createdPassportResult.qr_code_svg }}
                    />
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <div><strong>Customer QR Code Token:</strong></div>
                    <code style={{ color: 'var(--solar-green-400)', fontSize: '0.75rem' }}>
                      {createdPassportResult.qr_code_token}
                    </code>
                    <div style={{ marginTop: '0.35rem', color: '#94a3b8', fontSize: '0.72rem' }}>
                      Physical warehouse stock has been relieved. Installation #{createdPassportResult.installation_id} scheduled for field execution.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}



      {/* TAB 3: Serial Numbers Registry & Lifecycle Tracking */}
      {activeTab === 'serials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>REGISTERED SERIALS</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{serials.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>Across all categories</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#059669' }}>AVAILABLE IN DEPOTS</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'AVAILABLE' || s.lifecycle_status === 'REGISTERED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem' }}>Ready for allocation</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ea580c' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#ea580c' }}>RESERVED / ALLOCATED</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#c2410c', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'RESERVED' || s.lifecycle_status === 'ALLOCATED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#ea580c', marginTop: '0.2rem' }}>Committed to orders</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#8b5cf6' }}>DISPATCHED / INSTALLED</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#6d28d9', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'DISPATCHED' || s.lifecycle_status === 'INSTALLED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '0.2rem' }}>Linked to solar passports</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#dc2626' }}>DAMAGED / RMA</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'DAMAGED' || s.lifecycle_status === 'RETURNED' || s.lifecycle_status === 'UNDER_INSPECTION').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.2rem' }}>Quarantined stock</div>
            </div>
          </div>

          {/* Filter & Registration Action Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '320px' }}>
              <input
                type="text"
                placeholder="Search serial number, component name, or SKU..."
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                style={{ flex: 1, minWidth: '220px', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />

              <select
                value={serialStatusFilter}
                onChange={(e) => setSerialStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Lifecycle Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="REGISTERED">Registered</option>
                <option value="RESERVED">Reserved</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="INSTALLED">Installed</option>
                <option value="RETURNED">Returned</option>
                <option value="DAMAGED">Damaged</option>
                <option value="UNDER_INSPECTION">Under Inspection</option>
              </select>

              <select
                value={serialCategoryFilter}
                onChange={(e) => setSerialCategoryFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Hardware Types</option>
                <option value="PANEL">Panels (PV Modules)</option>
                <option value="INVERTER">Inverters</option>
                <option value="BATTERY">Batteries</option>
              </select>

              <select
                value={serialWhFilter}
                onChange={(e) => setSerialWhFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Warehouses</option>
                {warehousesList.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadSerials}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowRegisterModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} />
                <span>Register Serial Number</span>
              </button>
            </div>
          </div>

          {/* Serials Registry Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            {loadingSerials ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading serial inventory...</div>
            ) : serials.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <Barcode size={48} style={{ strokeWidth: 1.5, margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#475569' }}>No serial numbers found</div>
                <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Register incoming panel, inverter, or battery serials above.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Serial Number</th>
                      <th>Component / Model</th>
                      <th>Category</th>
                      <th>Depot Warehouse</th>
                      <th>Lifecycle Status</th>
                      <th>Project / Dispatch Link</th>
                      <th>Scanned / Logged</th>
                      <th>Transition Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serials.map((s) => {
                      const isInstalled = s.lifecycle_status === 'INSTALLED';
                      const isDispatched = s.lifecycle_status === 'DISPATCHED';
                      const isAvailable = s.lifecycle_status === 'AVAILABLE' || s.lifecycle_status === 'REGISTERED';
                      const isDamaged = s.lifecycle_status === 'DAMAGED' || s.lifecycle_status === 'RETURNED';

                      let badgeClass = 'badge-neutral';
                      if (isInstalled || isDispatched) badgeClass = 'badge-success';
                      else if (isAvailable) badgeClass = 'badge-info';
                      else if (isDamaged) badgeClass = 'badge-warning';

                      return (
                        <tr key={s.id}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                              {s.serial_number}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b' }}>
                              Format: {s.barcode_format || 'CODE128'}
                            </span>
                          </td>
                          <td>
                            <strong>{s.component_name}</strong>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                              SKU: {s.component_sku}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {s.component_category}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#334155' }}>{s.warehouse_name}</span>
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.72rem' }}>
                              {s.lifecycle_status}
                            </span>
                          </td>
                          <td>
                            {s.dispatch_number ? (
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                                Dispatch #{s.dispatch_number}
                              </span>
                            ) : s.order_id ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>
                                Order #{s.order_id}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Unassigned (Depot Stock)</span>
                            )}
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : 'N/A'}
                          </td>
                          <td>
                            <select
                              value={s.lifecycle_status}
                              onChange={(e) => handleUpdateSerialLifecycle(s.id, e.target.value)}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="AVAILABLE">AVAILABLE</option>
                              <option value="RESERVED">RESERVED</option>
                              <option value="ALLOCATED">ALLOCATED</option>
                              <option value="DISPATCHED">DISPATCHED</option>
                              <option value="INSTALLED">INSTALLED</option>
                              <option value="UNDER_INSPECTION">UNDER INSPECTION</option>
                              <option value="DAMAGED">DAMAGED</option>
                              <option value="RETURNED">RETURNED</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Register Serial Number Modal */}
          {showRegisterModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
                  Register Component Serial Number
                </h3>
                <form onSubmit={handleRegisterSerial} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Hardware Component</label>
                    <select
                      value={registerForm.component_id}
                      onChange={(e) => setRegisterForm({ ...registerForm, component_id: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {catalogProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {p.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Manufacturer Serial Number</label>
                      <button
                        type="button"
                        onClick={() => setShowRegisterCamera(!showRegisterCamera)}
                        style={{ fontSize: '0.72rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Camera size={13} />
                        <span>{showRegisterCamera ? 'Close Camera' : 'Use Camera Scanner'}</span>
                      </button>
                    </div>

                    {showRegisterCamera && (
                      <div style={{ marginBottom: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', padding: '0.5rem', background: '#f8fafc' }}>
                        <CameraCapture
                          onCapture={(file) => {
                            setShowRegisterCamera(false);
                          }}
                          onScanBarcode={(code) => {
                            setRegisterForm(prev => ({ ...prev, serial_number: code }));
                            setShowRegisterCamera(false);
                          }}
                          title="Point at manufacturer barcode / QR label"
                        />
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="e.g. WRE-550-2026-90412"
                      value={registerForm.serial_number}
                      onChange={(e) => setRegisterForm({ ...registerForm, serial_number: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                      Duplicate serials are rejected. Must match physical component barcode label.
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Warehouse Depot</label>
                      <select
                        value={registerForm.warehouse_id}
                        onChange={(e) => setRegisterForm({ ...registerForm, warehouse_id: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        {warehousesList.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Initial Status</label>
                      <select
                        value={registerForm.lifecycle_status}
                        onChange={(e) => setRegisterForm({ ...registerForm, lifecycle_status: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="AVAILABLE">AVAILABLE (Depot Stock)</option>
                        <option value="REGISTERED">REGISTERED (Intake Log)</option>
                        <option value="UNDER_INSPECTION">UNDER INSPECTION</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowRegisterModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                    >
                      Register Serial
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Historical Dispatches & Delivery Status */}
      {activeTab === 'manifests' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy-900)', margin: 0 }}>
                Warehouse Dispatch Manifests
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Track outgoing shipments, verified component serials, and delivery confirmations.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '160px', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="DELIVERED">Delivered</option>
              </Select>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dispatch #</th>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Vehicle & Driver</th>
                  <th>Dispatched Date</th>
                  <th>Scanned Serials</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong style={{ color: 'var(--navy-900)' }}>{d.dispatch_number}</strong>
                    </td>
                    <td>{d.order_number}</td>
                    <td>{d.customer_name}</td>
                    <td>
                      <div><strong>{d.vehicle_number}</strong></div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.driver_name} ({d.driver_phone})</div>
                    </td>
                    <td>{d.dispatch_date ? d.dispatch_date.split('T')[0] : 'N/A'}</td>
                    <td>
                      <span className="badge badge-info">
                        {d.serialized_items_count || d.serialized_items?.length || 0} Serials
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${d.status === 'DELIVERED' ? 'badge-success' : 'badge-warning'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {d.status !== 'DELIVERED' && d.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => handleMarkDelivered(d.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                          >
                            Mark Delivered
                          </button>
                        )}
                        {d.status === 'IN_TRANSIT' && (
                          <button
                            type="button"
                            onClick={() => handleCancelDispatch(d.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Serial Numbers Registry & Lifecycle Tracking */}
      {activeTab === 'serials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>REGISTERED SERIALS</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{serials.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>Across all categories</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#059669' }}>AVAILABLE IN DEPOTS</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'AVAILABLE' || s.lifecycle_status === 'REGISTERED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem' }}>Ready for allocation</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ea580c' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#ea580c' }}>RESERVED / ALLOCATED</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#c2410c', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'RESERVED' || s.lifecycle_status === 'ALLOCATED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#ea580c', marginTop: '0.2rem' }}>Committed to orders</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#8b5cf6' }}>DISPATCHED / INSTALLED</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#6d28d9', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'DISPATCHED' || s.lifecycle_status === 'INSTALLED').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '0.2rem' }}>Linked to solar passports</div>
            </div>
            <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#dc2626' }}>DAMAGED / RMA</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.2rem' }}>
                {serials.filter(s => s.lifecycle_status === 'DAMAGED' || s.lifecycle_status === 'RETURNED' || s.lifecycle_status === 'UNDER_INSPECTION').length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.2rem' }}>Quarantined stock</div>
            </div>
          </div>

          {/* Filter & Registration Action Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '320px' }}>
              <input
                type="text"
                placeholder="Search serial number, component name, or SKU..."
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                style={{ flex: 1, minWidth: '220px', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />

              <select
                value={serialStatusFilter}
                onChange={(e) => setSerialStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Lifecycle Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="REGISTERED">Registered</option>
                <option value="RESERVED">Reserved</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="INSTALLED">Installed</option>
                <option value="RETURNED">Returned</option>
                <option value="DAMAGED">Damaged</option>
                <option value="UNDER_INSPECTION">Under Inspection</option>
              </select>

              <select
                value={serialCategoryFilter}
                onChange={(e) => setSerialCategoryFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Hardware Types</option>
                <option value="PANEL">Panels (PV Modules)</option>
                <option value="INVERTER">Inverters</option>
                <option value="BATTERY">Batteries</option>
              </select>

              <select
                value={serialWhFilter}
                onChange={(e) => setSerialWhFilter(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Warehouses</option>
                {warehousesList.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadSerials}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowRegisterModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} />
                <span>Register Serial Number</span>
              </button>
            </div>
          </div>

          {/* Serials Registry Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            {loadingSerials ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading serial inventory...</div>
            ) : serials.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <Barcode size={48} style={{ strokeWidth: 1.5, margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#475569' }}>No serial numbers found</div>
                <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Register incoming panel, inverter, or battery serials above.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Serial Number</th>
                      <th>Component / Model</th>
                      <th>Category</th>
                      <th>Depot Warehouse</th>
                      <th>Lifecycle Status</th>
                      <th>Project / Dispatch Link</th>
                      <th>Scanned / Logged</th>
                      <th>Transition Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serials.map((s) => {
                      const isInstalled = s.lifecycle_status === 'INSTALLED';
                      const isDispatched = s.lifecycle_status === 'DISPATCHED';
                      const isAvailable = s.lifecycle_status === 'AVAILABLE' || s.lifecycle_status === 'REGISTERED';
                      const isDamaged = s.lifecycle_status === 'DAMAGED' || s.lifecycle_status === 'RETURNED';

                      let badgeClass = 'badge-neutral';
                      if (isInstalled || isDispatched) badgeClass = 'badge-success';
                      else if (isAvailable) badgeClass = 'badge-info';
                      else if (isDamaged) badgeClass = 'badge-warning';

                      return (
                        <tr key={s.id}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                              {s.serial_number}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b' }}>
                              Format: {s.barcode_format || 'CODE128'}
                            </span>
                          </td>
                          <td>
                            <strong>{s.component_name}</strong>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                              SKU: {s.component_sku}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {s.component_category}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#334155' }}>{s.warehouse_name}</span>
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.72rem' }}>
                              {s.lifecycle_status}
                            </span>
                          </td>
                          <td>
                            {s.dispatch_number ? (
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                                Dispatch #{s.dispatch_number}
                              </span>
                            ) : s.order_id ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>
                                Order #{s.order_id}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Unassigned (Depot Stock)</span>
                            )}
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : 'N/A'}
                          </td>
                          <td>
                            <select
                              value={s.lifecycle_status}
                              onChange={(e) => handleUpdateSerialLifecycle(s.id, e.target.value)}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="AVAILABLE">AVAILABLE</option>
                              <option value="RESERVED">RESERVED</option>
                              <option value="ALLOCATED">ALLOCATED</option>
                              <option value="DISPATCHED">DISPATCHED</option>
                              <option value="INSTALLED">INSTALLED</option>
                              <option value="UNDER_INSPECTION">UNDER INSPECTION</option>
                              <option value="DAMAGED">DAMAGED</option>
                              <option value="RETURNED">RETURNED</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Register Serial Number Modal */}
          {showRegisterModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
                  Register Component Serial Number
                </h3>
                <form onSubmit={handleRegisterSerial} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Hardware Component</label>
                    <select
                      value={registerForm.component_id}
                      onChange={(e) => setRegisterForm({ ...registerForm, component_id: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {catalogProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {p.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Manufacturer Serial Number</label>
                      <button
                        type="button"
                        onClick={() => setShowRegisterCamera(!showRegisterCamera)}
                        style={{ fontSize: '0.72rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Camera size={13} />
                        <span>{showRegisterCamera ? 'Close Camera' : 'Use Camera Scanner'}</span>
                      </button>
                    </div>

                    {showRegisterCamera && (
                      <div style={{ marginBottom: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', padding: '0.5rem', background: '#f8fafc' }}>
                        <CameraCapture
                          onCapture={(file) => {
                            setShowRegisterCamera(false);
                          }}
                          onScanBarcode={(code) => {
                            setRegisterForm(prev => ({ ...prev, serial_number: code }));
                            setShowRegisterCamera(false);
                          }}
                          title="Point at manufacturer barcode / QR label"
                        />
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="e.g. WRE-550-2026-90412"
                      value={registerForm.serial_number}
                      onChange={(e) => setRegisterForm({ ...registerForm, serial_number: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                      Duplicate serials are rejected. Must match physical component barcode label.
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Warehouse Depot</label>
                      <select
                        value={registerForm.warehouse_id}
                        onChange={(e) => setRegisterForm({ ...registerForm, warehouse_id: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        {warehousesList.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Initial Status</label>
                      <select
                        value={registerForm.lifecycle_status}
                        onChange={(e) => setRegisterForm({ ...registerForm, lifecycle_status: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="AVAILABLE">AVAILABLE (Depot Stock)</option>
                        <option value="REGISTERED">REGISTERED (Intake Log)</option>
                        <option value="UNDER_INSPECTION">UNDER INSPECTION</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowRegisterModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                    >
                      Register Serial
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
