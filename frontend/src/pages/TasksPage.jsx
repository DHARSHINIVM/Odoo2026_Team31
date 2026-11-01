import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckSquare, Plus, Clock, AlertTriangle, CheckCircle2,
  Filter, MessageSquare, User, Calendar, Tag, AlertCircle,
  MoreVertical, RefreshCw, ChevronRight, X, BarChart3, Users,
  Activity, ArrowUpRight, Search, ShieldCheck, Check
} from 'lucide-react';

// Sales Executive 10 Canonical Categories
const SALES_CATEGORIES = [
  'Customer Follow-up',
  'Lead Qualification',
  'Site Survey Request',
  'Quotation Preparation',
  'Quotation Follow-up',
  'Contract Negotiation',
  'Order Confirmation',
  'Payment Follow-up',
  'Customer Handover',
  'Post-Installation Review',
];

// Warehouse Manager 15 Canonical Categories
const WAREHOUSE_CATEGORIES = [
  'Stock Purchase',
  'Goods Receipt',
  'Inventory Update',
  'Stock Adjustment',
  'Stock Verification',
  'Material Reservation',
  'Project Material Allocation',
  'Dispatch Preparation',
  'Dispatch Confirmation',
  'Material Hold',
  'Material Release',
  'Damaged Goods Handling',
  'Material Return',
  'Serial Number Registration',
  'Stock Reconciliation',
];

// Administrator Task Types for Analysis & Filtering
const ADMIN_TASK_TYPES = [
  'ALL',
  'Site Survey',
  'Installation',
  'Commissioning and Testing',
  'Maintenance',
  'Repair or Service',
  'Inspection or Follow-up',
  'Inventory & Logistics',
  'Sales & Handover',
  'General',
];

const DEFAULT_CATEGORIES = ['ALL', 'SURVEY', 'INSTALLATION', 'SALES', 'INVENTORY', 'SERVICE', 'GENERAL'];
const STATUS_OPTIONS = ['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PRIORITY_OPTIONS = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TasksPage({ refreshTrigger }) {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'SOLAR_MANAGER';
  const isSales = userRole === 'SALES_EXECUTIVE';
  const isWarehouse = userRole === 'WAREHOUSE_MANAGER';
  const isTechnician = userRole === 'TECHNICIAN' || userRole === 'FIELD_TECHNICIAN';

  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, urgent: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(isSales);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Staff and Customers for linking
  const [staffMembers, setStaffMembers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);

  // Create form state
  const defaultCategory = isSales ? SALES_CATEGORIES[0] : isWarehouse ? WAREHOUSE_CATEGORIES[0] : 'GENERAL';
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    assigned_user_id: '',
    priority: 'MEDIUM',
    category: defaultCategory,
    customer_id: '',
    order_id: '',
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, summaryRes] = await Promise.all([
        api.getTasks({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          assigned_to_me: isSales ? true : assignedToMe,
        }),
        api.getTaskSummary(),
      ]);
      setTasks(tasksRes || []);
      setSummary(summaryRes || { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, urgent: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter, categoryFilter, assignedToMe, refreshTrigger]);

  useEffect(() => {
    api.getUsers().then(res => setStaffMembers(res || [])).catch(() => {});
    if (isSales || isAdmin) {
      api.getCustomers().then(res => setCustomers(res || [])).catch(() => {});
      api.getOrders().then(res => setOrders(res || [])).catch(() => {});
    }
  }, [userRole]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) return;
    try {
      await api.createTask({
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        assigned_user_id: createForm.assigned_user_id ? parseInt(createForm.assigned_user_id, 10) : user?.id,
        priority: createForm.priority,
        category: createForm.category,
        customer_id: createForm.customer_id ? parseInt(createForm.customer_id, 10) : undefined,
        order_id: createForm.order_id ? parseInt(createForm.order_id, 10) : undefined,
        due_date: createForm.due_date ? new Date(createForm.due_date).toISOString() : null,
      });
      setIsCreateModalOpen(false);
      setCreateForm({
        title: '',
        description: '',
        assigned_user_id: '',
        priority: 'MEDIUM',
        category: defaultCategory,
        customer_id: '',
        order_id: '',
        due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
      });
      loadData();
    } catch (err) {
      alert(`Failed to create task: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    if (isAdmin) return; // Prevent any manipulation for Admin
    try {
      await api.updateTask(taskId, { status: newStatus });
      loadData();
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;
    setSubmittingComment(true);
    try {
      const updated = await api.addTaskComment(selectedTask.id, newComment.trim());
      setSelectedTask(updated);
      setNewComment('');
      loadData();
    } catch (err) {
      alert(`Failed to add comment: ${err.message}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  const getPriorityBadge = (p) => {
    const map = {
      URGENT: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
      HIGH: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
      MEDIUM: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
      LOW: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
    };
    const c = map[p] || map.MEDIUM;
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
        {p}
      </span>
    );
  };

  const getStatusBadge = (s, isOverdue) => {
    if (isOverdue && s !== 'COMPLETED') {
      return (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #f87171' }}>
          OVERDUE
        </span>
      );
    }
    const map = {
      COMPLETED: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
      IN_PROGRESS: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
      ASSIGNED: { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
      PENDING: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
      ON_HOLD: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
      CANCELLED: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
    };
    const c = map[s] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
        {(s || 'PENDING').replace('_', ' ')}
      </span>
    );
  };

  const calculateDuration = (start, end) => {
    if (!start) return 'N/A';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate - startDate;
    if (diffMs < 0) return 'Just started';
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return `${diffHours} hrs`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days`;
  };

  // Filter tasks locally by search query
  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchId = (t.id || '').toString().includes(q);
    const matchTitle = (t.title || '').toLowerCase().includes(q);
    const matchCust = (t.customer_name || '').toLowerCase().includes(q);
    const matchTech = (t.assigned_user_name || '').toLowerCase().includes(q);
    const matchOrder = (t.order_id || '').toString().includes(q);
    return matchId || matchTitle || matchCust || matchTech || matchOrder;
  });

  // Role-Specific Heading and Action Configurations
  let pageTitle = 'Operational Task Management';
  let pageSubtitle = 'Track and manage field activities and project milestones.';
  let showCreateButton = !isAdmin;
  let createButtonLabel = 'New Task';
  let allowedCategories = DEFAULT_CATEGORIES;

  if (isAdmin) {
    pageTitle = 'Task Monitoring & Technician Operational Log';
    pageSubtitle = 'Authoritative central log and performance analytics of operational tasks assigned across technician teams.';
  } else if (isSales) {
    pageTitle = 'Personal Task Manager — Sales Pipeline';
    pageSubtitle = 'Manage your assigned commercial follow-ups, quotation deadlines, order confirmations, and customer handovers.';
    createButtonLabel = 'New Sales Task';
    allowedCategories = SALES_CATEGORIES;
  } else if (isWarehouse) {
    pageTitle = 'Warehouse Operations & Staging Tasks';
    pageSubtitle = 'Manage stock verifications, material allocations, dispatch preparation, goods receipts, and serial tracking.';
    createButtonLabel = 'New Warehouse Task';
    allowedCategories = WAREHOUSE_CATEGORIES;
  }

  // Admin Analytical KPI Calculations from Backend Data
  const adminTotalTasks = tasks.length;
  const adminAssigned = tasks.filter(t => t.status === 'ASSIGNED' || t.status === 'PENDING').length;
  const adminInProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const adminCompleted = tasks.filter(t => t.status === 'COMPLETED').length;
  const adminOverdue = tasks.filter(t => t.is_overdue).length;

  // Type Breakdown for Admin
  const tasksByType = {};
  tasks.forEach(t => {
    const cat = t.category || 'GENERAL';
    tasksByType[cat] = (tasksByType[cat] || 0) + 1;
  });

  // Technician Workload Distribution for Admin
  const tasksByTechnician = {};
  tasks.forEach(t => {
    const techName = t.assigned_user_name || 'Unassigned';
    tasksByTechnician[techName] = (tasksByTechnician[techName] || 0) + 1;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        action={
          showCreateButton ? (
            <button
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} />
              <span>{createButtonLabel}</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
              <ShieldCheck size={15} style={{ color: '#059669' }} />
              <span>Read-Only Administrative Monitor</span>
            </div>
          )
        }
      />

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>TOTAL TASKS</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {isAdmin ? adminTotalTasks : summary.total}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
            {isAdmin ? 'System-wide active records' : isSales ? 'Assigned to your pipeline' : 'Active depot tasks'}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#d97706' }}>PENDING ASSIGNMENT</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b45309', marginTop: '0.2rem' }}>
            {isAdmin ? adminAssigned : summary.pending}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#d97706', marginTop: '0.2rem' }}>Awaiting technician action</div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#0284c7' }}>IN PROGRESS</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0369a1', marginTop: '0.2rem' }}>
            {isAdmin ? adminInProgress : summary.in_progress}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#0284c7', marginTop: '0.2rem' }}>Currently underway</div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#dc2626' }}>OVERDUE / URGENT</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.2rem' }}>
            {isAdmin ? adminOverdue : summary.overdue}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.2rem' }}>Passed target deadline</div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#059669' }}>COMPLETED</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', marginTop: '0.2rem' }}>
            {isAdmin ? adminCompleted : summary.completed}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem' }}>Verified and signed off</div>
        </div>
      </div>

      {/* Administrator Analytical Visualisations & Workload Overview */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {/* Tasks by Type Breakdown */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.85rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BarChart3 size={16} style={{ color: '#2563eb' }} />
              <span>Task Breakdown by Operational Category</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.keys(tasksByType).length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No task category data available.</div>
              ) : (
                Object.entries(tasksByType).map(([cat, count]) => {
                  const pct = Math.round((count / (adminTotalTasks || 1)) * 100);
                  return (
                    <div key={cat} style={{ fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{cat.replace('_', ' ')}</span>
                        <span style={{ color: '#64748b' }}>{count} tasks ({pct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Technician Workload Distribution */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.85rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={16} style={{ color: '#059669' }} />
              <span>Technician Workload Distribution</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.keys(tasksByTechnician).length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No technician assignments recorded.</div>
              ) : (
                Object.entries(tasksByTechnician).map(([tech, count]) => {
                  const pct = Math.round((count / (adminTotalTasks || 1)) * 100);
                  return (
                    <div key={tech} style={{ fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{tech}</span>
                        <span style={{ color: '#64748b' }}>{count} assignments ({pct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#10b981', borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '320px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by ID, title, customer, or assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.65rem 0.4rem 2rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>{st === 'ALL' ? 'All Statuses' : st.replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p === 'ALL' ? 'All Priorities' : p}</option>
            ))}
          </select>

          {!isSales && !isWarehouse && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="ALL">All Categories</option>
              {allowedCategories.filter(c => c !== 'ALL').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {!isAdmin && !isSales && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={(e) => setAssignedToMe(e.target.checked)}
              />
              <span>Assigned to me</span>
            </label>
          )}
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={loadData}
          style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          title="Refresh Tasks"
        >
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Task List Table */}
      <div className="card" style={{ padding: '1.25rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            Loading operational tasks and milestones...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <CheckSquare size={48} style={{ strokeWidth: 1.5, margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#475569' }}>No tasks found</div>
            <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>All active workflows match filter criteria.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  {/* For Administrator: Read-Only, NO Done checkbox column, NO Actions column */}
                  {!isAdmin && <th style={{ width: '40px' }}>Done</th>}
                  <th>Task ID</th>
                  <th>Task Title & Type</th>
                  <th>Project / Order</th>
                  <th>Customer</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Assigned Date</th>
                  <th>Due Date</th>
                  {isAdmin && <th>Completion Date</th>}
                  <th>Status</th>
                  {isAdmin && <th>Duration</th>}
                  {/* Only show Actions column for non-admin roles */}
                  {!isAdmin ? <th>Actions</th> : <th>Inspect</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => {
                  const isCompleted = t.status === 'COMPLETED';
                  return (
                    <tr
                      key={t.id}
                      style={{
                        background: t.is_overdue && !isCompleted ? '#fffdfb' : 'transparent',
                        opacity: isCompleted ? 0.75 : 1,
                      }}
                    >
                      {/* Checkbox column only for non-admin roles */}
                      {!isAdmin && (
                        <td>
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={() => handleUpdateStatus(t.id, isCompleted ? 'IN_PROGRESS' : 'COMPLETED')}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            title={isCompleted ? 'Mark In Progress' : 'Mark Completed'}
                          />
                        </td>
                      )}

                      <td>
                        <strong>#{t.id}</strong>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span
                            style={{
                              fontWeight: 600,
                              color: isCompleted ? '#64748b' : '#0f172a',
                              textDecoration: isCompleted ? 'line-through' : 'none',
                            }}
                          >
                            {t.title}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                            <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                              {t.category || 'General'}
                            </span>
                            {t.description && ` · ${t.description.length > 50 ? `${t.description.slice(0, 50)}...` : t.description}`}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: '#2563eb' }}>
                          {t.order_id ? `#ORD-${t.order_id}` : '—'}
                        </span>
                      </td>

                      <td>
                        <span style={{ color: '#334155' }}>
                          {t.customer_name || '—'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#334155' }}>
                          <User size={12} style={{ color: '#64748b' }} />
                          <span>{t.assigned_user_name || 'Unassigned'}</span>
                        </div>
                      </td>

                      <td>{getPriorityBadge(t.priority)}</td>

                      <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                      </td>

                      <td>
                        <div style={{ fontSize: '0.78rem', color: t.is_overdue ? '#dc2626' : '#64748b', fontWeight: t.is_overdue ? 700 : 500 }}>
                          {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No Due Date'}
                        </div>
                      </td>

                      {isAdmin && (
                        <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                          {t.completed_at ? new Date(t.completed_at).toLocaleDateString() : 'In Progress'}
                        </td>
                      )}

                      <td>{getStatusBadge(t.status, t.is_overdue)}</td>

                      {isAdmin && (
                        <td style={{ color: '#475569', fontSize: '0.75rem' }}>
                          {calculateDuration(t.created_at, t.completed_at)}
                        </td>
                      )}

                      {/* Non-Admin: Actions with Status Update Dropdown and Comment count */}
                      {!isAdmin ? (
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setSelectedTask(t)}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                              <MessageSquare size={12} />
                              <span>{t.comments?.length || 0}</span>
                            </button>
                            <select
                              value={t.status}
                              onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="PENDING">Pending</option>
                              <option value="ASSIGNED">Assigned</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="ON_HOLD">On Hold</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </div>
                        </td>
                      ) : (
                        /* Admin: Read-Only Detail Inspection Button (NO row-level editing controls) */
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedTask(t)}
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                          >
                            Inspect
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task Details Drawer (Read-Only for Admin, Interactive for Others) */}
      {selectedTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', height: '100%', borderRadius: 0, display: 'flex', flexDirection: 'column', padding: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>TASK #{selectedTask.id}</span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.2rem 0', color: '#0f172a' }}>{selectedTask.title}</h3>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                  {getPriorityBadge(selectedTask.priority)}
                  {getStatusBadge(selectedTask.status, selectedTask.is_overdue)}
                  <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                    {selectedTask.category}
                  </span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedTask(null)}
                style={{ padding: '0.35rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Description & Scope</label>
                <div style={{ fontSize: '0.85rem', color: '#334155', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginTop: '0.25rem', border: '1px solid #e2e8f0' }}>
                  {selectedTask.description || 'No detailed instructions provided.'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Assignee</span>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedTask.assigned_user_name || 'Unassigned'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Due Date</span>
                  <div style={{ fontWeight: 600, color: selectedTask.is_overdue ? '#dc2626' : '#0f172a' }}>
                    {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleString() : 'No Target Date'}
                  </div>
                </div>
              </div>

              {selectedTask.customer_name && (
                <div style={{ background: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Linked Customer</span>
                  <strong style={{ color: '#0f172a' }}>{selectedTask.customer_name}</strong>
                  {selectedTask.order_id && (
                    <span style={{ marginLeft: '0.5rem', color: '#2563eb' }}>(Order #{selectedTask.order_id})</span>
                  )}
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Audit Trail & Work Updates ({selectedTask.comments?.length || 0})
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.5rem' }}>
                  {selectedTask.comments && selectedTask.comments.length > 0 ? (
                    selectedTask.comments.map((c, idx) => (
                      <div key={idx} style={{ padding: '0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>
                          <strong style={{ color: '#1e293b' }}>{c.user_name}</strong>
                          <span>{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#334155' }}>{c.text}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem' }}>
                      No comments recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Admin has read-only access (no comment/edit controls), other roles can post work updates */}
            {!isAdmin ? (
              <form onSubmit={handleAddComment} style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Post operational update..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  style={{ flex: 1, padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingComment || !newComment.trim()}
                  style={{ fontSize: '0.82rem' }}
                >
                  {submittingComment ? 'Posting...' : 'Post'}
                </button>
              </form>
            ) : (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                Read-only administrative monitor. Row actions disabled.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role-Aware Create Task Modal (Sales 10 categories, Warehouse 15 categories, Technician operational) */}
      {isCreateModalOpen && !isAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              {isSales ? 'Create Sales Follow-Up Task' : isWarehouse ? 'Create Warehouse Operational Task' : 'Create Operational Task'}
            </h3>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Task Title</label>
                <input
                  type="text"
                  placeholder={isSales ? "e.g. Follow up on 5kW Rooftop Quotation" : isWarehouse ? "e.g. Verify incoming Waaree 550W panels" : "e.g. Complete earthing pit inspection"}
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description & Scope</label>
                <textarea
                  rows={3}
                  placeholder="Details, technical instructions, customer remarks..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    {(isSales ? SALES_CATEGORIES : isWarehouse ? WAREHOUSE_CATEGORIES : allowedCategories.filter(c => c !== 'ALL')).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Priority</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Linking to Customer or Order (vital for Sales Executive) */}
              {(isSales || isAdmin) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Linked Customer</label>
                    <select
                      value={createForm.customer_id}
                      onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">None / General</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Linked Order</label>
                    <select
                      value={createForm.order_id}
                      onChange={(e) => setCreateForm({ ...createForm, order_id: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">None / General</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>{o.order_number} ({o.system_capacity_kw}kW)</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Assignee</label>
                  <select
                    value={createForm.assigned_user_id}
                    onChange={(e) => setCreateForm({ ...createForm, assigned_user_id: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Self (Assign to Me)</option>
                    {staffMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name} ({m.role.replace('_', ' ')})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Due Date & Time</label>
                  <input
                    type="datetime-local"
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
