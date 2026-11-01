import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { LoadingState, ErrorState } from '../components/StateBoxes';
import { api } from '../services/api';
import {
  IndianRupee,
  TrendingUp,
  Percent,
  Receipt,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  CheckCircle2,
  Clock,
  Truck,
  Wrench,
  AlertCircle,
  RefreshCw,
  Building2,
  FileCheck,
  ShieldCheck,
  Info,
  Download,
  Filter,
  Calendar,
  AlertTriangle,
  Cpu,
  Award,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export default function AnalyticsPage({ refreshTrigger }) {
  // Tabs: 'financial' | 'operational' | 'components' | 'ledger'
  const [activeTab, setActiveTab] = useState('financial');

  // Core Data
  const [financialData, setFinancialData] = useState(null);
  const [operationalData, setOperationalData] = useState(null);
  const [profitabilityData, setProfitabilityData] = useState(null);
  const [detailedOpsReport, setDetailedOpsReport] = useState(null);
  const [componentReport, setComponentReport] = useState(null);
  const [ledgerReport, setLedgerReport] = useState(null);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Financial Ledger Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // CSV Export State
  const [exportType, setExportType] = useState('financial');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fin, ops, prof, opsReport, compReport, finReport] = await Promise.all([
        api.getFinancialAnalytics(),
        api.getOperationalAnalytics(),
        api.getInstallationsProfitability().catch((e) => {
          console.warn('Profitability audit load warning:', e.message);
          return null;
        }),
        api.getOperationalReport().catch((e) => {
          console.warn('Operational report warning:', e.message);
          return null;
        }),
        api.getComponentQualityReport().catch((e) => {
          console.warn('Component quality report warning:', e.message);
          return null;
        }),
        api.getFinancialReport().catch((e) => {
          console.warn('Financial report warning:', e.message);
          return null;
        }),
      ]);

      setFinancialData(fin);
      setOperationalData(ops);
      setProfitabilityData(prof);
      setDetailedOpsReport(opsReport);
      setComponentReport(compReport);
      setLedgerReport(finReport);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLedgerFilter = async (e) => {
    if (e) e.preventDefault();
    setLedgerLoading(true);
    try {
      const filtered = await api.getFinancialReport({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setLedgerReport(filtered);
    } catch (err) {
      console.error('Failed to filter financial report:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleResetLedgerFilter = async () => {
    setStartDate('');
    setEndDate('');
    setLedgerLoading(true);
    try {
      const res = await api.getFinancialReport();
      setLedgerReport(res);
    } catch (err) {
      console.error('Failed to reset filter:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleDownloadCsv = (type) => {
    const reportKind = type || exportType;
    const url = api.getReportCsvUrl(reportKind);
    window.open(url, '_blank');
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  if (loading) {
    return <LoadingState message="Calculating real-time financial, operational and quality analytics..." />;
  }

  if (error) {
    return <ErrorState title="Unable to load analytics" message={error} onRetry={loadData} />;
  }

  // Component quality table columns
  const componentColumns = [
    {
      header: 'Component & SKU',
      accessor: 'name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            SKU: {row.sku} • {row.category}
          </div>
          {row.incomplete_data_warning && (
            <div style={{ fontSize: '0.7rem', color: 'var(--amber-600)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={12} /> {row.incomplete_data_warning}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Manufacturer & Supplier',
      accessor: 'manufacturer',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.manufacturer}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Supplier: {row.supplier_name || 'Direct OEM'} {row.supplier_rating ? `(★ ${row.supplier_rating}/5)` : ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Tier & Failure Rate',
      accessor: 'tier_grade',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.tier_grade?.replace('_', ' ')}</div>
          <div style={{ fontSize: '0.72rem', color: row.failure_rate_pct > 2 ? 'var(--red-600)' : '#64748b' }}>
            Defect: {row.failure_rate_pct}%
          </div>
        </div>
      ),
    },
    {
      header: 'Credibility Score',
      accessor: 'final_score',
      render: (row) => {
        let badgeColor = '#dcfce7';
        let textColor = '#15803d';
        if (row.final_score < 50) {
          badgeColor = '#fee2e2';
          textColor = '#dc2626';
        } else if (row.final_score < 70) {
          badgeColor = '#fef3c7';
          textColor = '#b45309';
        } else if (row.final_score < 85) {
          badgeColor = '#dbeafe';
          textColor = '#1d4ed8';
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy-900)' }}>
              {row.final_score}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                background: badgeColor,
                color: textColor,
              }}
            >
              {row.rating_label}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Data Completeness',
      accessor: 'data_completeness',
      render: (row) => {
        const isComplete = row.data_completeness === 'COMPLETE';
        const isPartial = row.data_completeness === 'PARTIAL';
        return (
          <span
            className={`badge ${
              isComplete ? 'badge-success' : isPartial ? 'badge-warning' : 'badge-danger'
            }`}
            style={{ fontSize: '0.7rem' }}
          >
            {row.data_completeness}
          </span>
        );
      },
    },
    {
      header: 'Procurement Recommendation',
      accessor: 'inventory_recommendation',
      render: (row) => (
        <span
          className="badge badge-neutral"
          style={{ fontSize: '0.7rem', fontWeight: 600 }}
        >
          {row.inventory_recommendation_label || row.inventory_recommendation}
        </span>
      ),
    },
    {
      header: 'Stock by Warehouse',
      accessor: 'stock_info',
      render: (row) => {
        const s = row.stock_info;
        if (!s || s.total_on_hand === 0) {
          return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>0 On Hand</span>;
        }
        return (
          <div style={{ fontSize: '0.75rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>
              {s.total_on_hand} Units ({s.total_reserved} Reserved)
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
              {s.depots?.map((d) => `${d.warehouse_name.split(' ')[0]}: ${d.qty_on_hand}`).join(' • ')}
            </div>
          </div>
        );
      },
    },
  ];

  // Financial Ledger columns
  const ledgerColumns = [
    {
      header: 'Order & Customer',
      accessor: 'order_number',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{row.order_number}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {row.customer_name} • {row.capacity_kw} kW
          </div>
        </div>
      ),
    },
    {
      header: 'Date',
      accessor: 'created_at',
      render: (row) => <span style={{ fontSize: '0.8rem', color: '#475569' }}>{row.created_at}</span>,
    },
    {
      header: 'Stage',
      accessor: 'stage',
      render: (row) => <StatusBadge status={row.stage} />,
    },
    {
      header: 'Contract Value',
      accessor: 'contract_value_inr',
      render: (row) => (
        <strong style={{ color: 'var(--navy-900)' }}>
          ₹{(row.contract_value_inr || 0).toLocaleString('en-IN')}
        </strong>
      ),
    },
    {
      header: 'Payments Received',
      accessor: 'payments_received_inr',
      render: (row) => (
        <span style={{ color: '#059669', fontWeight: 600 }}>
          ₹{(row.payments_received_inr || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'BOM Material COGS',
      accessor: 'bom_cogs_inr',
      render: (row) => <span>₹{(row.bom_cogs_inr || 0).toLocaleString('en-IN')}</span>,
    },
    {
      header: 'Site Expenses',
      accessor: 'site_expenses_inr',
      render: (row) => <span>₹{(row.site_expenses_inr || 0).toLocaleString('en-IN')}</span>,
    },
    {
      header: 'Est. Profit',
      accessor: 'estimated_profit_inr',
      render: (row) => (
        <span
          style={{
            fontWeight: 700,
            color: row.estimated_profit_inr >= 0 ? '#059669' : '#dc2626',
          }}
        >
          ₹{(row.estimated_profit_inr || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Est. Margin',
      accessor: 'estimated_margin_pct',
      render: (row) => (
        <span
          style={{
            fontWeight: 700,
            padding: '0.2rem 0.4rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            background: row.estimated_margin_pct >= 20 ? '#dcfce7' : '#fef9c3',
            color: row.estimated_margin_pct >= 20 ? '#15803d' : '#854d0e',
          }}
        >
          {row.estimated_margin_pct}%
        </span>
      ),
    },
    {
      header: 'Ind AS 115 Revenue',
      accessor: 'recognized_revenue_inr',
      render: (row) =>
        row.is_commissioned ? (
          <span style={{ fontWeight: 700, color: '#1d4ed8' }}>
            ₹{(row.recognized_revenue_inr || 0).toLocaleString('en-IN')}
          </span>
        ) : (
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
            Deferred (WIP)
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Enterprise Financial, Operational & Quality Analytics"
        description="Real-time EPC business intelligence, Ind AS 115 compliant margin ledgers, operational funnels, and component quality audits strictly verified against SQLite records."
        action={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Direct CSV Export Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.2rem 0.4rem' }}>
              <Download size={14} style={{ color: 'var(--navy-700)' }} />
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-900)', cursor: 'pointer', outline: 'none' }}
              >
                <option value="financial">Financial Audit CSV</option>
                <option value="operational">Operational Orders CSV</option>
                <option value="components">Component Credibility CSV</option>
                <option value="service">Service Tickets CSV</option>
              </select>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleDownloadCsv(exportType)}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              >
                Export CSV
              </button>
            </div>

            <button className="btn btn-secondary" onClick={loadData}>
              <RefreshCw size={15} style={{ marginRight: '0.4rem' }} /> Refresh Data
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'financial' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('financial')}
        >
          <IndianRupee size={16} style={{ marginRight: '0.4rem' }} /> Financial Performance & Margins
        </button>
        <button
          className={`btn ${activeTab === 'operational' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('operational')}
        >
          <BarChart3 size={16} style={{ marginRight: '0.4rem' }} /> EPC Pipeline, Funnel & Service
        </button>
        <button
          className={`btn ${activeTab === 'components' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('components')}
        >
          <Cpu size={16} style={{ marginRight: '0.4rem' }} /> Component Quality & Credibility Audit
        </button>
        <button
          className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ledger')}
        >
          <Receipt size={16} style={{ marginRight: '0.4rem' }} /> Project Financial Ledger & Date Filter
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FINANCIAL PERFORMANCE & MARGINS                                     */}
      {/* ========================================================================= */}
      {activeTab === 'financial' && financialData && (
        <div>
          {/* Financial KPI Cards */}
          <div className="metrics-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="metric-card">
              <div className="metric-header">
                <span>Total Contract Value</span>
                <div className="metric-icon-box green">
                  <IndianRupee size={18} />
                </div>
              </div>
              <div className="metric-value">
                ₹{(financialData.total_contract_value_inr || 0).toLocaleString('en-IN')}
              </div>
              <div className="metric-footer">
                From {financialData.confirmed_orders_count} confirmed contracts (quotes excluded)
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Advance Received</span>
                <div className="metric-icon-box green">
                  <Receipt size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: 'var(--solar-green-600)' }}>
                ₹{(financialData.advance_payments_received_inr || 0).toLocaleString('en-IN')}
              </div>
              <div className="metric-footer">Verified bank transfers & UPI milestones</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Outstanding Receivables</span>
                <div className="metric-icon-box amber">
                  <Clock size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: 'var(--amber-600)' }}>
                ₹{(financialData.outstanding_receivables_inr || 0).toLocaleString('en-IN')}
              </div>
              <div className="metric-footer">Pending dispatch & handover milestones</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Recorded Expenses</span>
                <div className="metric-icon-box blue">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="metric-value">
                ₹{(financialData.total_project_expenses_inr || 0).toLocaleString('en-IN')}
              </div>
              <div className="metric-footer">Labour, logistics & crane rentals</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Estimated Material Cost</span>
                <div className="metric-icon-box blue">
                  <Layers size={18} />
                </div>
              </div>
              <div className="metric-value">
                ₹{(financialData.estimated_cogs_inr || 0).toLocaleString('en-IN')}
              </div>
              <div className="metric-footer">Calculated from confirmed Order BOMs</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Estimated Gross Margin</span>
                <div className="metric-icon-box green">
                  <Percent size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: 'var(--solar-green-600)' }}>
                {financialData.margin_percentage}%
              </div>
              <div className="metric-footer">
                Net Margin: ₹{(financialData.estimated_project_margin_inr || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Financial Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Monthly Revenue Trend Area Chart */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} color="var(--solar-green-600)" />
                Monthly Confirmed Revenue (Past 6 Months)
              </h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={financialData.revenue_by_month} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tickFormatter={(val) => `₹${val / 100000}L`} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue_inr" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Order Value by System Capacity Tier */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieIcon size={18} color="var(--blue-600)" />
                Order Value by Capacity Tier
              </h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={financialData.order_value_by_capacity} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="capacity_tier" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tickFormatter={(val) => `₹${val / 100000}L`} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Contract Value']} />
                    <Bar dataKey="order_value_inr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Expense Breakdown & Payment Status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem' }}>
                Project Expense Categories Breakdown
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {financialData.expense_category_breakdown?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--navy-800)', textTransform: 'capitalize' }}>
                      {item.category}
                    </span>
                    <strong style={{ color: 'var(--navy-900)' }}>
                      ₹{Number(item.amount_inr).toLocaleString('en-IN')}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem' }}>
                Payment Status Across Confirmed Orders
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {financialData.payment_status_distribution?.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <span className="badge badge-neutral">{p.status}</span>
                    <strong style={{ color: 'var(--navy-900)' }}>{p.count} Orders</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Installation-Level Contribution Profitability Audit Table (Module 10 / Issue 3) */}
          {profitabilityData && (
            <div className="card" style={{ marginTop: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={20} style={{ color: 'var(--solar-green-600)' }} />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>
                      Installation-Level Contribution Profitability Audit
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                    Standard EPC Handover Accounting (Ind AS 115): 100% Contract Value recognized upon completed commissioning. Work-in-Progress (WIP) cash advances remain deferred contract liabilities.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ecfdf5', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46' }}>
                    Audit Standard: Completed-Contract EPC Recognition
                  </span>
                </div>
              </div>

              {/* Profitability Summary Metrics Bar */}
              {profitabilityData.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>RECOGNIZED REVENUE</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-900)', marginTop: '0.15rem' }}>
                      ₹{(profitabilityData.summary.total_recognized_revenue_inr || 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#059669', marginTop: '0.15rem' }}>
                      From {profitabilityData.summary.commissioned_projects_count} commissioned systems
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>MATERIAL COGS (BOM)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-900)', marginTop: '0.15rem' }}>
                      ₹{(profitabilityData.summary.total_material_cogs_inr || 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.15rem' }}>
                      BOM procurement costs
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>LABOUR & DIRECT EXPENSES</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-900)', marginTop: '0.15rem' }}>
                      ₹{((profitabilityData.summary.total_labour_inr || 0) + (profitabilityData.summary.total_direct_expenses_inr || 0)).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.15rem' }}>
                      Labour: ₹{(profitabilityData.summary.total_labour_inr || 0).toLocaleString('en-IN')} · Direct: ₹{(profitabilityData.summary.total_direct_expenses_inr || 0).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>RECOGNIZED PROFIT</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669', marginTop: '0.15rem' }}>
                      ₹{(profitabilityData.summary.recognized_projects_profit_inr || 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700, marginTop: '0.15rem' }}>
                      {profitabilityData.summary.recognized_projects_margin_pct != null ? `${profitabilityData.summary.recognized_projects_margin_pct}% Portfolio Margin` : 'Pending Commissioning'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>WIP PORTFOLIO</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d97706', marginTop: '0.15rem' }}>
                      {profitabilityData.summary.wip_projects_count} Projects
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#d97706', marginTop: '0.15rem' }}>
                      Revenue deferred until handover
                    </div>
                  </div>
                </div>
              )}

              {/* Table of Installations */}
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Order / Inst #</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Customer & System</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Contract Value</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Collected</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Recognized Rev</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Material COGS</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Labour & Exp</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Direct Costs</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Contribution Profit</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Margin (%)</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Audit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitabilityData.installations?.map((row) => {
                      const isComm = row.is_commissioned;
                      return (
                        <tr key={row.order_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{row.order_number}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.installation_number}</div>
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{row.customer_name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.capacity_kw} kW · {row.stage}</div>
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                            ₹{row.contract_value_inr.toLocaleString('en-IN')}
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#059669', fontWeight: 500 }}>
                            ₹{row.payments_received_inr.toLocaleString('en-IN')}
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                            {isComm ? (
                              <strong style={{ color: 'var(--navy-900)' }}>
                                ₹{row.recognized_revenue_inr.toLocaleString('en-IN')}
                              </strong>
                            ) : (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }} title="Advances are deferred liabilities until completed commissioning">
                                ₹0.00 (Deferred WIP)
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#475569' }}>
                            ₹{row.material_cogs_inr.toLocaleString('en-IN')}
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#475569' }}>
                            ₹{(row.labour_cost_inr + row.direct_expenses_inr).toLocaleString('en-IN')}
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                            ₹{row.total_direct_costs_inr.toLocaleString('en-IN')}
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: isComm && row.contribution_profit_inr >= 0 ? '#059669' : '#dc2626' }}>
                            {isComm ? `₹${row.contribution_profit_inr.toLocaleString('en-IN')}` : `-(₹${row.total_direct_costs_inr.toLocaleString('en-IN')}) WIP`}
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                            {isComm && row.contribution_margin_pct != null ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: row.contribution_margin_pct >= 25 ? '#dcfce7' : '#fef9c3',
                                color: row.contribution_margin_pct >= 25 ? '#15803d' : '#854d0e',
                              }}>
                                {row.contribution_margin_pct}%
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: '#fef3c7',
                                color: '#92400e',
                              }} title="Revenue deferred until commissioning. Zero divide-by-zero or distorted negative percentage.">
                                N/A (WIP)
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                            {row.completeness_status === 'COMPLETE_AUDITED' ? (
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                Audited Handover
                              </span>
                            ) : row.completeness_status === 'WIP_PENDING_HANDOVER' ? (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                WIP In Progress
                              </span>
                            ) : (
                              <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                                {row.completeness_status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Explanatory Accounting Note */}
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Info size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>
                  <strong>Financial Calculation Remediation:</strong> Standardized formula enforces <code>Contribution Profit = Recognized Revenue - Material COGS - Technician Labour - Direct Expenses</code>. For Work-in-Progress (WIP) installations, customer advance payments are recorded on the balance sheet as deferred liabilities rather than earned revenue, setting recognized revenue to ₹0.00 and margin to <em>N/A (WIP)</em>. This completely eliminates mathematical artifacts and distorted negative margins (-156.5% or -278%) caused by dividing total installation costs by partial advance milestones.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EPC PIPELINE, FUNNEL & SERVICE                                      */}
      {/* ========================================================================= */}
      {activeTab === 'operational' && operationalData && (
        <div>
          {/* Operational KPI Grid */}
          <div className="metrics-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="metric-card">
              <div className="metric-header">
                <span>Lead Conversion Rate</span>
                <div className="metric-icon-box green">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="metric-value">{operationalData.enquiry_conversion_rate}%</div>
              <div className="metric-footer">Inbound inquiries converted to orders</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Survey Approval Rate</span>
                <div className="metric-icon-box blue">
                  <FileCheck size={18} />
                </div>
              </div>
              <div className="metric-value">{operationalData.survey_approval_rate}%</div>
              <div className="metric-footer">Sites meeting technical feasibility criteria</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Quotation Acceptance</span>
                <div className="metric-icon-box green">
                  <Percent size={18} />
                </div>
              </div>
              <div className="metric-value">{operationalData.quotation_acceptance_rate}%</div>
              <div className="metric-footer">Proposals converted to confirmed contracts</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Inventory Utilization</span>
                <div className="metric-icon-box amber">
                  <Building2 size={18} />
                </div>
              </div>
              <div className="metric-value">{operationalData.inventory_utilization_pct}%</div>
              <div className="metric-footer">
                {operationalData.total_stock_reserved} of {operationalData.total_stock_on_hand} units reserved
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Commissioned Systems</span>
                <div className="metric-icon-box green">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: 'var(--solar-green-600)' }}>
                {operationalData.commissioned_systems}
              </div>
              <div className="metric-footer">Grid-synchronized solar installations</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Active Service Tickets</span>
                <div className="metric-icon-box red">
                  <Wrench size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: operationalData.open_service_tickets > 0 ? 'var(--amber-600)' : 'var(--solar-green-600)' }}>
                {operationalData.open_service_tickets}
              </div>
              <div className="metric-footer">Pending post-handover O&M requests</div>
            </div>
          </div>

          {/* Operational Funnel and Milestone Progress */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* 5-Stage EPC Funnel Horizontal Bar Chart */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} color="var(--solar-green-600)" />
                5-Stage Solar EPC Funnel
              </h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={operationalData.funnel_data}
                    margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 12, fill: '#1e293b' }} width={130} />
                    <Tooltip formatter={(value) => [value, 'Volume']} />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Installation Milestone Breakdown */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={18} color="var(--blue-600)" />
                Installation Milestone Progress
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>Scheduled Installations</span>
                    <strong style={{ fontSize: '1.1rem' }}>{operationalData.installation_progress?.SCHEDULED || 0}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Allocated and ready for technician mobilization
                  </div>
                </div>

                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>In Progress on Site</span>
                    <strong style={{ fontSize: '1.1rem' }}>{operationalData.installation_progress?.IN_PROGRESS || 0}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Mechanical mounting and wiring underway (7/8 checklist items complete)
                  </div>
                </div>

                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>Fully Commissioned</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--solar-green-600)' }}>
                      {operationalData.installation_progress?.COMMISSIONED || 0}
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Digital Solar Passport issued with active warranties
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Operations Detailed Breakdown Grid: Transfers, Service & Warranties */}
          {detailedOpsReport && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Multi-Warehouse Transfers Report */}
              <div className="card">
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Truck size={16} color="var(--blue-600)" />
                  Inter-Warehouse Transfers ({detailedOpsReport.transfers?.total || 0})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(detailedOpsReport.transfers?.by_status || {}).map(([st, cnt]) => (
                    <div key={st} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>{st}</span>
                      <strong style={{ color: 'var(--navy-900)' }}>{cnt} Transfers</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Backlog by Priority */}
              <div className="card">
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Wrench size={16} color="var(--amber-600)" />
                  Service Tickets by Priority ({detailedOpsReport.service_tickets?.total || 0})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(detailedOpsReport.service_tickets?.by_priority || {}).map(([pri, cnt]) => (
                    <div key={pri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                      <span
                        className={`badge ${
                          pri === 'CRITICAL' ? 'badge-danger' : pri === 'HIGH' ? 'badge-warning' : 'badge-neutral'
                        }`}
                        style={{ fontSize: '0.72rem' }}
                      >
                        {pri}
                      </span>
                      <strong style={{ color: 'var(--navy-900)' }}>{cnt} Tickets</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warranty Portfolio Health */}
              <div className="card">
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={16} color="var(--solar-green-600)" />
                  Warranty Portfolio Status
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#ecfdf5', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065f46' }}>Active Warranties</span>
                    <strong style={{ color: '#065f46' }}>{detailedOpsReport.warranties?.active || 0}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#fffbeb', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e' }}>Expiring within 90 Days</span>
                    <strong style={{ color: '#92400e' }}>{detailedOpsReport.warranties?.expiring_within_90_days || 0}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Expired Warranties</span>
                    <strong style={{ color: '#64748b' }}>{detailedOpsReport.warranties?.expired || 0}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dispatch Breakdown */}
          <div className="card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={18} color="var(--solar-green-600)" />
              Outbound Dispatch Status
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {Object.entries(operationalData.dispatch_status || {}).map(([st, count]) => (
                <div key={st} style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{st}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-900)', marginTop: '0.2rem' }}>
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COMPONENT QUALITY & CREDIBILITY AUDIT                               */}
      {/* ========================================================================= */}
      {activeTab === 'components' && componentReport && (
        <div>
          {/* Summary Cards */}
          <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="metric-card">
              <div className="metric-header">
                <span>Evaluated Components</span>
                <div className="metric-icon-box blue">
                  <Cpu size={18} />
                </div>
              </div>
              <div className="metric-value">{componentReport.total_evaluated || 0}</div>
              <div className="metric-footer">Catalog equipment evaluated by heuristic</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Average Credibility</span>
                <div className="metric-icon-box green">
                  <Award size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: 'var(--solar-green-600)' }}>
                {componentReport.average_score} / 100
              </div>
              <div className="metric-footer">Weighted catalog benchmark</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>High Credibility (85–100)</span>
                <div className="metric-icon-box green">
                  <ShieldCheck size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: 'var(--solar-green-600)' }}>
                {componentReport.distribution?.high || 0}
              </div>
              <div className="metric-footer">Tier 1 preferred procurement</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Incomplete Telemetry</span>
                <div className="metric-icon-box amber">
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: componentReport.incomplete_data_count > 0 ? 'var(--amber-600)' : 'var(--solar-green-600)' }}>
                {componentReport.incomplete_data_count || 0}
              </div>
              <div className="metric-footer">Missing failure rates or docs</div>
            </div>
          </div>

          {/* Incomplete Data Alert Banner */}
          {componentReport.incomplete_data_count > 0 && (
            <div
              className="card"
              style={{
                background: '#fffbeb',
                borderLeft: '4px solid #f59e0b',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '0.15rem' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.88rem' }}>
                    Credibility Audit Notice: Incomplete Supplier / Test Telemetry Detected
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#78350f', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    {componentReport.incomplete_data_count} components in the procurement catalog have partial or unverified laboratory certifications and defect statistics. In compliance with SunPower quality policies, missing values are <strong>strictly flagged rather than assumed to be 100%</strong>, and inventory recommendations are marked as <code>AUDIT REQUIRED</code> or <code>CONDITIONAL USE</code>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Component Quality Table */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem' }}>
              Equipment Reliability & Multi-Depot Stock Matrix
            </h3>
            <DataTable
              columns={componentColumns}
              data={componentReport.components || []}
              keyField="component_id"
              emptyMessage="No component quality evaluations available."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PROJECT FINANCIAL LEDGER & DATE FILTER                              */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <div>
          {/* Date Range Filter Bar */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
            <form onSubmit={handleApplyLedgerFilter} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.25rem' }}>
                  <Calendar size={13} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.25rem' }}>
                  <Calendar size={13} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={ledgerLoading}>
                <Filter size={14} style={{ marginRight: '0.35rem' }} />
                {ledgerLoading ? 'Filtering...' : 'Apply Date Filter'}
              </button>

              {(startDate || endDate) && (
                <button type="button" className="btn btn-secondary" onClick={handleResetLedgerFilter} disabled={ledgerLoading}>
                  Reset Range
                </button>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownloadCsv('financial')}
                >
                  <Download size={13} style={{ marginRight: '0.3rem' }} />
                  Export Ledger CSV
                </button>
              </div>
            </form>
          </div>

          {/* Filtered Range Overview Cards */}
          {ledgerReport?.overview && (
            <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="metric-card">
                <div className="metric-header">
                  <span>Filtered Orders</span>
                  <div className="metric-icon-box blue">
                    <Receipt size={18} />
                  </div>
                </div>
                <div className="metric-value">{ledgerReport.overview.total_orders_count}</div>
                <div className="metric-footer">Contracts in selected date range</div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span>Total Contract Value</span>
                  <div className="metric-icon-box green">
                    <IndianRupee size={18} />
                  </div>
                </div>
                <div className="metric-value">
                  ₹{(ledgerReport.overview.total_contract_value_inr || 0).toLocaleString('en-IN')}
                </div>
                <div className="metric-footer">Aggregate confirmed revenue commitment</div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span>Direct Project Costs</span>
                  <div className="metric-icon-box amber">
                    <Layers size={18} />
                  </div>
                </div>
                <div className="metric-value" style={{ color: 'var(--navy-900)' }}>
                  ₹{(ledgerReport.overview.total_direct_costs_inr || 0).toLocaleString('en-IN')}
                </div>
                <div className="metric-footer">BOM Material COGS + Site Expenses</div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span>Estimated Portfolio Profit</span>
                  <div className="metric-icon-box green">
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div className="metric-value" style={{ color: 'var(--solar-green-600)' }}>
                  ₹{(ledgerReport.overview.estimated_portfolio_profit_inr || 0).toLocaleString('en-IN')}
                </div>
                <div className="metric-footer">Contract value minus verified direct costs</div>
              </div>
            </div>
          )}

          {/* Project Ledger Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>
                  Project Financial Audit Ledger
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Accounting Standard: {ledgerReport?.accounting_standard || 'Ind AS 115 Completed-Contract Handover'}
                </span>
              </div>
            </div>

            <DataTable
              columns={ledgerColumns}
              data={ledgerReport?.projects || []}
              keyField="order_id"
              emptyMessage="No project financial records found for this date range."
            />
          </div>
        </div>
      )}
    </div>
  );
}
