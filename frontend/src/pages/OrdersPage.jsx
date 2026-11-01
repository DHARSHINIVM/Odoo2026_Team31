import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import DocumentManager from '../components/DocumentManager';
import { FormField, Input, Select, Textarea } from '../components/FormControls';
import { ErrorState } from '../components/StateBoxes';
import { api } from '../services/api';
import {
  ShoppingBag,
  Eye,
  Calendar,
  IndianRupee,
  Zap,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Shuffle,
  Truck,
  Wrench,
  QrCode,
  CheckCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  TrendingUp,
  Receipt,
  CreditCard,
} from 'lucide-react';

const STAGE_FILTERS = [
  'ALL',
  'CONFIRMED',
  'BOM_GENERATED',
  'INVENTORY_ALLOCATED',
  'DISPATCHED',
  'INSTALLATION_SCHEDULED',
  'INSTALLED',
  'COMMISSIONED',
];

export default function OrdersPage({ refreshTrigger }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter
  const [stageFilter, setStageFilter] = useState('ALL');

  // Modals
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Financials & Profitability State (Feature 4)
  const [financialsModalOpen, setFinancialsModalOpen] = useState(false);
  const [financialOrder, setFinancialOrder] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialTab, setFinancialTab] = useState('summary'); // 'summary' | 'payment' | 'expense'
  const [financialActionLoading, setFinancialActionLoading] = useState(false);
  const [financialError, setFinancialError] = useState(null);
  const [financialSuccess, setFinancialSuccess] = useState(null);

  const [paymentForm, setPaymentForm] = useState({
    amount_inr: '',
    payment_type: 'MILESTONE',
    payment_method: 'NEFT_RTGS',
    reference_number: '',
    notes: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    category: 'LABOUR',
    amount_inr: '',
    description: '',
    vendor_name: '',
    invoice_number: '',
  });

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrders({
        stage: stageFilter !== 'ALL' ? stageFilter : undefined,
      });
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [refreshTrigger, stageFilter]);

  const openFinancialsModal = async (ord) => {
    setFinancialOrder(ord);
    setFinancialsModalOpen(true);
    setFinancialTab('summary');
    setFinancialError(null);
    setFinancialSuccess(null);
    setFinancialLoading(true);
    try {
      const res = await api.getOrderFinancials(ord.id);
      setFinancialData(res);
    } catch (err) {
      setFinancialError(err.message);
    } finally {
      setFinancialLoading(false);
    }
  };

  const refreshFinancials = async () => {
    if (!financialOrder) return;
    setFinancialLoading(true);
    try {
      const res = await api.getOrderFinancials(financialOrder.id);
      setFinancialData(res);
      await loadOrders();
    } catch (err) {
      setFinancialError(err.message);
    } finally {
      setFinancialLoading(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount_inr || parseFloat(paymentForm.amount_inr) <= 0) {
      setFinancialError('Please enter a valid payment amount.');
      return;
    }
    setFinancialActionLoading(true);
    setFinancialError(null);
    try {
      const res = await api.recordOrderPayment(financialOrder.id, {
        amount_inr: parseFloat(paymentForm.amount_inr),
        payment_type: paymentForm.payment_type,
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number,
        notes: paymentForm.notes,
      });
      setFinancialSuccess(res.message);
      setPaymentForm({
        amount_inr: '',
        payment_type: 'MILESTONE',
        payment_method: 'NEFT_RTGS',
        reference_number: '',
        notes: '',
      });
      setFinancialTab('summary');
      await refreshFinancials();
      setTimeout(() => setFinancialSuccess(null), 4000);
    } catch (err) {
      setFinancialError(err.message);
    } finally {
      setFinancialActionLoading(false);
    }
  };

  const handleRecordExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount_inr || parseFloat(expenseForm.amount_inr) <= 0) {
      setFinancialError('Please enter a valid expense amount.');
      return;
    }
    setFinancialActionLoading(true);
    setFinancialError(null);
    try {
      const res = await api.recordOrderExpense(financialOrder.id, {
        category: expenseForm.category,
        amount_inr: parseFloat(expenseForm.amount_inr),
        description: expenseForm.description,
        vendor_name: expenseForm.vendor_name,
        invoice_number: expenseForm.invoice_number,
      });
      setFinancialSuccess(res.message);
      setExpenseForm({
        category: 'LABOUR',
        amount_inr: '',
        description: '',
        vendor_name: '',
        invoice_number: '',
      });
      setFinancialTab('summary');
      await refreshFinancials();
      setTimeout(() => setFinancialSuccess(null), 4000);
    } catch (err) {
      setFinancialError(err.message);
    } finally {
      setFinancialActionLoading(false);
    }
  };

  const openDetailModal = (ord) => {
    setSelectedOrder(ord);
    setIsDetailModalOpen(true);
  };

  const columns = [
    {
      header: 'Order #',
      accessor: 'order_number',
      render: (o) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{o.order_number}</span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Quote: {o.quotation_number || `ID #${o.quotation_id}`}
          </div>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (o) => (
        <div>
          <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {o.customer_city} · {o.customer_phone}
          </div>
        </div>
      ),
    },
    {
      header: 'Capacity',
      accessor: 'system_capacity_kw',
      render: (o) => (
        <span style={{ fontWeight: 700, color: 'var(--solar-green-600)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
          <Zap size={14} />
          {o.system_capacity_kw ? `${o.system_capacity_kw} kW` : 'Custom'}
        </span>
      ),
    },
    {
      header: 'Contract Value',
      accessor: 'total_contract_paise',
      render: (o) => (
        <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>
          ₹{(o.total_contract_paise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Advance Paid',
      accessor: 'advance_received_paise',
      render: (o) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--solar-green-600)' }}>
            ₹{(o.advance_received_paise / 100).toLocaleString('en-IN')}
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Req: ₹{(o.advance_required_paise / 100).toLocaleString('en-IN')}
          </div>
        </div>
      ),
    },
    {
      header: 'Payment',
      accessor: 'payment_status',
      render: (o) => <StatusBadge status={o.payment_status} />,
    },
    {
      header: 'Stage',
      accessor: 'stage',
      render: (o) => <StatusBadge status={o.stage} />,
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (o) => (
        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          {o.stage === 'CONFIRMED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/bom?tab=orders-bom&orderId=${o.id}`)}
              title="Generate Bill of Materials"
            >
              <FileSpreadsheet size={13} /> Compile BOM
            </button>
          )}
          {o.stage === 'BOM_GENERATED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/inventory?tab=allocate&orderId=${o.id}`)}
              title="Allocate Warehouse Inventory"
            >
              <Shuffle size={13} /> Allocate
            </button>
          )}
          {o.stage === 'INVENTORY_ALLOCATED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/dispatch')}
              title="Dispatch Allocated Materials"
            >
              <Truck size={13} /> Dispatch
            </button>
          )}
          {o.stage === 'DISPATCHED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/dispatch?tab=serials')}
              title="Capture Serial Numbers"
            >
              <Truck size={13} /> Serials
            </button>
          )}
          {(o.stage === 'INSTALLATION_SCHEDULED' || o.stage === 'IN_PROGRESS' || o.stage === 'INSTALLED') && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/installations?orderId=${o.id}`)}
              title="Quality Commissioning Checklist"
            >
              <Wrench size={13} /> Commission
            </button>
          )}
          {o.stage === 'COMMISSIONED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/solar-passport?orderId=${o.id}`)}
              title="View Digital Solar Passport"
            >
              <QrCode size={13} /> Passport
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openFinancialsModal(o)}
            title="Project Financials & Profitability Ledger"
            style={{ color: '#047857', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
          >
            <IndianRupee size={13} /> Financials
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openDetailModal(o)}
            title="Inspect Order File"
          >
            <Eye size={13} /> File
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Installation Orders"
        description="Active commercial solar contracts converted from accepted quotations, ready for BOM compilation and warehouse allocation."
      />

      {/* Stage Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>
          Filter Stage:
        </span>
        {STAGE_FILTERS.map((st) => (
          <button
            key={st}
            className={`btn btn-sm ${stageFilter === st ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStageFilter(st)}
          >
            {st.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Failed to load orders" message={error} onRetry={loadOrders} />
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          searchPlaceholder="Search order #, customer name..."
          searchKey="order_number"
          isLoading={loading}
          emptyMessage="No orders found. Accept an active quotation to convert it into a confirmed installation order."
        />
      )}

      {/* Order File Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Order Master File: ${selectedOrder?.order_number}`}
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </button>
            {selectedOrder?.stage === 'CONFIRMED' && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  navigate(`/bom?tab=orders-bom&orderId=${selectedOrder.id}`);
                }}
              >
                <FileSpreadsheet size={14} /> Compile Engineering BOM
              </button>
            )}
            {selectedOrder?.stage === 'BOM_GENERATED' && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  navigate(`/inventory?tab=allocate&orderId=${selectedOrder.id}`);
                }}
              >
                <Shuffle size={14} /> Allocate Warehouse Inventory
              </button>
            )}
          </div>
        }
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Order Lifecycle Stage</span>
                <div><StatusBadge status={selectedOrder.stage} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Confirmation Date</span>
                <p style={{ fontWeight: 600 }}>{selectedOrder.created_at?.split('T')[0]}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Customer</span>
                <p style={{ fontWeight: 600 }}>{selectedOrder.customer_name}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedOrder.customer_city} · {selectedOrder.customer_phone}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Contract Reference</span>
                <p style={{ fontWeight: 600 }}>Quotation: {selectedOrder.quotation_number}</p>
                {selectedOrder.enquiry_number && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lead: {selectedOrder.enquiry_number}</p>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Contract Value</span>
                <p style={{ fontWeight: 800, color: 'var(--navy-900)', fontSize: '1.15rem' }}>
                  ₹{(selectedOrder.total_contract_paise / 100).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Advance Milestone</span>
                <p style={{ fontWeight: 700, color: 'var(--solar-green-600)', fontSize: '1.15rem' }}>
                  ₹{(selectedOrder.advance_received_paise / 100).toLocaleString('en-IN')}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Status: {selectedOrder.payment_status}</span>
              </div>
            </div>

            {/* Next Operations in Stage 3 Banner */}
            <div style={{ padding: '0.85rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid var(--solar-green-100)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--solar-green-600)', fontWeight: 700 }}>
                <ArrowRight size={16} />
                <span>Next Operational Milestones (Stage 3):</span>
              </div>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--navy-800)' }}>
                <li>Compile Bill of Materials (BOM) based on {selectedOrder.system_capacity_kw || 5} kW system size.</li>
                <li>Execute Multi-Warehouse Inventory Allocation across Pune, Mumbai, and Nashik.</li>
                <li>Generate warehouse picklist and transportation dispatch manifest.</li>
              </ul>
            </div>

            {/* Document Management Section */}
            <DocumentManager
              entityType="ORDER"
              entityId={selectedOrder.id}
              entityIdentifier={selectedOrder.order_number}
              compact={true}
              title="Order Contracts, POs & Commercial Invoices"
            />
          </div>
        )}
      </Modal>

      {/* ==================== PROJECT FINANCIALS & PROFITABILITY MODAL (FEATURE 4) ==================== */}
      <Modal
        isOpen={financialsModalOpen}
        onClose={() => setFinancialsModalOpen(false)}
        title={`Project Financials: ${financialOrder?.order_number || ''} — ${financialOrder?.customer_name || ''}`}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={refreshFinancials} disabled={financialLoading}>
              <RefreshCw size={13} className={financialLoading ? 'spin' : ''} /> Refresh Ledger
            </button>
            <button className="btn btn-primary" onClick={() => setFinancialsModalOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {financialError && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', border: '1px solid var(--red-600)', borderRadius: '6px', color: 'var(--red-600)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            <span>{financialError}</span>
          </div>
        )}

        {financialSuccess && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#ecfdf5', border: '1px solid var(--solar-green-400)', borderRadius: '6px', color: 'var(--solar-green-600)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} />
            <span>{financialSuccess}</span>
          </div>
        )}

        {financialLoading && !financialData ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
            <p>Loading project financial statements...</p>
          </div>
        ) : financialData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Ind AS 115 Accounting Banner */}
            <div style={{ padding: '0.65rem 0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.78rem', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <strong>Standard:</strong> {financialData.accounting_standard}
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                Stage: {financialData.stage}
              </span>
            </div>

            {/* Financial KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid var(--navy-600)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Contract Value
                </span>
                <p style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--navy-900)', marginTop: '0.2rem' }}>
                  ₹{financialData.contract_value_inr.toLocaleString('en-IN')}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Capacity: {financialData.system_capacity_kw} kW
                </span>
              </div>

              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid var(--solar-green-500)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Payments Collected
                </span>
                <p style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--solar-green-600)', marginTop: '0.2rem' }}>
                  ₹{financialData.payments_received_inr.toLocaleString('en-IN')}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--solar-green-600)', fontWeight: 600 }}>
                  {financialData.contract_value_inr > 0
                    ? `${Math.round((financialData.payments_received_inr / financialData.contract_value_inr) * 100)}% collected`
                    : '0%'}
                </span>
              </div>

              <div className="card" style={{ padding: '0.85rem', borderLeft: financialData.outstanding_balance_inr > 0 ? '4px solid var(--amber-600)' : '4px solid #10b981' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Outstanding Balance
                </span>
                <p style={{ fontWeight: 800, fontSize: '1.25rem', color: financialData.outstanding_balance_inr > 0 ? 'var(--amber-600)' : '#10b981', marginTop: '0.2rem' }}>
                  ₹{financialData.outstanding_balance_inr.toLocaleString('en-IN')}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {financialData.outstanding_balance_inr === 0 ? 'Fully Paid' : 'Pending Milestone'}
                </span>
              </div>

              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid #6366f1' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Recorded Project Costs
                </span>
                <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#4338ca', marginTop: '0.2rem' }}>
                  ₹{financialData.total_recorded_costs_inr.toLocaleString('en-IN')}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  COGS: ₹{financialData.bom_cogs_inr.toLocaleString('en-IN')} · Exp: ₹{financialData.recorded_expenses_inr.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid #059669' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Forecast Gross Profit
                </span>
                <p style={{ fontWeight: 800, fontSize: '1.25rem', color: financialData.estimated_gross_profit_inr >= 0 ? '#059669' : 'var(--red-600)', marginTop: '0.2rem' }}>
                  ₹{financialData.estimated_gross_profit_inr.toLocaleString('en-IN')}
                </p>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669' }}>
                  {financialData.estimated_margin_pct != null ? `${financialData.estimated_margin_pct}% Margin` : 'Pending COGS'}
                </span>
              </div>

              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Recognized Revenue (Ind AS 115)
                </span>
                <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1d4ed8', marginTop: '0.2rem' }}>
                  ₹{financialData.recognized_revenue_inr.toLocaleString('en-IN')}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {financialData.recognized_margin_pct != null ? `${financialData.recognized_margin_pct}% Handover Margin` : 'Handover Pending'}
                </span>
              </div>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
              <button
                className={`btn btn-sm ${financialTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFinancialTab('summary')}
              >
                <Receipt size={14} /> Ledger & History
              </button>
              <button
                className={`btn btn-sm ${financialTab === 'payment' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFinancialTab('payment')}
              >
                <CreditCard size={14} /> + Record Milestone Payment
              </button>
              <button
                className={`btn btn-sm ${financialTab === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFinancialTab('expense')}
              >
                <TrendingUp size={14} /> + Log Project Expense
              </button>
            </div>

            {/* Sub-Tab 1: Summary & Itemized Ledger */}
            {financialTab === 'summary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Payments Ledger Table */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <IndianRupee size={15} /> Milestone Payments Received ({financialData.payments?.length || 0})
                  </h4>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Method</th>
                          <th>Reference / UTR</th>
                          <th>Notes</th>
                          <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financialData.payments?.length > 0 ? (
                          financialData.payments.map((p) => (
                            <tr key={p.id}>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.payment_date}</td>
                              <td>
                                <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                                  {p.payment_type}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.8rem' }}>{p.payment_method}</td>
                              <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.reference_number || '—'}</td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.notes || '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--solar-green-600)' }}>
                                ₹{p.amount_inr.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              No milestone payments recorded yet. Use the "+ Record Milestone Payment" tab above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Project Expenses Table */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Receipt size={15} /> Actual Project Expenses Incurred ({financialData.expenses?.length || 0})
                  </h4>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Category</th>
                          <th>Description</th>
                          <th>Vendor</th>
                          <th>Invoice #</th>
                          <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financialData.expenses?.length > 0 ? (
                          financialData.expenses.map((e) => (
                            <tr key={e.id}>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.expense_date}</td>
                              <td>
                                <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                                  {e.category}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{e.description}</td>
                              <td style={{ fontSize: '0.8rem' }}>{e.vendor_name || '—'}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.invoice_number || '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                                ₹{e.amount_inr.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              No site expenses logged yet. Use the "+ Log Project Expense" tab above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Record Milestone Payment */}
            {financialTab === 'payment' && (
              <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ padding: '0.65rem 0.85rem', background: '#ecfdf5', borderRadius: '6px', fontSize: '0.82rem', color: '#047857' }}>
                  Milestone payments automatically update order payment status and outstanding balances without double-counting.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <FormField label="Payment Amount (INR ₹)" required>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="e.g. 150000"
                      value={paymentForm.amount_inr}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount_inr: e.target.value })}
                      required
                    />
                  </FormField>

                  <FormField label="Payment Type" required>
                    <Select
                      value={paymentForm.payment_type}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}
                    >
                      <option value="ADVANCE">Advance (Deposit)</option>
                      <option value="MILESTONE">Milestone Progress Payment</option>
                      <option value="FINAL_SETTLEMENT">Final Settlement / Handover</option>
                      <option value="SUBSIDY_DISBURSAL">PM Surya Ghar Subsidy Disbursal</option>
                    </Select>
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <FormField label="Payment Method" required>
                    <Select
                      value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    >
                      <option value="NEFT_RTGS">NEFT / RTGS Bank Transfer</option>
                      <option value="UPI">UPI Digital Payment</option>
                      <option value="CHEQUE">Bank Cheque / DD</option>
                      <option value="CASH">Cash Deposit</option>
                    </Select>
                  </FormField>

                  <FormField label="Reference / Transaction / UTR #">
                    <Input
                      placeholder="e.g. HDFC20261031001"
                      value={paymentForm.reference_number}
                      onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                    />
                  </FormField>
                </div>

                <FormField label="Payment Notes">
                  <Textarea
                    rows={2}
                    placeholder="e.g. Received 2nd milestone advance upon delivery of solar panels and inverters..."
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  />
                </FormField>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setFinancialTab('summary')}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={financialActionLoading}>
                    {financialActionLoading ? 'Recording...' : 'Commit Milestone Payment'}
                  </button>
                </div>
              </form>
            )}

            {/* Sub-Tab 3: Record Project Expense */}
            {financialTab === 'expense' && (
              <form onSubmit={handleRecordExpense} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ padding: '0.65rem 0.85rem', background: '#eff6ff', borderRadius: '6px', fontSize: '0.82rem', color: '#1e40af' }}>
                  Log actual project expenses to calculate precise project-level profitability and contribution margins.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <FormField label="Expense Category" required>
                    <Select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    >
                      <option value="LABOUR">Site Installation Labour</option>
                      <option value="TRANSPORT">Freight & Warehouse Transport</option>
                      <option value="COMPONENTS_BOS">Auxiliary Balance of System (BOS)</option>
                      <option value="PERMITS_DISCOM">DISCOM Net Metering & CEIG Permits</option>
                      <option value="CRANE_EQUIPMENT">Crane / Lifting Equipment Rental</option>
                      <option value="MISCELLANEOUS">Miscellaneous Site Overheads</option>
                    </Select>
                  </FormField>

                  <FormField label="Expense Amount (INR ₹)" required>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="e.g. 18500"
                      value={expenseForm.amount_inr}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount_inr: e.target.value })}
                      required
                    />
                  </FormField>
                </div>

                <FormField label="Expense Description / Purpose" required>
                  <Input
                    placeholder="e.g. Rooftop structure fabrication labour charges (4 technicians x 2 days)"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    required
                  />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <FormField label="Vendor / Contractor Name">
                    <Input
                      placeholder="e.g. Sahyadri Solar Fabricators"
                      value={expenseForm.vendor_name}
                      onChange={(e) => setExpenseForm({ ...expenseForm, vendor_name: e.target.value })}
                    />
                  </FormField>

                  <FormField label="Invoice / Receipt Number">
                    <Input
                      placeholder="e.g. SSF-2026-881"
                      value={expenseForm.invoice_number}
                      onChange={(e) => setExpenseForm({ ...expenseForm, invoice_number: e.target.value })}
                    />
                  </FormField>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setFinancialTab('summary')}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={financialActionLoading}>
                    {financialActionLoading ? 'Recording...' : 'Record Project Expense'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

