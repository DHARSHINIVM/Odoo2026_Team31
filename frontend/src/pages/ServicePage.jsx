import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import DocumentManager from '../components/DocumentManager';
import { FormField, Input, Select, Textarea } from '../components/FormControls';
import { ErrorState } from '../components/StateBoxes';
import { api } from '../services/api';
import {
  HeadphonesIcon,
  ShieldCheck,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  Check,
  User,
  Calendar,
  Building2,
  Zap,
} from 'lucide-react';

const ISSUE_CATEGORIES = [
  'GENERAL_QUERY',
  'INVERTER_FAULT',
  'GENERATION_DROP',
  'PHYSICAL_DAMAGE',
  'GRID_TRIP',
  'METER_FAULT',
  'WIRING_ISSUE',
];

const PRIORITIES = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TICKET_STATUSES = ['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function ServicePage({ refreshTrigger }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'tickets';

  const setActiveTab = (tabName) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabName === 'tickets') {
        next.delete('tab');
      } else {
        next.set('tab', tabName);
      }
      return next;
    });
  };

  // State: Tickets
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // State: Customers for ticket creation
  const [customers, setCustomers] = useState([]);

  // State: Modals
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [ticketFormData, setTicketFormData] = useState({
    customer_id: '',
    serial_number: '',
    issue_category: 'GENERAL_QUERY',
    priority: 'MEDIUM',
    description: '',
    assigned_technician: 'SunPower O&M Rapid Response Team',
    is_warranty_covered: true,
  });
  const [serialChecking, setSerialChecking] = useState(false);
  const [warrantyCheckResult, setWarrantyCheckResult] = useState(null);

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [updateFormData, setUpdateFormData] = useState({
    status: 'RESOLVED',
    priority: 'MEDIUM',
    assigned_technician: '',
    is_warranty_covered: true,
    diagnosis_notes: '',
    parts_used: '',
    labour_hours: '1.5',
    labour_cost_inr: '0',
    repair_expenses_inr: '0',
    customer_confirmation_notes: '',
    resolution_notes: '',
  });

  // State: Warranty Lookup
  const [warrantyQuery, setWarrantyQuery] = useState('SNG-5K-2026-90412');
  const [warrantyResult, setWarrantyResult] = useState(null);
  const [warrantyLoading, setWarrantyLoading] = useState(false);
  const [warrantyError, setWarrantyError] = useState(null);

  // State: Feedback
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // 1. Fetch Service Tickets
  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const data = await api.getServiceTickets({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
      });
      setTickets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTickets(false);
    }
  };

  // 2. Fetch Customers
  const loadCustomers = async () => {
    try {
      const custs = await api.getCustomers();
      setCustomers(custs);
      if (custs.length > 0 && !ticketFormData.customer_id) {
        setTicketFormData((prev) => ({ ...prev, customer_id: custs[0].id.toString() }));
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    }
  };

  useEffect(() => {
    loadTickets();
    loadCustomers();
  }, [refreshTrigger]);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, priorityFilter]);

  // Handler: Search Warranty
  const handleWarrantySearch = async (e) => {
    if (e) e.preventDefault();
    if (!warrantyQuery.trim()) return;
    setWarrantyLoading(true);
    setWarrantyError(null);
    try {
      const res = await api.getWarrantyBySerial(warrantyQuery.trim());
      setWarrantyResult(res);
    } catch (err) {
      setWarrantyError(err.message);
      setWarrantyResult(null);
    } finally {
      setWarrantyLoading(false);
    }
  };

  // Run initial warranty search on tab open
  useEffect(() => {
    if (activeTab === 'warranty' && !warrantyResult) {
      handleWarrantySearch();
    }
  }, [activeTab]);

  // Live Warranty Check during Ticket Creation
  const handleVerifySerialWarranty = async () => {
    if (!ticketFormData.serial_number?.trim()) return;
    setSerialChecking(true);
    setWarrantyCheckResult(null);
    try {
      const res = await api.checkWarranty(ticketFormData.serial_number.trim());
      setWarrantyCheckResult(res);
      setTicketFormData((prev) => ({
        ...prev,
        is_warranty_covered: res.is_eligible,
      }));
    } catch (err) {
      setWarrantyCheckResult({
        is_eligible: false,
        status: 'UNVERIFIED',
        message: err.message || 'Component serial not registered in warranty database.',
      });
      setTicketFormData((prev) => ({
        ...prev,
        is_warranty_covered: false,
      }));
    } finally {
      setSerialChecking(false);
    }
  };

  // Handler: Create Service Ticket
  const handleCreateTicketSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        customer_id: parseInt(ticketFormData.customer_id),
        serial_number: ticketFormData.serial_number || null,
        issue_category: ticketFormData.issue_category,
        priority: ticketFormData.priority,
        description: ticketFormData.description,
        assigned_technician: ticketFormData.assigned_technician,
        is_warranty_covered: ticketFormData.is_warranty_covered,
      };
      const res = await api.createServiceTicket(payload);
      setActionSuccess(`Service ticket ${res.ticket_number} created successfully.`);
      setIsNewTicketModalOpen(false);
      setTicketFormData({
        customer_id: customers.length > 0 ? customers[0].id.toString() : '',
        serial_number: '',
        issue_category: 'GENERAL_QUERY',
        priority: 'MEDIUM',
        description: '',
        assigned_technician: 'SunPower O&M Rapid Response Team',
        is_warranty_covered: true,
      });
      setWarrantyCheckResult(null);
      await loadTickets();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handler: Update Ticket
  const handleUpdateTicketSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setError(null);
    try {
      const payload = {
        status: updateFormData.status,
        priority: updateFormData.priority,
        assigned_technician: updateFormData.assigned_technician,
        is_warranty_covered: updateFormData.is_warranty_covered,
        diagnosis_notes: updateFormData.diagnosis_notes,
        parts_used: updateFormData.parts_used,
        labour_hours: parseFloat(updateFormData.labour_hours || '0'),
        labour_cost_paise: Math.round(parseFloat(updateFormData.labour_cost_inr || '0') * 100),
        repair_expenses_paise: Math.round(parseFloat(updateFormData.repair_expenses_inr || '0') * 100),
        customer_confirmation_notes: updateFormData.customer_confirmation_notes,
        resolution_notes: updateFormData.resolution_notes,
      };
      const res = await api.updateServiceTicket(selectedTicket.id, payload);
      setActionSuccess(`Ticket ${res.ticket_number} updated to ${res.status}.`);
      setIsUpdateModalOpen(false);
      setSelectedTicket(null);
      await loadTickets();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const openUpdateModal = (ticket) => {
    setSelectedTicket(ticket);
    setUpdateFormData({
      status: ticket.status === 'RESOLVED' ? 'CLOSED' : ticket.status || 'RESOLVED',
      priority: ticket.priority || 'MEDIUM',
      assigned_technician: ticket.assigned_technician || '',
      is_warranty_covered: ticket.is_warranty_covered ?? true,
      diagnosis_notes: ticket.diagnosis_notes || '',
      parts_used: ticket.parts_used || '',
      labour_hours: (ticket.labour_hours ?? 1.5).toString(),
      labour_cost_inr: ticket.labour_cost_paise ? (ticket.labour_cost_paise / 100).toString() : '0',
      repair_expenses_inr: ticket.repair_expenses_paise ? (ticket.repair_expenses_paise / 100).toString() : '0',
      customer_confirmation_notes: ticket.customer_confirmation_notes || '',
      resolution_notes: ticket.resolution_notes || 'Inspected on site. Verified normal generation output.',
    });
    setIsUpdateModalOpen(true);
  };

  // Tickets Columns
  const ticketColumns = [
    {
      header: 'Ticket #',
      accessor: 'ticket_number',
      render: (t) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{t.ticket_number}</span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Logged: {t.created_at?.split('T')[0]}
          </div>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (t) => (
        <div>
          <div style={{ fontWeight: 600 }}>{t.customer_name}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {t.customer_city} · {t.customer_phone}
          </div>
        </div>
      ),
    },
    {
      header: 'Issue Category',
      accessor: 'issue_category',
      render: (t) => (
        <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
          {t.issue_category.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      header: 'Priority',
      accessor: 'priority',
      render: (t) => (
        <span
          className={`badge ${
            t.priority === 'CRITICAL' || t.priority === 'HIGH'
              ? 'badge-danger'
              : t.priority === 'MEDIUM'
              ? 'badge-warning'
              : 'badge-info'
          }`}
        >
          {t.priority}
        </span>
      ),
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (t) => (
        <div style={{ maxWidth: '240px', fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {t.description}
        </div>
      ),
    },
    {
      header: 'Technician',
      accessor: 'assigned_technician',
      render: (t) => <span style={{ fontSize: '0.8rem' }}>{t.assigned_technician || 'O&M Team'}</span>,
    },
    {
      header: 'Coverage',
      accessor: 'is_warranty_covered',
      render: (t) =>
        t.is_warranty_covered ? (
          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
            Warranty
          </span>
        ) : (
          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
            Chargeable
          </span>
        ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      header: 'Action',
      accessor: 'actions',
      align: 'right',
      render: (t) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => openUpdateModal(t)}
          title="Resolve or Update Ticket"
        >
          <Wrench size={13} /> Manage
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Service & Maintenance (O&M)"
        description="Customer post-installation ticketing, technician dispatch triage, and serialized component warranty lookup."
        action={
          activeTab === 'tickets' ? (
            <button
              className="btn btn-primary"
              onClick={() => setIsNewTicketModalOpen(true)}
            >
              <Plus size={16} /> Log Service Ticket
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem', paddingBottom: '0.25rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setActiveTab('tickets')}
        >
          <HeadphonesIcon size={16} />
          <span>All Service Tickets</span>
          <span className="badge badge-neutral" style={{ marginLeft: '0.25rem' }}>{tickets.length}</span>
        </button>

        <button
          className={`btn ${activeTab === 'repairs' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setActiveTab('repairs')}
        >
          <Wrench size={16} />
          <span>Active Repairs</span>
          <span className="badge badge-warning" style={{ marginLeft: '0.25rem' }}>
            {tickets.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED').length}
          </span>
        </button>

        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setActiveTab('history')}
        >
          <Clock size={16} />
          <span>Service History</span>
          <span className="badge badge-neutral" style={{ marginLeft: '0.25rem' }}>
            {tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length}
          </span>
        </button>

        <button
          className={`btn ${activeTab === 'warranty' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setActiveTab('warranty')}
        >
          <ShieldCheck size={16} />
          <span>Warranty Lookup</span>
        </button>
      </div>

      {/* ==================== TAB 1: SERVICE TICKETS & REPAIRS ==================== */}
      {activeTab !== 'warranty' && (
        <div>
          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="card" style={{ padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Tickets</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{tickets.length}</div>
            </div>
            <div className="card" style={{ padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Open / Action Required</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--red-600)' }}>
                {tickets.filter((t) => t.status === 'OPEN' || t.status === 'ASSIGNED').length}
              </div>
            </div>
            <div className="card" style={{ padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In Progress</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--amber-600)' }}>
                {tickets.filter((t) => t.status === 'IN_PROGRESS').length}
              </div>
            </div>
            <div className="card" style={{ padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Resolved & Closed</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
                {tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length}
              </div>
            </div>
          </div>

          {/* Filtering Pills */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
              {TICKET_STATUSES.map((st) => (
                <button
                  key={st}
                  className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Priority:</span>
              <select
                className="input"
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DataTable
            columns={ticketColumns}
            data={tickets.filter((t) => {
              if (activeTab === 'repairs') return t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED';
              if (activeTab === 'history') return t.status === 'RESOLVED' || t.status === 'CLOSED';
              return true;
            })}
            searchPlaceholder="Search ticket #, customer, description..."
            searchKey="ticket_number"
            isLoading={loadingTickets}
            emptyMessage={`No ${activeTab === 'repairs' ? 'active repair' : activeTab === 'history' ? 'historical' : ''} service tickets found matching current filters.`}
          />
        </div>
      )}

      {/* ==================== TAB 2: SERIAL NUMBER WARRANTY LOOKUP ==================== */}
      {activeTab === 'warranty' && (
        <div>
          {/* Search Card */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.35rem' }}>
              Equipment Warranty & Serial Identity Lookup
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Instant verification of manufacturer terms, warranty start dates derived from actual physical delivery, and remaining coverage.
            </p>

            <form onSubmit={handleWarrantySearch} style={{ display: 'flex', gap: '0.75rem', maxWidth: '600px' }}>
              <Input
                style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'monospace' }}
                value={warrantyQuery}
                onChange={(e) => setWarrantyQuery(e.target.value)}
                placeholder="Enter Serial Number (e.g. SNG-5K-2026-90412 or WRE-550-2026A-001)"
                required
              />
              <button className="btn btn-primary" type="submit" disabled={warrantyLoading}>
                <Search size={16} />
                <span>{warrantyLoading ? 'Searching...' : 'Lookup Warranty'}</span>
              </button>
            </form>
          </div>

          {/* Warranty Result Card */}
          {warrantyLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
              <p>Querying verified asset warranty registry...</p>
            </div>
          ) : warrantyError ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid var(--red-600)' }}>
              <AlertTriangle size={36} color="var(--red-600)" style={{ margin: '0 auto 0.5rem' }} />
              <h4 style={{ fontWeight: 700, color: 'var(--navy-900)' }}>Serial Number Not Found</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {warrantyError}
              </p>
            </div>
          ) : warrantyResult ? (
            <div
              className="card"
              style={{
                padding: '1.5rem',
                borderLeft: '5px solid var(--solar-green-500)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-success" style={{ fontWeight: 800 }}>ACTIVE WARRANTY POLICY</span>
                    <span className="badge badge-neutral">{warrantyResult.category}</span>
                  </div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--navy-900)' }}>
                    {warrantyResult.component_name}
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Manufacturer: <span style={{ fontWeight: 700, color: 'var(--navy-800)' }}>{warrantyResult.manufacturer}</span> · SKU: {warrantyResult.sku}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Physical Serial Number</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--navy-900)', fontFamily: 'monospace' }}>
                    {warrantyResult.serial_number}
                  </div>
                </div>
              </div>

              {/* Coverage Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Duration</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                    {warrantyResult.duration_years} Years
                  </div>
                </div>

                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valid From (Delivery Date)</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                    {warrantyResult.start_date}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coverage Expiry Date</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--solar-green-600)' }}>
                    {warrantyResult.end_date}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--solar-green-600)', textTransform: 'uppercase', fontWeight: 700 }}>Days Remaining</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
                    {warrantyResult.days_remaining} Days
                  </div>
                </div>
              </div>

              {/* Linked Digital Solar Passport */}
              <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Associated Digital Solar Passport:</span>
                  <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>
                    {warrantyResult.passport_number || 'N/A'} — {warrantyResult.customer_name} ({warrantyResult.customer_city})
                  </div>
                </div>
                {warrantyResult.qr_code_token && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => window.open(`/passport/public/${warrantyResult.qr_code_token}`, '_blank')}
                  >
                    View Passport Certificate
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ==================== NEW SERVICE TICKET MODAL ==================== */}
      <Modal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
        title="Log New Service & Maintenance Ticket"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsNewTicketModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateTicketSubmit}>
              Log Service Ticket
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <FormField label="Client Account" required>
            <Select
              value={ticketFormData.customer_id}
              onChange={(e) => setTicketFormData({ ...ticketFormData, customer_id: e.target.value })}
              required
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city}) — {c.phone}
                </option>
              ))}
            </Select>
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Issue Category" required>
              <Select
                value={ticketFormData.issue_category}
                onChange={(e) => setTicketFormData({ ...ticketFormData, issue_category: e.target.value })}
              >
                {ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Triage Priority" required>
              <Select
                value={ticketFormData.priority}
                onChange={(e) => setTicketFormData({ ...ticketFormData, priority: e.target.value })}
              >
                <option value="LOW">LOW (General Inquiry)</option>
                <option value="MEDIUM">MEDIUM (Minor Alert)</option>
                <option value="HIGH">HIGH (Generation Drop)</option>
                <option value="CRITICAL">CRITICAL (System Inverter Outage)</option>
              </Select>
            </FormField>
          </div>

          <div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <FormField label="Equipment Serial Number (Optional)">
                  <Input
                    value={ticketFormData.serial_number}
                    onChange={(e) => {
                      setTicketFormData({ ...ticketFormData, serial_number: e.target.value });
                      setWarrantyCheckResult(null);
                    }}
                    placeholder="e.g. SNG-5K-2026-90412"
                  />
                </FormField>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginBottom: '1rem', whiteSpace: 'nowrap' }}
                onClick={handleVerifySerialWarranty}
                disabled={serialChecking || !ticketFormData.serial_number}
              >
                <ShieldCheck size={14} className={serialChecking ? 'spin' : ''} />
                <span>{serialChecking ? 'Checking...' : 'Check Warranty'}</span>
              </button>
            </div>

            {/* Live Warranty Check Indicator */}
            {warrantyCheckResult && (
              <div
                style={{
                  marginTop: '-0.5rem',
                  marginBottom: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  border: warrantyCheckResult.is_eligible ? '1px solid #86efac' : '1px solid #fde68a',
                  background: warrantyCheckResult.is_eligible ? '#f0fdf4' : '#fffbeb',
                  color: warrantyCheckResult.is_eligible ? '#15803d' : '#b45309',
                }}
              >
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {warrantyCheckResult.is_eligible ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                  <span>
                    {warrantyCheckResult.is_eligible
                      ? `✓ Warranty Eligible (${warrantyCheckResult.policy_name || 'Active Policy'})`
                      : `⚠️ Chargeable Repair (${warrantyCheckResult.status || 'No Active Policy'})`}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                  {warrantyCheckResult.message || warrantyCheckResult.terms_summary || 'Standard manufacturer coverage rules apply.'}
                  {warrantyCheckResult.days_remaining != null && ` • ${warrantyCheckResult.days_remaining} days remaining`}
                </div>
              </div>
            )}
          </div>

          <FormField label="Issue Description & Symptoms" required>
            <Textarea
              rows={3}
              value={ticketFormData.description}
              onChange={(e) => setTicketFormData({ ...ticketFormData, description: e.target.value })}
              placeholder="Describe customer observation, error code on inverter, or weather incident..."
              required
            />
          </FormField>

          <FormField label="Assigned Technician / Lead">
            <Input
              value={ticketFormData.assigned_technician}
              onChange={(e) => setTicketFormData({ ...ticketFormData, assigned_technician: e.target.value })}
              placeholder="e.g. Ramesh Patil / Rapid Response Crew"
            />
          </FormField>
        </form>
      </Modal>

      {/* ==================== UPDATE / RESOLVE TICKET MODAL ==================== */}
      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title={`Manage & Triage Ticket: ${selectedTicket?.ticket_number}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsUpdateModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleUpdateTicketSubmit}>
              Commit Ticket Updates
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdateTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {selectedTicket && (
            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{selectedTicket.customer_name}</span>
                <span className="badge badge-neutral">{selectedTicket.issue_category}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                {selectedTicket.description}
              </p>
              {selectedTicket.serial_number && (
                <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '0.2rem' }}>
                  Component S/N: {selectedTicket.serial_number}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Ticket Lifecycle Status" required>
              <Select
                value={updateFormData.status}
                onChange={(e) => setUpdateFormData({ ...updateFormData, status: e.target.value })}
              >
                <option value="OPEN">OPEN</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="WAITING_FOR_PARTS">WAITING FOR PARTS</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </Select>
            </FormField>

            <FormField label="Triage Priority" required>
              <Select
                value={updateFormData.priority}
                onChange={(e) => setUpdateFormData({ ...updateFormData, priority: e.target.value })}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Assigned Technician">
            <Input
              value={updateFormData.assigned_technician}
              onChange={(e) => setUpdateFormData({ ...updateFormData, assigned_technician: e.target.value })}
              placeholder="e.g. Ramesh Patil / Rapid Response Crew"
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
              padding: '0.4rem 0',
            }}
          >
            <input
              type="checkbox"
              checked={updateFormData.is_warranty_covered}
              onChange={(e) => setUpdateFormData({ ...updateFormData, is_warranty_covered: e.target.checked })}
            />
            <span>Covered under manufacturer warranty (Zero customer billing)</span>
          </label>

          <FormField label="Technical Diagnosis & Site Findings">
            <Textarea
              rows={2}
              value={updateFormData.diagnosis_notes}
              onChange={(e) => setUpdateFormData({ ...updateFormData, diagnosis_notes: e.target.value })}
              placeholder="Root cause identified on site (e.g. AC grid surge caused DC breaker trip, dust accumulation...)"
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
            <FormField label="Parts Replaced / Serviced">
              <Input
                value={updateFormData.parts_used}
                onChange={(e) => setUpdateFormData({ ...updateFormData, parts_used: e.target.value })}
                placeholder="e.g. Replacement SPD 40kA DC surge protector, 4mm MC4 connectors"
              />
            </FormField>

            <FormField label="Labour Hours">
              <Input
                type="number"
                step="0.5"
                min="0"
                value={updateFormData.labour_hours}
                onChange={(e) => setUpdateFormData({ ...updateFormData, labour_hours: e.target.value })}
                placeholder="1.5"
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Labour Cost (INR ₹)">
              <Input
                type="number"
                min="0"
                value={updateFormData.labour_cost_inr}
                onChange={(e) => setUpdateFormData({ ...updateFormData, labour_cost_inr: e.target.value })}
                placeholder="0"
              />
            </FormField>

            <FormField label="Parts / Repair Expenses (INR ₹)">
              <Input
                type="number"
                min="0"
                value={updateFormData.repair_expenses_inr}
                onChange={(e) => setUpdateFormData({ ...updateFormData, repair_expenses_inr: e.target.value })}
                placeholder="0"
              />
            </FormField>
          </div>

          <FormField label="Customer Acceptance / Confirmation Notes">
            <Input
              value={updateFormData.customer_confirmation_notes}
              onChange={(e) => setUpdateFormData({ ...updateFormData, customer_confirmation_notes: e.target.value })}
              placeholder="e.g. Signed by Rajesh Sharma on site. Inverter running normally at 4.8 kW."
            />
          </FormField>

          <FormField label="Final Resolution & Closure Notes">
            <Textarea
              rows={2}
              value={updateFormData.resolution_notes}
              onChange={(e) => setUpdateFormData({ ...updateFormData, resolution_notes: e.target.value })}
              placeholder="e.g. Replaced AC breaker, firmware upgraded to v2.1, generation restored and verified."
            />
          </FormField>

          {selectedTicket && (
            <div style={{ marginTop: '0.5rem' }}>
              <DocumentManager
                entityType="SERVICE_TICKET"
                entityId={selectedTicket.id}
                entityIdentifier={selectedTicket.ticket_number}
                compact={true}
                title="Service Photos & Diagnostic Reports"
              />
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

