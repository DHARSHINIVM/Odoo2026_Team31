import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Wrench,
  Compass,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  MapPin,
  FileCheck,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  Send,
  Eye,
  Check,
  FileText,
  UserCheck,
  ExternalLink
} from 'lucide-react';

export default function UnifiedTechnicianDashboard({ refreshTrigger }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'surveys' | 'installations' | 'history'

  // Survey Submission Modal
  const [submittingSurvey, setSubmittingSurvey] = useState(null);
  const [surveyFormData, setSurveyFormData] = useState({
    roof_dimensions: '14m x 9m',
    usable_roof_area_sqft: 650,
    shadow_free_area_sqft: 600,
    roof_azimuth_deg: 180,
    tilt_angle_deg: 15,
    shading_loss_pct: 2.5,
    structural_integrity: 'EXCELLENT',
    recommended_capacity_kw: 5.0,
    technician_observations: 'Terrace is clear of permanent shade. RCC slab load bearing verified.',
  });
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);

  // Installation Worksheet Modal
  const [activeJob, setActiveJob] = useState(null);
  const [worksheet, setWorksheet] = useState({
    chk_structure_installed: true,
    chk_panels_installed: true,
    chk_inverter_installed: true,
    chk_electrical_completed: true,
    chk_earthing_completed: true,
    chk_safety_checks_completed: true,
    chk_system_tested: true,
    chk_customer_handover_completed: true,
    voltage_reading_volts: 235.2,
    current_reading_amps: 21.4,
    power_output_kw: 5.03,
    grid_frequency_hz: 50.02,
    customer_signed_by_name: '',
    customer_feedback_rating: 5,
    customer_remarks: 'Installation completed neatly and verified with grid sync.',
  });
  const [isSavingWorksheet, setIsSavingWorksheet] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getUnifiedTechnicianDashboard();
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

  const handleSubmitSurvey = async (e) => {
    e.preventDefault();
    if (!submittingSurvey) return;
    setIsSubmittingSurvey(true);
    try {
      await api.submitSurveyByTechnician(submittingSurvey.id, surveyFormData);
      alert(`Survey #${submittingSurvey.survey_number} submitted for Survey Manager review.`);
      setSubmittingSurvey(null);
      await loadData();
    } catch (err) {
      alert(`Survey submission error: ${err.message}`);
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  const handleOpenWorksheet = (job) => {
    setActiveJob(job);
    setWorksheet({
      chk_structure_installed: true,
      chk_panels_installed: true,
      chk_inverter_installed: true,
      chk_electrical_completed: true,
      chk_earthing_completed: true,
      chk_safety_checks_completed: true,
      chk_system_tested: true,
      chk_customer_handover_completed: true,
      voltage_reading_volts: 235.0,
      current_reading_amps: 21.0,
      power_output_kw: job.capacity_kw || 5.0,
      grid_frequency_hz: 50.0,
      customer_signed_by_name: job.customer || '',
      customer_feedback_rating: 5,
      customer_remarks: 'Commissioning verified on site with 8-point electrical checklist.',
    });
  };

  const handleSaveCommissioning = async (e) => {
    e.preventDefault();
    if (!activeJob) return;

    const allChecked = (
      worksheet.chk_structure_installed &&
      worksheet.chk_panels_installed &&
      worksheet.chk_inverter_installed &&
      worksheet.chk_electrical_completed &&
      worksheet.chk_earthing_completed &&
      worksheet.chk_safety_checks_completed &&
      worksheet.chk_system_tested &&
      worksheet.chk_customer_handover_completed
    );

    if (!allChecked) {
      alert('Mandatory Guard: All 8 checklist items must be verified before commissioning can be finalized.');
      return;
    }

    setIsSavingWorksheet(true);
    try {
      await api.updateInstallationChecklist(activeJob.id, worksheet);
      await api.commissionInstallation(activeJob.id, {
        customer_signed_by_name: worksheet.customer_signed_by_name,
        customer_remarks: worksheet.customer_remarks,
        customer_feedback_rating: worksheet.customer_feedback_rating,
      });

      alert(`Installation ${activeJob.installation_number} commissioned! Digital Solar Passport activated.`);
      setActiveJob(null);
      await loadData();
    } catch (err) {
      alert(`Commissioning error: ${err.message}`);
    } finally {
      setIsSavingWorksheet(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading Field Technician Operations...</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', background: '#fef2f2', color: '#b91c1c' }}>Error: {error}</div>;
  }

  const kpis = data?.kpis || {};
  const mySurveys = data?.my_surveys || [];
  const myInstallations = data?.my_installations || [];
  const capabilities = data?.technician?.capabilities || user?.capabilities || [];

  const hasSurveyCapability = capabilities.includes('SURVEY_EXECUTION') || user?.role === 'TECHNICIAN' || user?.role === 'FIELD_TECHNICIAN' || user?.role === 'ADMIN';
  const hasInstallCapability = capabilities.includes('INSTALLATION_EXECUTION') || user?.role === 'TECHNICIAN' || user?.role === 'FIELD_TECHNICIAN' || user?.role === 'ADMIN';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '1.75rem 2rem',
        borderRadius: '12px',
        color: '#ffffff',
        border: '1px solid #334155'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Unified Field Operations Workspace
            </span>
            <span style={{
              fontSize: '0.7rem',
              background: '#0369a1',
              color: '#ffffff',
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              fontWeight: 600
            }}>
              Shared Employee Identity
            </span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0' }}>
            {data?.technician?.name || user?.full_name || 'Field Technician'}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
            {capabilities.map((cap) => (
              <span key={cap} style={{
                fontSize: '0.72rem',
                background: 'rgba(255,255,255,0.1)',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                color: '#cbd5e1'
              }}>
                ✓ {cap.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {hasSurveyCapability && (
            <Link to="/surveys?tab=mine" className="btn btn-secondary btn-sm" style={{ color: '#0284c7' }}>
              <Compass size={14} />
              <span>My Surveys</span>
            </Link>
          )}
          {hasInstallCapability && (
            <Link to="/installations?tab=mine" className="btn btn-primary btn-sm" style={{ background: '#ea580c', border: 'none' }}>
              <Wrench size={14} />
              <span>My Installations</span>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Today's Tasks</span>
            <Clock size={18} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{kpis.today_tasks ?? 0}</div>
          <span style={{ fontSize: '0.75rem', color: '#0369a1' }}>Surveys & installations scheduled today</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Pending Submissions</span>
            <AlertTriangle size={18} style={{ color: '#d97706' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{kpis.pending_submissions ?? 0}</div>
          <span style={{ fontSize: '0.75rem', color: '#d97706' }}>Awaiting measurements / worksheets</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Returned Surveys</span>
            <AlertTriangle size={18} style={{ color: '#dc2626' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: kpis.returned_surveys > 0 ? '#dc2626' : '#16a34a' }}>
            {kpis.returned_surveys ?? 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Requires field revisions</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Completed Work</span>
            <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{kpis.completed_jobs ?? 0}</div>
          <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>Approved surveys & commissioned sites</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
        >
          <Layers size={14} />
          <span>Today's Overview & Queue</span>
        </button>

        {hasSurveyCapability && (
          <button
            className={`btn btn-sm ${activeTab === 'surveys' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('surveys')}
          >
            <Compass size={14} />
            <span>My Assigned Surveys ({mySurveys.length})</span>
          </button>
        )}

        {hasInstallCapability && (
          <button
            className={`btn btn-sm ${activeTab === 'installations' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('installations')}
          >
            <Wrench size={14} />
            <span>My Installations ({myInstallations.length})</span>
          </button>
        )}
      </div>

      {/* TAB CONTENT: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          
          {/* Active Surveys Queue */}
          {hasSurveyCapability && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Compass size={18} style={{ color: '#0284c7' }} />
                  <span>Assigned Site Surveys</span>
                </h3>
                <Link to="/surveys?tab=mine" style={{ fontSize: '0.8rem', color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
                  View All →
                </Link>
              </div>

              {mySurveys.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No surveys currently assigned.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {mySurveys.slice(0, 4).map((s) => (
                    <div key={s.id} style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{s.customer_name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          <MapPin size={12} style={{ display: 'inline', marginRight: '0.2rem' }} />
                          {s.address}, {s.city}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#0369a1', marginTop: '0.2rem' }}>
                          {s.survey_number} · {s.roof_type} · {s.target_capacity_kw} kW
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: s.status === 'APPROVED' ? '#dcfce7' : s.status === 'SUBMITTED' ? '#dbeafe' : '#fef3c7',
                          color: s.status === 'APPROVED' ? '#166534' : s.status === 'SUBMITTED' ? '#1e40af' : '#92400e'
                        }}>
                          {s.status}
                        </span>

                        {s.status !== 'APPROVED' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => setSubmittingSurvey(s)}
                          >
                            <Send size={12} />
                            <span>Submit Data</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Installations Queue */}
          {hasInstallCapability && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wrench size={18} style={{ color: '#ea580c' }} />
                  <span>Assigned Installations</span>
                </h3>
                <Link to="/installations?tab=mine" style={{ fontSize: '0.8rem', color: '#ea580c', textDecoration: 'none', fontWeight: 600 }}>
                  View All →
                </Link>
              </div>

              {myInstallations.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No installations currently assigned.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {myInstallations.slice(0, 4).map((i) => (
                    <div key={i.id} style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{i.customer}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          <MapPin size={12} style={{ display: 'inline', marginRight: '0.2rem' }} />
                          {i.address}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#ea580c', marginTop: '0.2rem' }}>
                          {i.installation_number} · {i.capacity_kw} kW · Passport: {i.passport_number}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: i.status === 'COMMISSIONED' ? '#dcfce7' : '#ffedd5',
                          color: i.status === 'COMMISSIONED' ? '#166534' : '#9a3412'
                        }}>
                          {i.status}
                        </span>

                        {i.status !== 'COMMISSIONED' && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#ea580c', border: 'none' }}
                            onClick={() => handleOpenWorksheet(i)}
                          >
                            <FileCheck size={12} />
                            <span>Worksheet</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* TAB CONTENT: Surveys Detailed Table */}
      {activeTab === 'surveys' && hasSurveyCapability && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            My Assigned Site Surveys
          </h3>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Survey #</th>
                <th>Customer</th>
                <th>Location</th>
                <th>Target kW</th>
                <th>Scheduled Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mySurveys.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.survey_number}</td>
                  <td>{s.customer_name}</td>
                  <td>{s.city}</td>
                  <td>{s.target_capacity_kw} kW</td>
                  <td>{s.survey_date}</td>
                  <td>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: s.status === 'APPROVED' ? '#dcfce7' : '#fef3c7',
                      color: s.status === 'APPROVED' ? '#166534' : '#92400e'
                    }}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSubmittingSurvey(s)}
                    >
                      <Send size={12} />
                      <span>{s.status === 'SUBMITTED' ? 'Update Data' : 'Submit Survey'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: Installations Detailed Table */}
      {activeTab === 'installations' && hasInstallCapability && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            My Assigned Field Installations
          </h3>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Installation #</th>
                <th>Customer</th>
                <th>Capacity</th>
                <th>Scheduled Date</th>
                <th>Passport ID</th>
                <th>Status</th>
                <th>Worksheet</th>
              </tr>
            </thead>
            <tbody>
              {myInstallations.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600 }}>{i.installation_number}</td>
                  <td>{i.customer}</td>
                  <td>{i.capacity_kw} kW</td>
                  <td>{i.scheduled_date}</td>
                  <td>{i.passport_number}</td>
                  <td>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: i.status === 'COMMISSIONED' ? '#dcfce7' : '#ffedd5',
                      color: i.status === 'COMMISSIONED' ? '#166534' : '#9a3412'
                    }}>
                      {i.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ background: '#ea580c', border: 'none' }}
                      onClick={() => handleOpenWorksheet(i)}
                    >
                      <FileCheck size={12} />
                      <span>{i.status === 'COMMISSIONED' ? 'View Sheet' : 'Open Sheet'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Submit Survey Data */}
      {submittingSurvey && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '2rem', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Submit Site Survey Data: {submittingSurvey.survey_number}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Record verified physical measurements for customer {submittingSurvey.customer_name}.
            </p>

            <form onSubmit={handleSubmitSurvey} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Usable Roof Area (sq ft)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={surveyFormData.usable_roof_area_sqft}
                    onChange={(e) => setSurveyFormData({ ...surveyFormData, usable_roof_area_sqft: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Shadow-Free Area (sq ft)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={surveyFormData.shadow_free_area_sqft}
                    onChange={(e) => setSurveyFormData({ ...surveyFormData, shadow_free_area_sqft: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Roof Azimuth (°)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={surveyFormData.roof_azimuth_deg}
                    onChange={(e) => setSurveyFormData({ ...surveyFormData, roof_azimuth_deg: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tilt Angle (°)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={surveyFormData.tilt_angle_deg}
                    onChange={(e) => setSurveyFormData({ ...surveyFormData, tilt_angle_deg: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Observations & Remarks</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={surveyFormData.technician_observations}
                  onChange={(e) => setSurveyFormData({ ...surveyFormData, technician_observations: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSubmittingSurvey(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingSurvey}>
                  {isSubmittingSurvey ? 'Submitting...' : 'Submit to Survey Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Installation Worksheet & Commissioning */}
      {activeJob && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '2rem', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Digital Commissioning Worksheet: {activeJob.installation_number}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Mandatory 8-point physical verification and electrical testing for {activeJob.customer}.
            </p>

            <form onSubmit={handleSaveCommissioning} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* 8-point Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>8-Point Quality Protocol:</span>
                {[
                  { key: 'chk_structure_installed', label: '1. Mounting Structure Torqued & Weather-Sealed' },
                  { key: 'chk_panels_installed', label: '2. PV Modules Clamped & Azimuth Verified' },
                  { key: 'chk_inverter_installed', label: '3. Inverter Mounted with Airflow Clearances' },
                  { key: 'chk_electrical_completed', label: '4. DC Cabling, MC4 Crimping & AC Distribution' },
                  { key: 'chk_earthing_completed', label: '5. Dual Dedicated Chemical Earthing (< 5Ω)' },
                  { key: 'chk_safety_checks_completed', label: '6. AC/DC SPDs & Emergency Isolator Functional' },
                  { key: 'chk_system_tested', label: '7. System Tested & Grid Synchronized' },
                  { key: 'chk_customer_handover_completed', label: '8. Customer Briefing & Mobile App Handover' },
                ].map((item) => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={worksheet[item.key]}
                      onChange={(e) => setWorksheet({ ...worksheet, [item.key]: e.target.checked })}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Electrical Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>AC Voltage (V)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={worksheet.voltage_reading_volts}
                    onChange={(e) => setWorksheet({ ...worksheet, voltage_reading_volts: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>AC Current (A)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={worksheet.current_reading_amps}
                    onChange={(e) => setWorksheet({ ...worksheet, current_reading_amps: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Power Output (kW)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={worksheet.power_output_kw}
                    onChange={(e) => setWorksheet({ ...worksheet, power_output_kw: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              {/* Customer Signoff */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Customer Signoff Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={worksheet.customer_signed_by_name}
                    onChange={(e) => setWorksheet({ ...worksheet, customer_signed_by_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Rating (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    className="form-control"
                    value={worksheet.customer_feedback_rating}
                    onChange={(e) => setWorksheet({ ...worksheet, customer_feedback_rating: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveJob(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#ea580c', border: 'none' }} disabled={isSavingWorksheet}>
                  {isSavingWorksheet ? 'Commissioning...' : 'Finalize Commissioning & Activate Warranties'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

