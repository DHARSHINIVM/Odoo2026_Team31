import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import {
  Users, ShoppingBag, TrendingUp, DollarSign, AlertTriangle,
  Award, ArrowUpRight, CheckCircle2, ShieldCheck, Clock,
  Truck, Wrench, Boxes, HeadphonesIcon, QrCode, Layers,
  AlertCircle, ChevronRight, RefreshCw, Settings, FileText
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area
} from 'recharts';

export default function AdminDashboard({ refreshTrigger }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('executive'); // executive, financials, operations, service

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminDashboard();
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
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={24} className="loading-spinner" style={{ margin: '0 auto 0.75rem' }} />
        <div>Loading Executive Command Dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', background: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#b91c1c' }}>
        Failed to load Admin Dashboard: {error}
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const funnel = data?.funnel_data || [];
  const chartData = data?.revenue_chart || [];
  const subsidies = data?.subsidies_summary || {};
  const lowStock = data?.low_stock_alerts || [];
  const recentOrders = data?.recent_orders || [];
  const recentPayments = data?.recent_payments || [];
  const exceptions = data?.operational_exceptions || [];
  const surveyProgress = data?.survey_progress || {};
  const dispatchProgress = data?.dispatch_progress || {};
  const installProgress = data?.installation_progress || {};
  const warrantyOversight = data?.warranty_oversight || {};
  const serviceOversight = data?.service_oversight || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Executive Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '1.5rem 2rem', borderRadius: '12px', color: '#ffffff', border: '1px solid #334155' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Executive Operations Hub
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0' }}>
            Solar EPC Enterprise Command Workspace
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            Live business-wide visibility across Sales, Surveys, Inventory, Field EPC, Warranties, and Financials.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link to="/master-data" className="btn btn-secondary btn-sm" style={{ background: '#334155', color: '#fff', border: 'none' }}>
            <Settings size={14} />
            <span>Master Data</span>
          </Link>
          <Link to="/users" className="btn btn-secondary btn-sm" style={{ background: '#334155', color: '#fff', border: 'none' }}>
            <Users size={14} />
            <span>Staff RBAC</span>
          </Link>
          <Link to="/audit-logs" className="btn btn-secondary btn-sm" style={{ background: '#334155', color: '#fff', border: 'none' }}>
            <ShieldCheck size={14} />
            <span>Audit Trail</span>
          </Link>
          <button className="btn btn-primary btn-sm" onClick={loadData} title="Refresh metrics">
            <RefreshCw size={14} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="card" style={{ padding: '0.4rem 0.6rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
          {[
            { id: 'executive', label: 'Executive Overview', icon: Layers },
            { id: 'financials', label: 'Financial Oversight', icon: DollarSign },
            { id: 'operations', label: 'Operational Lifecycle & Exceptions', icon: Wrench },
            { id: 'service', label: 'Warranties, Passports & Service', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW 1: EXECUTIVE OVERVIEW                                     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'executive' && (
        <>
          {/* Primary Metric Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
            {/* Total Enquiries & Customers */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Customers & Leads</span>
                <Users size={18} style={{ color: '#2563eb' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                {kpis.total_customers || 0}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {kpis.total_enquiries || 0} Total Enquiries Generated
              </span>
            </div>

            {/* Active Projects & Confirmed Orders */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Active Projects</span>
                <ShoppingBag size={18} style={{ color: '#059669' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                {kpis.active_projects || kpis.confirmed_orders || 0}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 500 }}>
                {kpis.confirmed_orders || 0} Total Confirmed Orders
              </span>
            </div>

            {/* Total Order Value */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Total Order Value</span>
                <DollarSign size={18} style={{ color: '#0284c7' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                ₹{((kpis.total_contract_inr || 0) / 100000).toFixed(2)} L
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                ₹{(kpis.total_contract_inr || 0).toLocaleString()} Total Contracted
              </span>
            </div>

            {/* Verified Payments Received */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Money Received</span>
                <TrendingUp size={18} style={{ color: '#16a34a' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a' }}>
                ₹{((kpis.verified_payments_inr || kpis.advance_received_inr || 0) / 100000).toFixed(2)} L
              </div>
              <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 500 }}>
                {kpis.collection_rate_pct || 0}% Collection Rate
              </span>
            </div>

            {/* Commissioned Plants */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Commissioned Plants</span>
                <CheckCircle2 size={18} style={{ color: '#10b981' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                {kpis.completed_installations || 0} / {kpis.total_installations || 0}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {kpis.total_passports || 0} Digital Solar Passports
              </span>
            </div>

            {/* Open Tickets & Exceptions */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Open Service Tickets</span>
                <HeadphonesIcon size={18} style={{ color: '#ea580c' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                {kpis.open_service_tickets || 0}
              </div>
              <span style={{ fontSize: '0.72rem', color: (kpis.critical_tickets_count || 0) > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                {kpis.critical_tickets_count || 0} Critical Escalations
              </span>
            </div>
          </div>

          {/* Revenue Chart & Funnel Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.25rem' }}>
            {/* Revenue Trend */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recognized EPC Revenue Trend</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Billing cycles and confirmed contract milestones</span>
                </div>
                <span className="badge badge-primary">6-Month Trend</span>
              </div>

              <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'Contract Value']} />
                    <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#adminRevGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* EPC Conversion Funnel */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>EPC Conversion Pipeline</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Throughput from Lead to Commissioned</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {funnel.map((step, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{step.stage}</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{step.count} units</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: idx === 4 ? '#10b981' : '#f59e0b',
                          width: `${Math.min(100, (step.count / Math.max(1, funnel[0]?.count || 1)) * 100)}%`,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Operational Exceptions & Alerts */}
          {exceptions && exceptions.length > 0 && (
            <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #ea580c' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412' }}>
                  <AlertTriangle size={18} color="#ea580c" />
                  <span>Operational Exceptions & Overdue Activities ({exceptions.length})</span>
                </h3>
                <span className="badge badge-warning">Requires Attention</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {exceptions.slice(0, 6).map((ex, idx) => (
                  <div key={idx} style={{ padding: '0.75rem 1rem', background: '#fff7ed', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.82rem', color: '#9a3412' }}>{ex.title}</strong>
                      <span className={`badge ${ex.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                        {ex.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#7c2d12', margin: '2px 0 6px' }}>
                      {ex.details}
                    </p>
                    {ex.link && (
                      <Link to={ex.link} style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <span>Take Action</span>
                        <ChevronRight size={12} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Row: Subsidies & Low Stock */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* Subsidy Summary */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>PM Surya Ghar Subsidy Tracker</h3>
                <Link to="/subsidies" style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                  View All
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <span style={{ fontSize: '0.72rem', color: '#065f46', fontWeight: 600 }}>Total Applications</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#064e3b' }}>
                    {subsidies.total || 0}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <span style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>Pending Inspection</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#78350f' }}>
                    {subsidies.pending_inspection || 0}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600 }}>Approved</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a' }}>
                    {subsidies.approved || 0}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Disbursed Pool</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                    ₹{((subsidies.disbursed_inr || 0) / 1000).toFixed(0)}k
                  </div>
                </div>
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} style={{ color: '#ea580c' }} />
                  <span>Low Stock Inventory Alerts</span>
                </h3>
                <Link to="/inventory" style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                  Depot Inventory
                </Link>
              </div>

              {lowStock.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#10b981', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={24} style={{ margin: '0 auto 0.5rem' }} />
                  All depot components above reorder thresholds.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {lowStock.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#fff7ed', borderRadius: '6px', border: '1px solid #ffedd5', fontSize: '0.8rem' }}>
                      <div>
                        <strong style={{ color: '#9a3412', display: 'block' }}>{item.component_name}</strong>
                        <span style={{ color: '#c2410c', fontSize: '0.72rem' }}>{item.warehouse}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>{item.available} Left</span>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#9a3412' }}>Min: {item.min_threshold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 2: FINANCIAL OVERSIGHT                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'financials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Financial Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {/* Total Contracted Order Value */}
            <div className="card" style={{ padding: '1.25rem', background: '#f8fafc' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Order Value</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                ₹{(kpis.total_contract_inr || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Total Contracted Value across {kpis.confirmed_orders || 0} Orders
              </span>
            </div>

            {/* Money Received (Verified Payments) */}
            <div className="card" style={{ padding: '1.25rem', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <span style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600 }}>Actual Money Received</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', margin: '0.25rem 0' }}>
                ₹{(kpis.verified_payments_inr || kpis.advance_received_inr || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                {kpis.collection_rate_pct || 0}% Total Contract Collected
              </span>
            </div>

            {/* Outstanding Balances */}
            <div className="card" style={{ padding: '1.25rem', background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <span style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: 600 }}>Outstanding Balance</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c2410c', margin: '0.25rem 0' }}>
                ₹{(kpis.outstanding_balance_inr || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#ea580c' }}>
                Pending Milestone Collections
              </span>
            </div>

            {/* Recognized Revenue on Commissioned Plants */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Recognized Revenue</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                ₹{(kpis.recognized_revenue_inr || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 500 }}>
                {kpis.contribution_margin_pct || 0}% Gross Contribution Margin
              </span>
            </div>
          </div>

          {/* Payment History Records Table */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Recorded Customer Payment Transactions
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Audit log of milestone payment receipts and verification status
                </span>
              </div>
              <Link to="/orders" className="btn btn-secondary btn-sm">
                View All Orders
              </Link>
            </div>

            {recentPayments.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                No payment transactions recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Payment #</th>
                      <th>Order #</th>
                      <th>Customer Name</th>
                      <th>Milestone</th>
                      <th>Mode</th>
                      <th>Amount Received</th>
                      <th>Status</th>
                      <th>Payment Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((p) => (
                      <tr key={p.id}>
                        <td><code>{p.payment_number}</code></td>
                        <td><strong>{p.order_number}</strong></td>
                        <td>{p.customer}</td>
                        <td>
                          <span className="badge badge-secondary">{p.milestone}</span>
                        </td>
                        <td>{p.payment_mode}</td>
                        <td>
                          <strong style={{ color: '#059669' }}>₹{p.amount_inr.toLocaleString()}</strong>
                        </td>
                        <td>
                          <span className={`badge ${p.status === 'COMPLETED' || p.status === 'VERIFIED' ? 'badge-success' : 'badge-warning'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>{p.paid_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 3: OPERATIONAL LIFECYCLE & EXCEPTIONS                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'operations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Three Pipeline Progress Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {/* Survey Progress */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Site Survey Lifecycle
                </h4>
                <Link to="/surveys" style={{ fontSize: '0.75rem', color: '#2563eb' }}>Surveys</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Surveys</span>
                  <strong>{surveyProgress.total || 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pending Assignment</span>
                  <span className="badge badge-secondary">{surveyProgress.pending_assignment || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Field Visit In Progress</span>
                  <span className="badge badge-primary">{surveyProgress.in_progress || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Awaiting Manager Approval</span>
                  <span className="badge badge-warning">{surveyProgress.pending_approval || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Approved & Qualified</span>
                  <span className="badge badge-success">{surveyProgress.approved || 0}</span>
                </div>
              </div>
            </div>

            {/* Dispatch Progress */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Warehouse & Logistics Dispatches
                </h4>
                <Link to="/dispatch" style={{ fontSize: '0.75rem', color: '#2563eb' }}>Dispatches</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Dispatches</span>
                  <strong>{dispatchProgress.total || 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Picking & Preparation</span>
                  <span className="badge badge-secondary">{dispatchProgress.draft_pending || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>In Transit to Site</span>
                  <span className="badge badge-warning">{dispatchProgress.in_transit || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Delivered & Serial Verified</span>
                  <span className="badge badge-success">{dispatchProgress.delivered || 0}</span>
                </div>
              </div>
            </div>

            {/* Installation Progress */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Field EPC & Commissioning
                </h4>
                <Link to="/installations" style={{ fontSize: '0.75rem', color: '#2563eb' }}>Installations</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Installations</span>
                  <strong>{installProgress.total || 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Scheduled / Assigned</span>
                  <span className="badge badge-secondary">{installProgress.scheduled || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mechanical & Electrical WIP</span>
                  <span className="badge badge-primary">{installProgress.in_progress || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Commissioned & Tested</span>
                  <span className="badge badge-success">{installProgress.commissioned || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Full Exceptions Table */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              All System Exceptions & Overdue Flags
            </h4>
            {exceptions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#10b981' }}>
                <CheckCircle2 size={24} style={{ margin: '0 auto 0.5rem' }} />
                Zero operational exceptions or overdue activities. All operations running within SLA!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Exception Category</th>
                      <th>Severity</th>
                      <th>Details</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((ex, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{ex.title}</strong>
                        </td>
                        <td>
                          <span className={`badge ${ex.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>
                            {ex.severity}
                          </span>
                        </td>
                        <td style={{ color: '#475569' }}>{ex.details}</td>
                        <td>
                          {ex.link ? (
                            <Link to={ex.link} className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem' }}>
                              Resolve
                            </Link>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 4: WARRANTIES, PASSPORTS & SERVICE                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'service' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Active Warranties</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', margin: '0.25rem 0' }}>
                {warrantyOversight.active || 0}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Across PV modules, inverters, and battery banks
              </span>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Expiring Warranties (90 Days)</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', margin: '0.25rem 0' }}>
                {warrantyOversight.expiring_soon || 0}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#d97706' }}>
                Eligible for Annual Maintenance Contract (AMC)
              </span>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Open Service Complaints</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ea580c', margin: '0.25rem 0' }}>
                {serviceOversight.open || 0}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {serviceOversight.resolved || 0} Complaints Successfully Resolved
              </span>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Solar Passports Issued</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', margin: '0.25rem 0' }}>
                {warrantyOversight.total_passports || 0}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#2563eb' }}>
                Public QR-verified digital passports
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/service" className="btn btn-primary btn-sm">
              <HeadphonesIcon size={14} />
              <span>Open Service Desk</span>
            </Link>
            <Link to="/warranties" className="btn btn-secondary btn-sm">
              <ShieldCheck size={14} />
              <span>Warranty Directory</span>
            </Link>
            <Link to="/solar-passport" className="btn btn-secondary btn-sm">
              <QrCode size={14} />
              <span>Solar Passports</span>
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
