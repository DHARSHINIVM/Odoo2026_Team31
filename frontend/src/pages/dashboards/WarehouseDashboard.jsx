import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Package, Boxes, Truck, AlertTriangle, CheckCircle2,
  Warehouse as WhIcon, ArrowRightLeft, ShieldAlert, BarChart2,
  ExternalLink
} from 'lucide-react';

export default function WarehouseDashboard({ refreshTrigger }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getWarehouseDashboard();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading Depot & Supply Chain Hub...</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', background: '#fef2f2', color: '#b91c1c' }}>Error: {error}</div>;
  }

  const kpis = data?.kpis || {};
  const warehouses = data?.warehouses || [];
  const lowStock = data?.low_stock_alerts || [];
  const dispatches = data?.pending_dispatches || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #713f12 0%, #451a03 100%)', padding: '1.5rem 2rem', borderRadius: '12px', color: '#ffffff', border: '1px solid #ca8a04' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fef08a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Multi-Depot Supply Chain & Inventory
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0' }}>
            Warehouse Operations Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#fde047' }}>
            Stock allocations, BOM component reservations, and dispatch vehicle staging across 3 depots.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/inventory" className="btn btn-secondary btn-sm" style={{ background: '#854d0e', color: '#fff', border: 'none' }}>
            <Boxes size={14} />
            <span>Depots & Stock</span>
          </Link>
          <Link to="/inventory?tab=transfers" className="btn btn-secondary btn-sm" style={{ background: '#a16207', color: '#fff', border: 'none' }}>
            <ArrowRightLeft size={14} />
            <span>Stock Transfers</span>
          </Link>
          <Link to="/dispatch" className="btn btn-primary btn-sm" style={{ background: '#eab308', color: '#000', border: 'none' }}>
            <Truck size={14} />
            <span>Dispatches</span>
          </Link>
        </div>
      </div>

      {/* Comprehensive Warehouse KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #ca8a04' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Total Physical Stock</span>
            <Boxes size={17} style={{ color: '#ca8a04' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.total_on_hand || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Across all 3 Warehouses</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Available Stock</span>
            <CheckCircle2 size={17} style={{ color: '#059669' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669' }}>
            {kpis.available_stock || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 500 }}>Unreserved Units</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Reserved Stock</span>
            <Package size={17} style={{ color: '#ea580c' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.total_reserved || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: 500 }}>Committed to Orders</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #dc2626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Low Stock Items</span>
            <AlertTriangle size={17} style={{ color: '#dc2626' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: (kpis.low_stock_alerts_count || 0) > 0 ? '#dc2626' : '#0f172a' }}>
            {kpis.low_stock_alerts_count || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 500 }}>Below Reorder Threshold</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Pending Goods Receipts</span>
            <ArrowRightLeft size={17} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.pending_receipts || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 500 }}>In-Transit Transfers</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Pending Reservations</span>
            <Package size={17} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.pending_reservations || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 500 }}>Confirmed Orders</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #0891b2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Allocation Requests</span>
            <Boxes size={17} style={{ color: '#0891b2' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.pending_allocations || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#0891b2', fontWeight: 500 }}>Awaiting Stock Lock</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #b91c1c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Procurement Shortages</span>
            <ShieldAlert size={17} style={{ color: '#b91c1c' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: (kpis.shortage_count || 0) > 0 ? '#b91c1c' : '#0f172a' }}>
            {kpis.shortage_count || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#b91c1c', fontWeight: 500 }}>Depots Out of Stock</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #d97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Pending Dispatches</span>
            <Truck size={17} style={{ color: '#d97706' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.pending_dispatches || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 500 }}>Staged Vehicles</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #16a34a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Completed Dispatches</span>
            <CheckCircle2 size={17} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.completed_dispatches || 0}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 500 }}>Delivered to Sites</span>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #64748b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Returns & Damaged</span>
            <AlertTriangle size={17} style={{ color: '#64748b' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {(kpis.damaged_movements || 0) + (kpis.returns_movements || 0)}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>Damaged/RMA Units</span>
        </div>
      </div>

      {/* Warehouse Depots Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {warehouses.map((wh) => (
          <div key={wh.id || wh.warehouse_id} className="card" style={{ padding: '1.25rem', borderTop: '3px solid #ca8a04' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <WhIcon size={18} style={{ color: '#ca8a04' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>{wh.name}</h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 1rem' }}>{wh.location || wh.city} ({wh.code})</p>
            
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>On Hand</span>
                <strong>{wh.total_units || wh.total_items || 0} units</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Reserved</span>
                <strong style={{ color: '#ea580c' }}>{wh.reserved_units || wh.reserved_items || 0} units</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Available</span>
                <strong style={{ color: '#059669' }}>{wh.available_units || wh.available_items || 0} units</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Alerts & Dispatches */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr', gap: '1.25rem' }}>
        
        {/* Reorder Alerts */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={16} style={{ color: '#dc2626' }} />
            <span>Critical Reorder Alerts</span>
          </h3>

          {lowStock.length === 0 ? (
            <p style={{ color: '#10b981', fontSize: '0.85rem' }}>All depots are healthy.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {lowStock.map((item, idx) => (
                <div key={idx} style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#991b1b', display: 'block' }}>{item.component_name}</strong>
                    <span style={{ fontSize: '0.72rem', color: '#b91c1c' }}>{item.warehouse}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.9rem' }}>{item.available} Left</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#7f1d1d' }}>Min: {item.min_threshold}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Dispatches */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={16} style={{ color: '#ca8a04' }} />
            <span>Active Dispatches & Consignments</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {dispatches.map((dsp) => (
              <div key={dsp.id} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{dsp.dispatch_number}</strong>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                    Vehicle: {dsp.vehicle_number} · Driver: {dsp.driver_name}
                  </span>
                </div>
                <div>
                  <span className={`badge ${dsp.status === 'DELIVERED' ? 'badge-success' : 'badge-primary'}`}>
                    {dsp.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Recent Inventory Movements Audit Trail */}
      {data?.recent_movements && data.recent_movements.length > 0 && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Boxes size={16} style={{ color: '#ca8a04' }} />
              <span>Authoritative Stock Movements Audit Log</span>
            </h3>
            <Link to="/inventory?tab=movements" style={{ fontSize: '0.78rem', color: '#ca8a04', fontWeight: 600 }}>
              View Complete Ledger →
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Component</th>
                  <th>Depot</th>
                  <th>Type</th>
                  <th>Qty Change</th>
                  <th>Audit Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ color: '#64748b' }}>{new Date(m.created_at).toLocaleString()}</td>
                    <td><strong>{m.component_name}</strong></td>
                    <td>{m.warehouse_name}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: m.quantity_change > 0 ? '#16a34a' : m.quantity_change < 0 ? '#dc2626' : '#64748b' }}>
                      {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                    </td>
                    <td style={{ color: '#475569', fontSize: '0.75rem' }}>{m.notes || 'Automated stock commit'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

