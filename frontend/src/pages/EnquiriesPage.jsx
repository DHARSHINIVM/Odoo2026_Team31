import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { FormInput, FormSelect, FormTextarea } from '../components/FormControls';
import { ErrorState } from '../components/StateBoxes';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquarePlus,
  Zap,
  Calendar,
  Eye,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Clock,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';

const STATUS_FILTERS = [
  'ALL',
  'NEW',
  'SURVEY_SCHEDULED',
  'SURVEY_COMPLETED',
  'QUOTED',
  'ORDER_PLACED',
  'REJECTED',
];

export default function EnquiriesPage({ refreshTrigger }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const activeTab = searchParams.get('tab') || 'all';

  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesTeam, setSalesTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedRepFilter, setSelectedRepFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CRM Edit Form State (Inside Detail Modal)
  const [crmForm, setCrmForm] = useState({
    assigned_sales_rep_id: '',
    sales_rep_name: '',
    lead_priority: 'MEDIUM',
    follow_up_date: '',
    follow_up_notes: '',
    next_action: '',
    new_interaction_note: '',
  });

  // Forms
  const [formData, setFormData] = useState({
    customer_id: '',
    required_capacity_kw: 5.0,
    property_type: 'Residential',
    roof_type: 'RCC Flat',
    grid_type: 'ON_GRID',
    budget_inr: 300000,
    notes: '',
  });

  const [scheduleData, setScheduleData] = useState({
    surveyor_name: 'Sanjay Gaikwad',
    survey_date: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [enqData, custList, teamData] = await Promise.all([
        api.getEnquiries({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchTerm || undefined,
        }),
        api.getCustomers(),
        api.getTeamByRole('SALES_EXECUTIVE').catch(() => []),
      ]);
      setEnquiries(enqData);
      setCustomers(custList);
      setSalesTeam(teamData || []);

      if (custList.length > 0 && !formData.customer_id) {
        setFormData((prev) => ({ ...prev, customer_id: custList[0].id }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger, statusFilter]);

  const handleTabChange = (tabName) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabName === 'all') {
        next.delete('tab');
      } else {
        next.set('tab', tabName);
      }
      return next;
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleScheduleChange = (e) => {
    const { name, value } = e.target;
    setScheduleData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateEnquiry = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      alert('Please select a customer for this enquiry.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        customer_id: parseInt(formData.customer_id, 10),
        required_capacity_kw: parseFloat(formData.required_capacity_kw) || 5.0,
        property_type: formData.property_type,
        roof_type: formData.roof_type,
        grid_type: formData.grid_type,
        budget_paise: formData.budget_inr ? Math.round(Number(formData.budget_inr) * 100) : null,
        notes: formData.notes || null,
      };

      await api.createEnquiry(payload);
      setIsCreateModalOpen(false);
      loadData();
    } catch (err) {
      alert(`Failed to create enquiry: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openScheduleModal = (enq) => {
    setSelectedEnquiry(enq);
    setScheduleData({
      surveyor_name: 'Sanjay Gaikwad',
      survey_date: new Date().toISOString().split('T')[0],
      notes: `Site survey for ${enq.customer_name} (${enq.required_capacity_kw}kW ${enq.roof_type})`,
    });
    setIsScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEnquiry) return;
    setIsSubmitting(true);
    try {
      await api.scheduleSurvey(selectedEnquiry.id, {
        surveyor_name: scheduleData.surveyor_name,
        notes: scheduleData.notes,
      });
      setIsScheduleModalOpen(false);
      setSelectedEnquiry(null);
      loadData();
    } catch (err) {
      alert(`Failed to schedule survey: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDetailModal = (enq) => {
    setSelectedEnquiry(enq);
    setCrmForm({
      assigned_sales_rep_id: enq.assigned_sales_rep_id || '',
      sales_rep_name: enq.sales_rep_name || 'Unassigned',
      lead_priority: enq.lead_priority || 'MEDIUM',
      follow_up_date: enq.follow_up_date ? enq.follow_up_date.split('T')[0] : '',
      follow_up_notes: enq.follow_up_notes || '',
      next_action: enq.next_action || '',
      new_interaction_note: '',
    });
    setIsDetailModalOpen(true);
  };

  const handleSaveCrmUpdates = async () => {
    if (!selectedEnquiry) return;
    setIsSubmitting(true);
    try {
      let interactions = [];
      try {
        interactions = JSON.parse(selectedEnquiry.interaction_history || '[]');
      } catch (e) {
        interactions = [];
      }

      if (crmForm.new_interaction_note.trim()) {
        interactions.push({
          timestamp: new Date().toISOString(),
          author: user?.name || 'Sales Representative',
          note: crmForm.new_interaction_note.trim(),
        });
      }

      const payload = {
        assigned_sales_rep_id: crmForm.assigned_sales_rep_id ? parseInt(crmForm.assigned_sales_rep_id, 10) : null,
        sales_rep_name: crmForm.sales_rep_name || 'Unassigned',
        lead_priority: crmForm.lead_priority,
        follow_up_date: crmForm.follow_up_date ? new Date(crmForm.follow_up_date).toISOString() : null,
        follow_up_notes: crmForm.follow_up_notes || null,
        next_action: crmForm.next_action || null,
        interaction_history: JSON.stringify(interactions),
      };

      const updated = await api.updateEnquiry(selectedEnquiry.id, payload);
      setSelectedEnquiry(updated);
      setCrmForm((prev) => ({ ...prev, new_interaction_note: '' }));
      loadData();
      alert('CRM details & follow-up schedule updated successfully.');
    } catch (err) {
      alert(`Failed to update CRM data: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (enq, newStatus) => {
    try {
      await api.updateEnquiryStatus(enq.id, newStatus);
      loadData();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // Filter enquiries according to active tab and selected sales rep
  const filteredEnquiries = enquiries.filter((e) => {
    // 1. Tab filter
    if (activeTab === 'followups') {
      const hasFollowUp = Boolean(e.follow_up_date);
      const isPending = ['NEW', 'SURVEY_SCHEDULED', 'SURVEY_COMPLETED', 'QUOTED'].includes(e.status);
      if (!hasFollowUp && !isPending) return false;
    } else if (activeTab === 'mine') {
      if (user && e.assigned_sales_rep_id && e.assigned_sales_rep_id !== user.id) {
        return false;
      }
    }

    // 2. Sales rep filter
    if (selectedRepFilter !== 'ALL') {
      if (e.sales_rep_name !== selectedRepFilter) return false;
    }

    return true;
  });

  const columns = [
    {
      header: 'Enquiry #',
      accessor: 'enquiry_number',
      render: (e) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>
            {e.enquiry_number}
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Source: {e.source || 'Website'}
          </div>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (e) => (
        <div>
          <div style={{ fontWeight: 600 }}>{e.customer_name || `Customer #${e.customer_id}`}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {e.customer_city} · {e.customer_phone}
          </div>
        </div>
      ),
    },
    {
      header: 'Capacity & Grid',
      accessor: 'required_capacity_kw',
      render: (e) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--solar-green-600)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <Zap size={14} />
            {e.required_capacity_kw} kW
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{e.grid_type}</div>
        </div>
      ),
    },
    {
      header: 'Sales Rep & Priority',
      accessor: 'sales_rep_name',
      render: (e) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            {e.sales_rep_name || 'Unassigned'}
          </div>
          <span
            className={`badge ${
              e.lead_priority === 'URGENT' || e.lead_priority === 'HIGH'
                ? 'badge-danger'
                : e.lead_priority === 'MEDIUM'
                ? 'badge-warning'
                : 'badge-neutral'
            }`}
            style={{ fontSize: '0.68rem', padding: '1px 6px' }}
          >
            {e.lead_priority || 'MEDIUM'}
          </span>
        </div>
      ),
    },
    {
      header: 'Follow-Up',
      accessor: 'follow_up_date',
      render: (e) => {
        if (!e.follow_up_date) {
          return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>None scheduled</span>;
        }
        const isPast = new Date(e.follow_up_date) < new Date();
        return (
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isPast ? 'var(--red-600)' : 'var(--navy-900)' }}>
              {e.follow_up_date.split('T')[0]} {isPast && '(Overdue)'}
            </div>
            {e.next_action && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.next_action}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (e) => <StatusBadge status={e.status} />,
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (e) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openDetailModal(e)}
            title="Open CRM Lead Dossier"
          >
            <Eye size={13} /> Dossier
          </button>
          {e.status === 'NEW' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openScheduleModal(e)}
              title="Schedule Site Survey"
            >
              <Calendar size={13} /> Schedule
            </button>
          )}
          {e.survey_status === 'APPROVED' && e.status !== 'QUOTED' && e.status !== 'ORDER_PLACED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/quotations?enquiryId=${e.id}`)}
              title="Generate Formal Quotation"
            >
              <FileSpreadsheet size={13} /> Quote
            </button>
          )}
        </div>
      ),
    },
  ];

  const uniqueReps = Array.from(new Set(enquiries.map((e) => e.sales_rep_name).filter(Boolean)));

  return (
    <div>
      <PageHeader
        title="CRM & Enquiry Management"
        description="Lead qualification, sales executive assignment, follow-up scheduling, and site survey handoff."
        actions={
          <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            <MessageSquarePlus size={16} /> New Customer Enquiry
          </button>
        }
      />

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => handleTabChange('all')}
        >
          All Enquiries ({enquiries.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'followups' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => handleTabChange('followups')}
        >
          <Clock size={14} /> Follow-ups Due & Active Leads
        </button>
        {role === 'SALES_EXECUTIVE' && (
          <button
            className={`btn btn-sm ${activeTab === 'mine' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleTabChange('mine')}
          >
            <UserCheck size={14} /> My Assigned Leads
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '0.85rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Assigned Rep:</span>
          <select
            className="input"
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
            value={selectedRepFilter}
            onChange={(e) => setSelectedRepFilter(e.target.value)}
          >
            <option value="ALL">All Sales Executives</option>
            {uniqueReps.map((rep) => (
              <option key={rep} value={rep}>
                {rep}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredEnquiries}
          searchPlaceholder="Search enquiry #, customer name, phone..."
          searchKey="enquiry_number"
          isLoading={loading}
          emptyMessage="No customer enquiries found matching current filters."
        />
      )}

      {/* Create Enquiry Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record New Customer Solar Enquiry"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateEnquiry} disabled={isSubmitting || !formData.customer_id}>
              {isSubmitting ? 'Submitting...' : 'Create Enquiry'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateEnquiry}>
          <FormSelect
            label="Select Existing Customer"
            name="customer_id"
            value={formData.customer_id}
            onChange={handleInputChange}
            options={customers.map((c) => ({
              value: c.id,
              label: `${c.name} · ${c.city} (${c.phone})`,
            }))}
            required
          />

          <div className="form-row">
            <FormInput
              label="Required Capacity (kW)"
              name="required_capacity_kw"
              type="number"
              step="0.5"
              value={formData.required_capacity_kw}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Estimated Budget (₹ INR)"
              name="budget_inr"
              type="number"
              value={formData.budget_inr}
              onChange={handleInputChange}
              placeholder="e.g. 320000"
            />
          </div>

          <div className="form-row">
            <FormSelect
              label="Property Type"
              name="property_type"
              value={formData.property_type}
              onChange={handleInputChange}
              options={[
                { value: 'Residential', label: 'Residential' },
                { value: 'Commercial', label: 'Commercial' },
                { value: 'Industrial', label: 'Industrial' },
                { value: 'Agricultural', label: 'Agricultural' },
                { value: 'Institutional', label: 'Institutional' },
              ]}
              required
            />
            <FormSelect
              label="Grid Configuration"
              name="grid_type"
              value={formData.grid_type}
              onChange={handleInputChange}
              options={[
                { value: 'ON_GRID', label: 'On-Grid (Net Metered)' },
                { value: 'OFF_GRID', label: 'Off-Grid (Battery Storage)' },
                { value: 'HYBRID', label: 'Hybrid (Grid + Storage)' },
              ]}
              required
            />
          </div>

          <FormSelect
            label="Roof Structure Type"
            name="roof_type"
            value={formData.roof_type}
            onChange={handleInputChange}
            options={[
              { value: 'RCC Flat', label: 'RCC Flat Terrace' },
              { value: 'Slanted Tiled', label: 'Slanted Mangalore Tiled' },
              { value: 'Metal Shed', label: 'Industrial Metal / Trapezoidal Sheet' },
              { value: 'Ground Mount', label: 'Ground Mount Open Field' },
            ]}
            required
          />

          <FormTextarea
            label="Customer Notes & Requirements"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="e.g. Needs bifacial panels, PM Surya Ghar subsidy guidance, or battery backup."
            rows={3}
          />
        </form>
      </Modal>

      {/* Schedule Survey Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title={`Schedule Site Survey for ${selectedEnquiry?.enquiry_number}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsScheduleModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleScheduleSubmit} disabled={isSubmitting || !scheduleData.surveyor_name}>
              {isSubmitting ? 'Scheduling...' : 'Dispatch Surveyor'}
            </button>
          </>
        }
      >
        <form onSubmit={handleScheduleSubmit}>
          <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '6px', marginBottom: '1rem', border: '1px solid var(--solar-green-100)' }}>
            <strong>Customer:</strong> {selectedEnquiry?.customer_name} ({selectedEnquiry?.customer_city})<br />
            <strong>Required System:</strong> {selectedEnquiry?.required_capacity_kw} kW · {selectedEnquiry?.roof_type}
          </div>

          <FormInput
            label="Assigned Site Engineer / Surveyor"
            name="surveyor_name"
            value={scheduleData.surveyor_name}
            onChange={handleScheduleChange}
            placeholder="e.g. Sanjay Gaikwad"
            required
          />

          <FormInput
            label="Target Survey Date"
            name="survey_date"
            type="date"
            value={scheduleData.survey_date}
            onChange={handleScheduleChange}
            required
          />

          <FormTextarea
            label="Survey Instructions & Scope"
            name="notes"
            value={scheduleData.notes}
            onChange={handleScheduleChange}
            placeholder="Specific inspection points, e.g., electrical distribution board location and parapet shading."
            rows={3}
          />
        </form>
      </Modal>

      {/* Enquiry Detail & Extended CRM Dossier Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Enquiry Dossier & CRM: ${selectedEnquiry?.enquiry_number}`}
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </button>
            <button className="btn btn-primary" onClick={handleSaveCrmUpdates} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save CRM Updates'}
            </button>
          </div>
        }
      >
        {selectedEnquiry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Lifecycle Status</span>
                <div><StatusBadge status={selectedEnquiry.status} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Created</span>
                <p style={{ fontWeight: 600 }}>{selectedEnquiry.created_at?.split('T')[0]}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Client Name</span>
                <p style={{ fontWeight: 600 }}>{selectedEnquiry.customer_name}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Contact</span>
                <p>{selectedEnquiry.customer_phone}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>System Sizing</span>
                <p style={{ fontWeight: 700, color: 'var(--solar-green-600)' }}>{selectedEnquiry.required_capacity_kw} kW ({selectedEnquiry.grid_type})</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Roof Structure</span>
                <p>{selectedEnquiry.roof_type} ({selectedEnquiry.property_type})</p>
              </div>
            </div>

            {/* CRM Editable Section */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} color="var(--solar-green-600)" /> Sales Representative Assignment & Follow-up
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Assigned Sales Executive
                  </label>
                  <select
                    className="input"
                    value={crmForm.assigned_sales_rep_id || ''}
                    onChange={(e) => {
                      const repId = e.target.value;
                      const repObj = salesTeam.find((u) => u.id === parseInt(repId));
                      setCrmForm((prev) => ({
                        ...prev,
                        assigned_sales_rep_id: repId,
                        sales_rep_name: repObj ? repObj.name : 'Unassigned',
                      }));
                    }}
                  >
                    <option value="">Unassigned</option>
                    {salesTeam.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.name} ({rep.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Lead Priority
                  </label>
                  <select
                    className="input"
                    value={crmForm.lead_priority}
                    onChange={(e) => setCrmForm((prev) => ({ ...prev, lead_priority: e.target.value }))}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent / Hot Lead</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={crmForm.follow_up_date}
                    onChange={(e) => setCrmForm((prev) => ({ ...prev, follow_up_date: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Next Action Item
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Call back after roof photos"
                    value={crmForm.next_action}
                    onChange={(e) => setCrmForm((prev) => ({ ...prev, next_action: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Follow-up Notes / Customer Pitch
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={crmForm.follow_up_notes}
                  onChange={(e) => setCrmForm((prev) => ({ ...prev, follow_up_notes: e.target.value }))}
                  placeholder="Notes from customer calls, tariff savings discussion, or roof readiness."
                />
              </div>

              {/* Interaction History Log */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Log New Interaction Note
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Sent brochure on WhatsApp; client requested 5kW quotation."
                    value={crmForm.new_interaction_note}
                    onChange={(e) => setCrmForm((prev) => ({ ...prev, new_interaction_note: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Quick Status Update */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                Advance Lead Status
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {['SURVEY_SCHEDULED', 'SURVEY_COMPLETED', 'QUOTED', 'ORDER_PLACED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      handleUpdateStatus(selectedEnquiry, st);
                      setIsDetailModalOpen(false);
                    }}
                    disabled={selectedEnquiry.status === st}
                  >
                    Set {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
