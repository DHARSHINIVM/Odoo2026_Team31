import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { FormInput, FormSelect, FormTextarea } from '../components/FormControls';
import { ErrorState } from '../components/StateBoxes';
import CameraCapture from '../components/CameraCapture';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Eye,
  Compass,
  ShieldCheck,
  UserCheck,
  Calendar,
  Send,
  Clock,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';

const STATUS_FILTERS = ['ALL', 'SCHEDULED', 'ASSIGNED', 'SUBMITTED', 'APPROVED', 'REJECTED'];

export default function SurveysPage({ refreshTrigger }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const activeTab = searchParams.get('tab') || 'all';

  const [surveys, setSurveys] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assign Form
  const [assignForm, setAssignForm] = useState({
    technician_id: '',
    technician_name: '',
    survey_date: '',
  });

  // Review Form
  const [reviewForm, setReviewForm] = useState({
    review_notes: '',
    rejection_reason: '',
  });

  // Submit Measurements Form (for Technician)
  const [measurementsForm, setMeasurementsForm] = useState({
    roof_area_sqft: 800,
    usable_roof_area_sqft: 640,
    roof_type: 'RCC Flat',
    roof_azimuth_deg: 180,
    tilt_angle_deg: 15,
    shading_loss_pct: 3.5,
    structural_integrity: 'GOOD',
    recommended_capacity_kw: 5.0,
    structure_recommendation: 'Elevated HDG Structure',
    meter_type: 'THREE_PHASE',
    inverter_distance_meters: 10,
    electrical_observations: 'Grid connection stable; 415V 3-phase LT supply tested.',
    technician_observations: 'Terrace is unobstructed. High solar insolation potential.',
  });

  // Form State for Recording Survey directly
  const [formData, setFormData] = useState({
    enquiry_id: '',
    surveyor_name: 'Sanjay Gaikwad',
    roof_area_sqft: 800,
    usable_roof_area_sqft: 640,
    roof_type: 'RCC Flat',
    roof_azimuth_deg: 180,
    tilt_angle_deg: 15,
    shading_loss_pct: 3.5,
    structural_integrity: 'GOOD',
    recommended_capacity_kw: 5.0,
    structure_recommendation: 'Elevated Hot-Dip Galvanized Structure (80 Micron)',
    meter_type: 'THREE_PHASE',
    inverter_distance_meters: 10,
    notes: 'South-facing unshaded rooftop with sturdy RCC foundation pillars.',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [surveyList, enqList, techList] = await Promise.all([
        api.getSurveys({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        }),
        api.getEnquiries(),
        api.getTeamByRole('TECHNICIAN').catch(() => []),
      ]);
      setSurveys(surveyList);
      setEnquiries(enqList);
      setTechnicians(techList || []);

      if (enqList.length > 0 && !formData.enquiry_id) {
        setFormData((prev) => ({ ...prev, enquiry_id: enqList[0].id }));
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

  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    if (!formData.enquiry_id) {
      alert('Please select an associated enquiry.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        enquiry_id: parseInt(formData.enquiry_id, 10),
        surveyor_name: formData.surveyor_name,
        roof_area_sqft: parseFloat(formData.roof_area_sqft) || 800.0,
        usable_roof_area_sqft: parseFloat(formData.usable_roof_area_sqft) || 640.0,
        roof_type: formData.roof_type,
        roof_azimuth_deg: parseFloat(formData.roof_azimuth_deg) || 180.0,
        tilt_angle_deg: parseFloat(formData.tilt_angle_deg) || 15.0,
        shading_loss_pct: parseFloat(formData.shading_loss_pct) || 3.5,
        structural_integrity: formData.structural_integrity,
        recommended_capacity_kw: parseFloat(formData.recommended_capacity_kw) || 5.0,
        structure_recommendation: formData.structure_recommendation,
        meter_type: formData.meter_type,
        inverter_distance_meters: parseFloat(formData.inverter_distance_meters) || 10.0,
        notes: formData.notes || null,
      };

      await api.createSurvey(payload);
      setIsRecordModalOpen(false);
      loadData();
    } catch (err) {
      alert(`Failed to record survey: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Assign Modal (Survey Manager)
  const openAssignModal = (s) => {
    setSelectedSurvey(s);
    setAssignForm({
      technician_id: technicians[0]?.id || '',
      technician_name: technicians[0]?.full_name || technicians[0]?.name || 'Sanjay Gaikwad',
      survey_date: new Date().toISOString().split('T')[0],
    });
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSurvey || !assignForm.technician_id) return;
    setIsSubmitting(true);
    try {
      await api.assignSurveyTechnician(selectedSurvey.id, {
        technician_id: parseInt(assignForm.technician_id, 10),
        technician_name: assignForm.technician_name,
        survey_date: assignForm.survey_date ? new Date(assignForm.survey_date).toISOString() : null,
      });
      setIsAssignModalOpen(false);
      loadData();
      alert('Technician assigned successfully.');
    } catch (err) {
      alert(`Assignment failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Review Modal (Survey Manager)
  const openReviewModal = (s) => {
    setSelectedSurvey(s);
    setReviewForm({
      review_notes: 'Roof azimuth and structural integrity verified. Clear shading clearance.',
      rejection_reason: '',
    });
    setIsReviewModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedSurvey) return;
    setIsSubmitting(true);
    try {
      await api.approveSurvey(selectedSurvey.id, {
        review_notes: reviewForm.review_notes,
      });
      setIsReviewModalOpen(false);
      loadData();
      alert(`Survey ${selectedSurvey.survey_number} approved successfully. Eligible for quotation.`);
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSurvey) return;
    if (!reviewForm.rejection_reason) {
      alert('Please provide a rejection reason.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.rejectSurvey(selectedSurvey.id, {
        rejection_reason: reviewForm.rejection_reason,
        review_notes: reviewForm.review_notes,
      });
      setIsReviewModalOpen(false);
      loadData();
      alert(`Survey ${selectedSurvey.survey_number} marked as rejected.`);
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Submit Measurements Modal (Survey Technician)
  const openSubmitMeasurementsModal = (s) => {
    setSelectedSurvey(s);
    setMeasurementsForm({
      roof_area_sqft: s.roof_area_sqft || 800,
      usable_roof_area_sqft: s.usable_roof_area_sqft || 640,
      roof_type: s.roof_type || 'RCC Flat',
      roof_azimuth_deg: s.roof_azimuth_deg || 180,
      tilt_angle_deg: s.tilt_angle_deg || 15,
      shading_loss_pct: s.shading_loss_pct || 3.5,
      structural_integrity: s.structural_integrity || 'GOOD',
      recommended_capacity_kw: s.recommended_capacity_kw || 5.0,
      structure_recommendation: s.structure_recommendation || 'Elevated HDG Structure',
      meter_type: s.meter_type || 'THREE_PHASE',
      inverter_distance_meters: s.inverter_distance_meters || 10,
      electrical_observations: s.electrical_observations || 'Grid connection stable; 415V 3-phase LT supply tested.',
      technician_observations: s.technician_observations || 'Terrace is unobstructed. High solar insolation potential.',
    });
    setIsSubmitModalOpen(true);
  };

  const handleSubmitMeasurements = async (e) => {
    e.preventDefault();
    if (!selectedSurvey) return;
    setIsSubmitting(true);
    try {
      await api.submitSurveyByTechnician(selectedSurvey.id, measurementsForm);
      setIsSubmitModalOpen(false);
      loadData();
      alert('Field measurements and telemetry submitted for Manager Review.');
    } catch (err) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDetailModal = (s) => {
    setSelectedSurvey(s);
    setIsDetailModalOpen(true);
  };

  // Filter surveys based on URL tab
  const filteredSurveys = surveys.filter((s) => {
    if (activeTab === 'assignments') {
      return s.status === 'SCHEDULED' || s.status === 'REQUESTED' || !s.assigned_technician_id;
    }
    if (activeTab === 'review') {
      return s.status === 'SUBMITTED' || s.status === 'IN_PROGRESS';
    }
    if (activeTab === 'history') {
      return s.status === 'APPROVED' || s.status === 'REJECTED';
    }
    if (activeTab === 'mine') {
      if (user) {
        return s.assigned_technician_id === user.id || s.surveyor_name?.toLowerCase().includes(user.name?.toLowerCase());
      }
      return true;
    }
    if (activeTab === 'upcoming') {
      return s.status === 'ASSIGNED' || s.status === 'SCHEDULED';
    }
    return true;
  });

  const canCoordinateSurvey = role === 'ADMIN' || role === 'SOLAR_MANAGER' || role === 'SALES_EXECUTIVE';
  const isTechnician = role === 'TECHNICIAN' || role === 'FIELD_TECHNICIAN';

  const columns = [
    {
      header: 'Survey #',
      accessor: 'survey_number',
      render: (s) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{s.survey_number}</span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Ref: {s.enquiry_number || `Enquiry #${s.enquiry_id}`}
          </div>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (s) => (
        <div>
          <div style={{ fontWeight: 600 }}>{s.customer_name || 'N/A'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {s.customer_city} · {s.customer_phone}
          </div>
        </div>
      ),
    },
    {
      header: 'Surveyor',
      accessor: 'surveyor_name',
      render: (s) => (
        <div>
          <span style={{ fontWeight: 600 }}>{s.surveyor_name || 'Unassigned'}</span>
          {s.survey_date && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Date: {s.survey_date.split('T')[0]}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Roof Area',
      accessor: 'roof_area_sqft',
      render: (s) => (
        <div>
          <span style={{ fontWeight: 600 }}>{s.usable_roof_area_sqft} sq ft usable</span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total: {s.roof_area_sqft} sq ft</div>
        </div>
      ),
    },
    {
      header: 'Telemetry',
      accessor: 'tilt_angle_deg',
      render: (s) => (
        <div style={{ fontSize: '0.78rem' }}>
          <div>Tilt: {s.tilt_angle_deg}° · Azimuth: {s.roof_azimuth_deg}°</div>
          <div style={{ color: s.shading_loss_pct < 5 ? 'var(--solar-green-600)' : 'var(--amber-600)' }}>
            Shadow Loss: {s.shading_loss_pct}%
          </div>
        </div>
      ),
    },
    {
      header: 'Recommended kW',
      accessor: 'recommended_capacity_kw',
      render: (s) => (
        <span style={{ fontWeight: 700, color: 'var(--solar-green-600)' }}>
          {s.recommended_capacity_kw} kW
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (s) => <StatusBadge status={s.status} />,
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (s) => (
        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openDetailModal(s)}
            title="Inspect Survey Telemetry"
          >
            <Eye size={13} /> Details
          </button>

          {/* Coordination Actions (Admin / Sales Executive) */}
          {canCoordinateSurvey && (s.status === 'SCHEDULED' || s.status === 'REQUESTED' || !s.assigned_technician_id) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => openAssignModal(s)}
              title="Assign Surveyor"
            >
              <UserCheck size={13} /> Assign
            </button>
          )}

          {canCoordinateSurvey && s.status !== 'APPROVED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openReviewModal(s)}
              title="Review & Approve Survey"
            >
              <CheckCircle2 size={13} /> Review
            </button>
          )}

          {/* Technician Submit Measurements */}
          {isTechnician && s.status !== 'APPROVED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openSubmitMeasurementsModal(s)}
              title="Submit Field Measurements"
            >
              <Send size={13} /> Submit Measurements
            </button>
          )}

          {/* Commercial Handoff: Quotation Creation */}
          {s.status === 'APPROVED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/quotations?surveyId=${s.id}`)}
              title="Generate Formal Quotation"
            >
              <FileSpreadsheet size={13} /> Quote
            </button>
          )}
        </div>
      ),
    },
  ];

  const enquiryOptions = enquiries.map((e) => ({
    value: e.id,
    label: `${e.enquiry_number} · ${e.customer_name} (${e.required_capacity_kw}kW · ${e.customer_city})`,
  }));

  return (
    <div>
      <PageHeader
        title="Site Survey Management"
        description="Engineering roof measurements, shading telemetry, surveyor dispatch, and technical approval gates before commercial quotation."
        actions={
          <button className="btn btn-primary" onClick={() => setIsRecordModalOpen(true)}>
            <ClipboardCheck size={16} />
            <span>Record Survey Directly</span>
          </button>
        }
      />

      {/* Role Scoped Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => handleTabChange('all')}
        >
          All Surveys ({surveys.length})
        </button>

        {canCoordinateSurvey && (
          <>
            <button
              className={`btn btn-sm ${activeTab === 'assignments' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleTabChange('assignments')}
            >
              <UserCheck size={14} /> Survey Assignments
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'review' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleTabChange('review')}
            >
              <Eye size={14} /> Review Queue
            </button>
          </>
        )}

        {isTechnician && (
          <>
            <button
              className={`btn btn-sm ${activeTab === 'mine' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleTabChange('mine')}
            >
              <UserCheck size={14} /> My Surveys
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleTabChange('upcoming')}
            >
              <Calendar size={14} /> Upcoming Visits
            </button>
          </>
        )}

        <button
          className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => handleTabChange('history')}
        >
          <Clock size={14} /> Survey History
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>
          Status:
        </span>
        {STATUS_FILTERS.map((st) => (
          <button
            key={st}
            className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(st)}
          >
            {st}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Failed to load site surveys" message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredSurveys}
          searchPlaceholder="Search by survey #, customer, or surveyor..."
          searchKey="survey_number"
          isLoading={loading}
          emptyMessage="No surveys found matching the active tab filter."
        />
      )}

      {/* Record Survey Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Site Survey Measurements"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsRecordModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleRecordSubmit} disabled={isSubmitting || !formData.enquiry_id}>
              {isSubmitting ? 'Saving...' : 'Submit & Record Survey'}
            </button>
          </>
        }
      >
        <form onSubmit={handleRecordSubmit}>
          <FormSelect
            label="Linked Customer Enquiry"
            name="enquiry_id"
            value={formData.enquiry_id}
            onChange={handleInputChange}
            options={enquiryOptions.length > 0 ? enquiryOptions : [{ value: '', label: 'No enquiries found' }]}
            required
          />

          <FormInput
            label="Field Engineer / Surveyor Name"
            name="surveyor_name"
            value={formData.surveyor_name}
            onChange={handleInputChange}
            required
          />

          <div className="form-row">
            <FormInput
              label="Total Roof Area (sq ft)"
              name="roof_area_sqft"
              type="number"
              value={formData.roof_area_sqft}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Usable Shadow-Free Area (sq ft)"
              name="usable_roof_area_sqft"
              type="number"
              value={formData.usable_roof_area_sqft}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-row">
            <FormSelect
              label="Roof Structure Material"
              name="roof_type"
              value={formData.roof_type}
              onChange={handleInputChange}
              options={[
                { value: 'RCC Flat', label: 'RCC Flat Terrace' },
                { value: 'Slanted Tiled', label: 'Slanted Mangalore Tiled' },
                { value: 'Metal Shed', label: 'Metal Industrial Sheet' },
                { value: 'Ground Mount', label: 'Open Ground' },
              ]}
              required
            />
            <FormSelect
              label="Structural Soundness"
              name="structural_integrity"
              value={formData.structural_integrity}
              onChange={handleInputChange}
              options={[
                { value: 'EXCELLENT', label: 'Excellent - High Load Bearing' },
                { value: 'GOOD', label: 'Good - Standard HDG Mounting' },
                { value: 'FAIR', label: 'Fair - Requires Anchor Retrofit' },
                { value: 'POOR', label: 'Poor - Structural Reinforcement Needed' },
              ]}
              required
            />
          </div>

          <div className="form-row">
            <FormInput
              label="Tilt Angle (Degrees)"
              name="tilt_angle_deg"
              type="number"
              value={formData.tilt_angle_deg}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Azimuth Orientation (Degrees, 180° = South)"
              name="roof_azimuth_deg"
              type="number"
              value={formData.roof_azimuth_deg}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Shading Loss (%)"
              name="shading_loss_pct"
              type="number"
              step="0.1"
              value={formData.shading_loss_pct}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-row">
            <FormInput
              label="Recommended Solar Capacity (kW)"
              name="recommended_capacity_kw"
              type="number"
              step="0.5"
              value={formData.recommended_capacity_kw}
              onChange={handleInputChange}
              required
            />
            <FormSelect
              label="Meter Type"
              name="meter_type"
              value={formData.meter_type}
              onChange={handleInputChange}
              options={[
                { value: 'SINGLE_PHASE', label: 'Single Phase LT (Up to 5kW)' },
                { value: 'THREE_PHASE', label: 'Three Phase LT (Above 5kW)' },
                { value: 'HT_CONSUMER', label: 'High Tension (HT 11kV)' },
              ]}
              required
            />
          </div>

          <FormInput
            label="Structure Specification"
            name="structure_recommendation"
            value={formData.structure_recommendation}
            onChange={handleInputChange}
            required
          />

          <FormTextarea
            label="Technical Site Observations"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={2}
          />
        </form>
      </Modal>

      {/* Assign Surveyor Modal (Survey Manager) */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Surveyor: ${selectedSurvey?.survey_number}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAssignSubmit} disabled={isSubmitting || !assignForm.technician_id}>
              {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </>
        }
      >
        <form onSubmit={handleAssignSubmit}>
          <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', marginBottom: '1rem', border: '1px solid var(--border-subtle)' }}>
            <strong>Customer:</strong> {selectedSurvey?.customer_name} ({selectedSurvey?.customer_city})<br />
            <strong>Contact:</strong> {selectedSurvey?.customer_phone}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              Select Certified Survey Technician
            </label>
            <select
              className="input"
              value={assignForm.technician_id}
              onChange={(e) => {
                const id = e.target.value;
                const tech = technicians.find((t) => t.id === parseInt(id, 10));
                setAssignForm((prev) => ({
                  ...prev,
                  technician_id: id,
                  technician_name: tech ? (tech.full_name || tech.name) : '',
                }));
              }}
              required
            >
              <option value="">Select Technician</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.name} ({t.role ? t.role.replace('_', ' ') : t.email})
                </option>
              ))}
            </select>
          </div>

          <FormInput
            label="Survey Scheduled Date"
            type="date"
            name="survey_date"
            value={assignForm.survey_date}
            onChange={(e) => setAssignForm((prev) => ({ ...prev, survey_date: e.target.value }))}
            required
          />
        </form>
      </Modal>

      {/* Manager Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`Manager Review & Approval Gate: ${selectedSurvey?.survey_number}`}
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setIsReviewModalOpen(false)}>
              Cancel
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-sm"
                style={{ background: '#fff1f2', color: 'var(--red-600)', border: '1px solid #fecdd3', fontWeight: 700 }}
                onClick={handleReject}
                disabled={isSubmitting}
              >
                <XCircle size={14} /> Reject Survey
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleApprove} disabled={isSubmitting}>
                <CheckCircle2 size={14} /> Approve for Quotation
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '6px', border: '1px solid var(--solar-green-200)' }}>
            <strong>Client:</strong> {selectedSurvey?.customer_name} ({selectedSurvey?.customer_city})<br />
            <strong>Usable Area:</strong> {selectedSurvey?.usable_roof_area_sqft} sq ft · <strong>Capacity:</strong> {selectedSurvey?.recommended_capacity_kw} kW<br />
            <strong>Tilt & Azimuth:</strong> {selectedSurvey?.tilt_angle_deg}° / {selectedSurvey?.roof_azimuth_deg}° · <strong>Shading Loss:</strong> {selectedSurvey?.shading_loss_pct}%
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              Manager Review Notes (Included in dossier)
            </label>
            <textarea
              className="input"
              rows={3}
              value={reviewForm.review_notes}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, review_notes: e.target.value }))}
              placeholder="e.g. Structure load bearing confirmed. Roof is eligible for 5kW on-grid solar."
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem', color: 'var(--red-600)' }}>
              Rejection Reason (Required only if rejecting)
            </label>
            <input
              type="text"
              className="input"
              value={reviewForm.rejection_reason}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, rejection_reason: e.target.value }))}
              placeholder="e.g. Excessive tree shading > 25% or structural cracks detected."
            />
          </div>
        </div>
      </Modal>

      {/* Submit Measurements Modal (Survey Technician) */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title={`Field Survey Telemetry Submission: ${selectedSurvey?.survey_number}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsSubmitModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmitMeasurements} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit to Manager Review'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitMeasurements}>
          <div className="form-row">
            <FormInput
              label="Usable Roof Area (sq ft)"
              type="number"
              value={measurementsForm.usable_roof_area_sqft}
              onChange={(e) => setMeasurementsForm((p) => ({ ...p, usable_roof_area_sqft: parseFloat(e.target.value) }))}
              required
            />
            <FormInput
              label="Recommended Capacity (kW)"
              type="number"
              step="0.5"
              value={measurementsForm.recommended_capacity_kw}
              onChange={(e) => setMeasurementsForm((p) => ({ ...p, recommended_capacity_kw: parseFloat(e.target.value) }))}
              required
            />
          </div>

          <div className="form-row">
            <FormInput
              label="Tilt Angle (°)"
              type="number"
              value={measurementsForm.tilt_angle_deg}
              onChange={(e) => setMeasurementsForm((p) => ({ ...p, tilt_angle_deg: parseFloat(e.target.value) }))}
              required
            />
            <FormInput
              label="Azimuth Angle (°)"
              type="number"
              value={measurementsForm.roof_azimuth_deg}
              onChange={(e) => setMeasurementsForm((p) => ({ ...p, roof_azimuth_deg: parseFloat(e.target.value) }))}
              required
            />
            <FormInput
              label="Shading Loss (%)"
              type="number"
              step="0.1"
              value={measurementsForm.shading_loss_pct}
              onChange={(e) => setMeasurementsForm((p) => ({ ...p, shading_loss_pct: parseFloat(e.target.value) }))}
              required
            />
          </div>

          <FormTextarea
            label="Electrical Grid & Distribution Observations"
            value={measurementsForm.electrical_observations}
            onChange={(e) => setMeasurementsForm((p) => ({ ...p, electrical_observations: e.target.value }))}
            rows={2}
          />

          <FormTextarea
            label="Technician On-Site Observations"
            value={measurementsForm.technician_observations}
            onChange={(e) => setMeasurementsForm((p) => ({ ...p, technician_observations: e.target.value }))}
            rows={2}
          />

          <div style={{ marginTop: '0.85rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
              Roof & Electrical Photo Evidence
            </label>
            <CameraCapture
              mode="photo"
              title="Site Survey Photo Evidence"
              onCapture={(photo) => {
                setMeasurementsForm((p) => ({
                  ...p,
                  evidence_files: [...(p.evidence_files || []), photo],
                }));
              }}
            />
          </div>
        </form>
      </Modal>

      {/* Inspect Survey Details Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Survey Engineering Dossier: ${selectedSurvey?.survey_number}`}
        footer={
          <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
            Close
          </button>
        }
      >
        {selectedSurvey && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Engineering Gate</span>
                <div><StatusBadge status={selectedSurvey.status} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Surveyor</span>
                <p style={{ fontWeight: 600 }}>{selectedSurvey.surveyor_name}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Client & Location</span>
                <p style={{ fontWeight: 600 }}>{selectedSurvey.customer_name} ({selectedSurvey.customer_city})</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Recommended System</span>
                <p style={{ fontWeight: 700, color: 'var(--solar-green-600)' }}>{selectedSurvey.recommended_capacity_kw} kW</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Roof Surface</span>
                <p>{selectedSurvey.usable_roof_area_sqft} sq ft usable ({selectedSurvey.roof_type})</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Shading Loss & Tilt</span>
                <p>{selectedSurvey.shading_loss_pct}% loss · {selectedSurvey.tilt_angle_deg}° tilt</p>
              </div>
            </div>

            {selectedSurvey.review_notes && (
              <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '6px', border: '1px solid var(--solar-green-200)' }}>
                <span style={{ fontWeight: 700, color: 'var(--solar-green-700)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Manager Review Approval Notes
                </span>
                <p style={{ color: 'var(--navy-900)', marginTop: '0.2rem' }}>{selectedSurvey.review_notes}</p>
              </div>
            )}

            {selectedSurvey.rejection_reason && (
              <div style={{ padding: '0.75rem', background: '#fff1f2', borderRadius: '6px', border: '1px solid #fecdd3' }}>
                <span style={{ fontWeight: 700, color: 'var(--red-600)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Rejection Reason
                </span>
                <p style={{ color: 'var(--red-700)', marginTop: '0.2rem' }}>{selectedSurvey.rejection_reason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
