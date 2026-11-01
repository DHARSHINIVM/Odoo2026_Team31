import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import {
  Briefcase, Calendar, Clock, AlertCircle, Plus, FileSpreadsheet,
  CheckCircle2, ArrowRight, UserPlus, Phone, MapPin, ClipboardCheck,
  ShieldAlert, Eye, DollarSign, Package, Truck, Wrench, HeadphonesIcon,
  ChevronRight, RefreshCw, XCircle, CheckCircle
} from 'lucide-react';

export default function SalesDashboard({ refreshTrigger }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline' | 'surveys' | 'operations' | 'service'
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Survey Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSalesDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load Sales Dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleApproveSurvey = async (surveyId) => {
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      await api.approveSurvey(surveyId, { review_notes: reviewNotes || 'Approved by Sales Executive' });
      setActionSuccess(`Survey SRV #${surveyId} successfully approved.`);
      setReviewModalOpen(false);
      setSelectedSurvey(null);
      setReviewNotes('');
      await loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to approve survey');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSurvey = async (surveyId) => {
    if (!rejectionReason) {
      setActionError('Please provide a reason for rejecting the survey.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      await api.rejectSurvey(surveyId, { rejection_reason: rejectionReason, review_notes: reviewNotes });
      setActionSuccess(`Survey SRV #${surveyId} marked as rejected.`);
      setReviewModalOpen(false);
      setSelectedSurvey(null);
      setRejectionReason('');
      setReviewNotes('');
      await loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to reject survey');
    } finally {
      setActionLoading(false);
    }
  };

  const formatINR = (val) => {
    if (val === undefined || val === null) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
        <div>Loading Sales & Operations Workspace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', background: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#b91c1c' }}>
        <strong>Error loading Sales Dashboard:</strong> {error}
        <button onClick={loadData} className="btn btn-secondary btn-sm" style={{ display: 'block', marginTop: '0.75rem' }}>
          Retry
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const upcomingFollowups = data?.upcoming_followups || [];
  const myEnquiries = data?.my_enquiries || [];
  const surveysReviewQueue = data?.surveys_review_queue || [];
  const activeProjects = data?.active_projects_list || [];
  const serviceExceptions = data?.service_exceptions || [];
  const materialReadiness = data?.material_readiness || {};
  const installationProgress = data?.installation_progress || {};
  const perms = data?.user_permissions || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
        padding: '1.5rem 2rem',
        borderRadius: '12px',
        color: '#ffffff',
        border: '1px solid #059669',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Unified Commercial & Project Operations
            </span>
            {perms.can_approve_survey && (
              <span style={{ fontSize: '0.7rem', background: '#059669', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                Survey Approver Authorized
              </span>
            )}
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
            Sales Executive & Operations Hub
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#a7f3d0' }}>
            Commercial customer lifecycle, survey assignments, quotations, material readiness, and field coordination.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link to="/enquiries" className="btn btn-secondary btn-sm" style={{ background: '#065f46', color: '#fff', border: '1px solid #047857' }}>
            <UserPlus size={14} />
            <span>New Lead</span>
          </Link>
          <Link to="/appointments" className="btn btn-secondary btn-sm" style={{ background: '#065f46', color: '#fff', border: '1px solid #047857' }}>
            <Calendar size={14} />
            <span>Schedule Appointment</span>
          </Link>
          <Link to="/quotations" className="btn btn-primary btn-sm" style={{ background: '#059669', border: 'none' }}>
            <FileSpreadsheet size={14} />
            <span>Create Quotation</span>
          </Link>
        </div>
      </div>

      {/* Notifications / Feedback Messages */}
      {actionSuccess && (
        <div style={{ padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Top 6 High-Impact Operational KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        
        {/* Leads & Qualification */}
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Leads & Enquiries</span>
            <Briefcase size={18} style={{ color: '#059669' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.assigned_enquiries || 0}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            <span style={{ color: '#059669', fontWeight: 600 }}>{kpis.new_leads || 0} New</span>
            <span>{kpis.qualified_leads || 0} Qualified</span>
          </div>
        </div>

        {/* Follow-ups */}
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Follow-ups Due</span>
            <Calendar size={18} style={{ color: '#2563eb' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.followups_due_today || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: (kpis.overdue_followups || 0) > 0 ? '#dc2626' : '#64748b', marginTop: '0.2rem' }}>
            {(kpis.overdue_followups || 0) > 0 ? `⚠️ ${kpis.overdue_followups} Overdue` : 'All caught up'}
          </div>
        </div>

        {/* Surveys Coordination */}
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Site Surveys</span>
            <ClipboardCheck size={18} style={{ color: '#d97706' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.surveys_requested || 0}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            <span style={{ color: '#d97706', fontWeight: 600 }}>{kpis.surveys_awaiting_review || 0} Awaiting Review</span>
          </div>
        </div>

        {/* Quotations & Conversions */}
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Quotations</span>
            <FileSpreadsheet size={18} style={{ color: '#7c3aed' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.quotations_prepared || 0}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            <span style={{ color: '#059669', fontWeight: 600 }}>{kpis.accepted_quotations || 0} Accepted</span>
            <span>{kpis.quotations_pending || 0} Pending</span>
          </div>
        </div>

        {/* Confirmed Orders & Projects */}
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Active Projects</span>
            <Package size={18} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            {kpis.active_projects || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            {kpis.confirmed_orders || 0} Total Confirmed Orders
          </div>
        </div>

        {/* Payment & Balance Status */}
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Contract Value</span>
            <DollarSign size={18} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a' }}>
            {formatINR(kpis.total_contract_inr)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            Bal: {formatINR(kpis.outstanding_balance_inr)}
          </div>
        </div>

      </div>

      {/* Operational Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('pipeline')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'pipeline' ? '#059669' : '#f1f5f9',
            color: activeTab === 'pipeline' ? '#ffffff' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Briefcase size={15} />
          Commercial Deal Pipeline ({myEnquiries.length})
        </button>

        <button
          onClick={() => setActiveTab('surveys')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'surveys' ? '#059669' : '#f1f5f9',
            color: activeTab === 'surveys' ? '#ffffff' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <ClipboardCheck size={15} />
          Survey Coordination ({surveysReviewQueue.length})
        </button>

        <button
          onClick={() => setActiveTab('operations')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'operations' ? '#059669' : '#f1f5f9',
            color: activeTab === 'operations' ? '#ffffff' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Truck size={15} />
          Materials & Installations ({activeProjects.length})
        </button>

        <button
          onClick={() => setActiveTab('service')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'service' ? '#059669' : '#f1f5f9',
            color: activeTab === 'service' ? '#ffffff' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <HeadphonesIcon size={15} />
          Service & Exceptions ({serviceExceptions.length})
        </button>
      </div>

      {/* TAB 1: Commercial Deal Pipeline */}
      {activeTab === 'pipeline' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr', gap: '1.25rem' }}>
          
          {/* Assigned Leads Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>My Active Leads & Enquiries</h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Assigned CRM customer interactions</span>
              </div>
              <Link to="/enquiries" className="badge badge-primary">
                View All Leads
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {myEnquiries.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No active enquiries currently assigned.</p>
              ) : (
                myEnquiries.map((enq) => (
                  <div key={enq.id} style={{
                    background: '#f8fafc',
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{enq.customer_name}</strong>
                        <span className={`badge ${enq.priority === 'HIGH' ? 'badge-danger' : 'badge-secondary'}`} style={{ fontSize: '0.65rem' }}>
                          {enq.priority || 'MEDIUM'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({enq.capacity_kw || 3.0} kW)</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '1rem' }}>
                        <span><MapPin size={11} style={{ display: 'inline' }} /> {enq.city || 'N/A'}</span>
                        <span><Phone size={11} style={{ display: 'inline' }} /> {enq.phone || 'N/A'}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem', display: 'inline-block', marginBottom: '0.25rem' }}>
                        {enq.status}
                      </span>
                      <div>
                        <Link to="/quotations" style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <span>Quote</span> <ArrowRight size={11} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Follow-up Reminders */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Follow-up Schedule</h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Timely client contact & commitments</span>
              </div>
              <Link to="/appointments" className="badge badge-secondary">
                Calendar
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {upcomingFollowups.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No pending follow-ups scheduled.</p>
              ) : (
                upcomingFollowups.map((f, idx) => (
                  <div key={idx} style={{
                    padding: '0.85rem',
                    background: f.is_overdue ? '#fef2f2' : '#f0fdf4',
                    borderRadius: '8px',
                    border: `1px solid ${f.is_overdue ? '#fca5a5' : '#bbf7d0'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: f.is_overdue ? '#991b1b' : '#166534' }}>
                        {f.customer_name}
                      </strong>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: f.is_overdue ? '#dc2626' : '#15803d' }}>
                        {f.is_overdue ? 'OVERDUE' : f.follow_up_date}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#475569' }}>
                      Action: {f.next_action}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b' }}>
                      <span><Phone size={11} style={{ display: 'inline' }} /> {f.phone}</span>
                      <Link to="/enquiries" style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <span>Open Lead</span> <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Survey Coordination & Review Queue */}
      {activeTab === 'surveys' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Site Surveys Coordination & Review Queue</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Review technical survey findings, roof measurements, and structural feasibility submitted by Field Technicians.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/surveys" className="btn btn-secondary btn-sm">
                Full Survey Directory
              </Link>
              <Link to="/appointments" className="btn btn-primary btn-sm">
                Schedule Field Visit
              </Link>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Survey #</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Customer</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Location</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Technician</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Recommended kW</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.65rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {surveysReviewQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      No site surveys currently pending manager review.
                    </td>
                  </tr>
                ) : (
                  surveysReviewQueue.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem', fontWeight: 600, color: '#0f172a' }}>{s.survey_number}</td>
                      <td style={{ padding: '0.65rem' }}>{s.customer_name}</td>
                      <td style={{ padding: '0.65rem', color: '#64748b' }}>{s.customer_city}</td>
                      <td style={{ padding: '0.65rem' }}>{s.surveyor_name}</td>
                      <td style={{ padding: '0.65rem', fontWeight: 600, color: '#059669' }}>{s.recommended_capacity_kw} kW</td>
                      <td style={{ padding: '0.65rem' }}>
                        <span className="badge badge-warning">{s.status}</span>
                      </td>
                      <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                        {perms.can_approve_survey ? (
                          <button
                            onClick={() => {
                              setSelectedSurvey(s);
                              setReviewModalOpen(true);
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                          >
                            Review & Decide
                          </button>
                        ) : (
                          <Link to={`/surveys`} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}>
                            View Details
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={14} style={{ color: '#0284c7' }} />
            <span>
              <strong>RBAC Compliance Guard:</strong> Field technicians are strictly prohibited from approving their own surveys. As an authorised Sales Executive, your approvals unlock BOM generation and customer quotation drafting.
            </span>
          </div>
        </div>
      )}

      {/* TAB 3: Materials & Installations Monitoring */}
      {activeTab === 'operations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Readiness Indicators */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Inventory Allocated</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', margin: '0.2rem 0' }}>
                {materialReadiness.allocated_orders || 0} Orders
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Stock reserved at local depot</span>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Dispatched to Site</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7', margin: '0.2rem 0' }}>
                {materialReadiness.dispatched_orders || 0} Orders
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>In-transit or delivered to client</span>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Procurement Required</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706', margin: '0.2rem 0' }}>
                {materialReadiness.procurement_pending || 0} Orders
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Awaiting BOM or replenishment</span>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Commissioned Installations</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', margin: '0.2rem 0' }}>
                {installationProgress.commissioned || 0} Systems
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Grid synchronised & live</span>
            </div>
          </div>

          {/* Active Projects List */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Active Solar EPC Project Workflows</h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Confirmed customer contracts undergoing fulfillment</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link to="/bom" className="btn btn-secondary btn-sm">
                  View BOMs
                </Link>
                <Link to="/installations" className="btn btn-primary btn-sm">
                  Installation Tracking
                </Link>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>Order #</th>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>Customer</th>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>Capacity</th>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>Contract Value</th>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>Payment</th>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>EPC Stage</th>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>Target Date</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No active project workflows found.
                      </td>
                    </tr>
                  ) : (
                    activeProjects.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem', fontWeight: 600, color: '#0f172a' }}>{p.order_number}</td>
                        <td style={{ padding: '0.65rem' }}>{p.customer_name}</td>
                        <td style={{ padding: '0.65rem', fontWeight: 600, color: '#059669' }}>{p.capacity_kw} kW</td>
                        <td style={{ padding: '0.65rem', fontWeight: 600 }}>{formatINR(p.contract_inr)}</td>
                        <td style={{ padding: '0.65rem' }}>
                          <span className={`badge ${p.payment_status === 'FULL_PAID' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                            {p.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem' }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                            {p.stage}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem', color: '#64748b' }}>{p.installation_target_date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: Service & Customer Lifecycle */}
      {activeTab === 'service' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Service Tickets & Operational Exceptions</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Customer reported issues, inverter grid trips, and warranty claims registered via Digital Solar Passport.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/solar-passport" className="btn btn-secondary btn-sm">
                Solar Passport Portal
              </Link>
              <Link to="/service" className="btn btn-primary btn-sm">
                Manage Service Tickets
              </Link>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {serviceExceptions.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>
                No active service exceptions. All systems operating normally.
              </p>
            ) : (
              serviceExceptions.map((t) => (
                <div key={t.id} style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: t.priority === 'CRITICAL' ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${t.priority === 'CRITICAL' ? '#fca5a5' : '#e2e8f0'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{t.ticket_number}</strong>
                      <span className={`badge ${t.priority === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                        {t.priority}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Customer: {t.customer_name}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      Issue Category: <strong>{t.issue_category}</strong> | Assigned: {t.assigned_technician}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                      {t.status}
                    </span>
                    <Link to="/service" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}>
                      Manage Ticket
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Direct Survey Review Modal */}
      {reviewModalOpen && selectedSurvey && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Review Survey #{selectedSurvey.survey_number}
              </h3>
              <button
                onClick={() => setReviewModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div><strong>Customer:</strong> {selectedSurvey.customer_name} ({selectedSurvey.customer_city})</div>
              <div><strong>Field Technician:</strong> {selectedSurvey.surveyor_name}</div>
              <div><strong>Recommended Capacity:</strong> {selectedSurvey.recommended_capacity_kw} kW</div>
              <div><strong>Status:</strong> {selectedSurvey.status}</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Review Notes / Feasibility Comments:
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                placeholder="Enter engineering review notes, shading mitigation, or quotation guidance..."
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#b91c1c', marginBottom: '0.35rem' }}>
                Rejection Reason (Required only if rejecting):
              </label>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Inadequate roof strength / excessive tree shade"
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                disabled={actionLoading}
                onClick={() => setReviewModalOpen(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleRejectSurvey(selectedSurvey.id)}
                className="btn btn-danger btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <XCircle size={14} />
                <span>Reject Survey</span>
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleApproveSurvey(selectedSurvey.id)}
                className="btn btn-primary btn-sm"
                style={{ background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <CheckCircle2 size={14} />
                <span>Approve Survey</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
