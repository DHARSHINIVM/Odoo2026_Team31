import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import CameraCapture from '../components/CameraCapture';
import { FormField, Input, Select, Textarea } from '../components/FormControls';
import { ErrorState } from '../components/StateBoxes';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Wrench,
  CheckCircle,
  AlertTriangle,
  Upload,
  QrCode,
  FileText,
  Zap,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Calendar,
  CheckCircle2,
  Star,
  Check,
  Camera,
  Layers,
  ClipboardCheck,
} from 'lucide-react';

const MANDATORY_CHECKLIST_ITEMS = [
  { key: 'chk_structure_installed', label: '1. Mounting Structure Installed & Torqued', desc: 'Galvanized rails anchored with stainless steel hardware, roof penetration water-sealed.' },
  { key: 'chk_panels_installed', label: '2. Solar Panels Installed & Aligned', desc: 'All PV modules clamped, azimuth and tilt angles verified per engineering drawing.' },
  { key: 'chk_inverter_installed', label: '3. Inverter Installed & Mounted', desc: 'Wall/stand mounted with adequate airflow clearances and IP65 conduit entries.' },
  { key: 'chk_electrical_completed', label: '4. Electrical Connections Completed', desc: 'DC string cabling, MC4 crimping, and AC distribution wiring tested.' },
  { key: 'chk_earthing_completed', label: '5. Earthing Completed & Tested (< 5Ω)', desc: 'Dual dedicated chemical earthing pits connected with copper tape.' },
  { key: 'chk_safety_checks_completed', label: '6. Safety Checks Completed', desc: 'AC/DC SPDs functional, DC isolator operational, emergency shutoff labeled.' },
  { key: 'chk_system_tested', label: '7. System Tested & Grid Synchronized', desc: 'Voc and Isc measured under load, net meter bidirectional sync verified.' },
  { key: 'chk_customer_handover_completed', label: '8. Customer Handover & Briefing Completed', desc: 'Inverter mobile app paired, safety manual and warranty folder delivered.' },
];

const LIFECYCLE_STAGES = [
  'CONFIRMED',
  'READY_FOR_DISPATCH',
  'DISPATCHED',
  'SCHEDULED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'CUSTOMER_SIGNOFF',
  'COMPLETED'
];

export default function InstallationsPage({ refreshTrigger }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const activeTab = searchParams.get('tab') || 'all';
  const selectedOrderIdParam = searchParams.get('orderId');

  // State: Installations
  const [installations, setInstallations] = useState([]);
  const [loadingInstallations, setLoadingInstallations] = useState(false);
  const [selectedInstId, setSelectedInstId] = useState(null);
  const [selectedInstallation, setSelectedInstallation] = useState(null);

  // State: Linked Passport & Dispatched Components
  const [linkedPassport, setLinkedPassport] = useState(null);
  const [verifiedSerials, setVerifiedSerials] = useState({});

  // State: Uploading / Camera Capture
  const [isUploading, setIsUploading] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // State: Commissioning
  const [isCommissioning, setIsCommissioning] = useState(false);
  const [advancingStage, setAdvancingStage] = useState(false);

  // State: Customer Sign-off Form & Telemetry
  const [signoffData, setSignoffData] = useState({
    customer_signed_by_name: '',
    customer_remarks: 'Installation completed neatly and verified with grid sync.',
    customer_feedback_rating: 5,
    voltage_reading_volts: 230.0,
    current_reading_amps: 20.0,
    power_output_kw: 5.0,
    grid_frequency_hz: 50.0,
    earthing_resistance_ohms: 2.1,
  });

  // State: Feedback
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Admin Compact Operational Log State
  const [adminSearch, setAdminSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('ALL');
  const [adminTechFilter, setAdminTechFilter] = useState('ALL');
  const [adminSelectedInst, setAdminSelectedInst] = useState(null);

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

  // 1. Fetch Installations
  const loadInstallations = async () => {
    setLoadingInstallations(true);
    try {
      const data = await api.getInstallations();
      setInstallations(data);
      if (data.length > 0 && !selectedInstId) {
        if (selectedOrderIdParam) {
          const match = data.find((i) => i.order_id === parseInt(selectedOrderIdParam));
          if (match) {
            handleSelectInstallation(match.id);
            return;
          }
        }
        handleSelectInstallation(data[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingInstallations(false);
    }
  };

  // 2. Fetch Single Installation Details & Linked Passport
  const loadInstallationDetail = async (instId) => {
    try {
      const detail = await api.getInstallationById(instId);
      setSelectedInstallation(detail);

      setSignoffData((prev) => ({
        ...prev,
        customer_signed_by_name: detail.customer_signed_by_name || '',
        customer_remarks: detail.customer_remarks || prev.customer_remarks,
        customer_feedback_rating: detail.customer_feedback_rating || 5,
        voltage_reading_volts: detail.voltage_reading_volts || 230.0,
        current_reading_amps: detail.current_reading_amps || 20.0,
        power_output_kw: detail.power_output_kw || 5.0,
        grid_frequency_hz: detail.grid_frequency_hz || 50.0,
        earthing_resistance_ohms: detail.earthing_resistance_ohms || 2.1,
      }));

      // Fetch linked passport if order exists
      if (detail.order_id) {
        try {
          const passportData = await api.getOrderPassport(detail.order_id);
          setLinkedPassport(passportData);
        } catch (e) {
          setLinkedPassport(null);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectInstallation = (instId) => {
    setSelectedInstId(instId);
    loadInstallationDetail(instId);
  };

  useEffect(() => {
    loadInstallations();
  }, [refreshTrigger]);

  // Handler: Toggle Checklist Item
  const handleChecklistToggle = async (key, currentValue) => {
    if (!selectedInstId) return;
    try {
      const payload = { [key]: !currentValue };
      const updated = await api.updateInstallationChecklist(selectedInstId, payload);
      setSelectedInstallation(updated);
      setInstallations((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // Handler: Technical Telemetry Update
  const handleTechnicalUpdate = async (field, value) => {
    setSignoffData((prev) => ({ ...prev, [field]: value }));
    if (!selectedInstId) return;
    try {
      const payload = { [field]: value };
      const updated = await api.updateInstallationChecklist(selectedInstId, payload);
      setSelectedInstallation(updated);
    } catch (err) {
      console.warn('Technical telemetry save error', err.message);
    }
  };

  // Handler: Advance Stage
  const handleAdvanceStage = async (nextStageName) => {
    if (!selectedInstId) return;
    setAdvancingStage(true);
    setError(null);
    try {
      const updated = await api.updateInstallationStage(selectedInstId, {
        stage: nextStageName,
        notes: `Advanced to ${nextStageName} by ${user?.full_name || 'Lead Technician'}`,
      });
      setSelectedInstallation(updated);
      setInstallations((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
      setActionSuccess(`Installation stage advanced to ${nextStageName}.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdvancingStage(false);
    }
  };

  // Handler: Camera Evidence Capture (Direct Camera Integration)
  const handleCameraEvidenceCapture = async ({ file, category, gps, captureTime }) => {
    if (!selectedInstId || !file) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category || 'PANEL_INSTALLATION');
      formData.append('description', `Verified ${category.replace(/_/g, ' ')} on site`);
      if (gps) {
        formData.append('latitude', gps.lat);
        formData.append('longitude', gps.lng);
      }
      if (captureTime) {
        formData.append('capture_time', captureTime);
      }

      const res = await api.uploadInstallationEvidence(selectedInstId, formData);
      setActionSuccess(`Evidence photograph saved: ${category.replace(/_/g, ' ')}`);
      await loadInstallationDetail(selectedInstId);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Handler: Commission & Activate Warranties
  const handleCommission = async () => {
    if (!selectedInstId) return;
    setIsCommissioning(true);
    setError(null);
    try {
      const res = await api.commissionInstallation(selectedInstId, signoffData);
      setActionSuccess(res.message);
      await loadInstallationDetail(selectedInstId);
      await loadInstallations();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCommissioning(false);
    }
  };

  // Check how many mandatory items are completed
  const completedChecksCount = selectedInstallation
    ? MANDATORY_CHECKLIST_ITEMS.filter((item) => selectedInstallation[item.key]).length
    : 0;
  const isAllMandatoryCompleted = completedChecksCount === 8;

  // Filter installations based on tab
  const filteredInstallations = installations.filter((inst) => {
    if (activeTab === 'mine') {
      if (user) {
        return (
          inst.assigned_tech_id === user.id ||
          (inst.team_technician_ids && inst.team_technician_ids.includes(user.id)) ||
          inst.assigned_technician?.toLowerCase().includes(user.name?.toLowerCase() || '') ||
          inst.assigned_technician?.toLowerCase().includes(user.full_name?.toLowerCase() || '')
        );
      }
      return true;
    }
    if (activeTab === 'schedule') {
      return inst.status === 'SCHEDULED' || inst.status === 'IN_PROGRESS';
    }
    if (activeTab === 'completed') {
      return inst.status === 'COMMISSIONED' || inst.status === 'COMPLETED';
    }
    return true;
  });

  const currentStageIndex = selectedInstallation
    ? LIFECYCLE_STAGES.indexOf(selectedInstallation.status)
    : -1;

  const nextStage = currentStageIndex >= 0 && currentStageIndex < LIFECYCLE_STAGES.length - 1
    ? LIFECYCLE_STAGES[currentStageIndex + 1]
    : null;

  // Administrator View: Compact Operational Activity & Milestone Logs
  if (user?.role === 'ADMIN') {
    const filteredInstallations = installations.filter((inst) => {
      if (adminStatusFilter !== 'ALL' && inst.status !== adminStatusFilter) return false;
      if (adminTechFilter !== 'ALL' && inst.assigned_technician !== adminTechFilter) return false;
      if (adminSearch.trim()) {
        const query = adminSearch.toLowerCase();
        const instIdStr = (inst.id || '').toString();
        const orderStr = (inst.order_number || inst.order_id || '').toString().toLowerCase();
        const custStr = (inst.customer_name || '').toLowerCase();
        const techStr = (inst.assigned_technician || '').toLowerCase();
        if (!instIdStr.includes(query) && !orderStr.includes(query) && !custStr.includes(query) && !techStr.includes(query)) {
          return false;
        }
      }
      return true;
    });

    const uniqueTechnicians = Array.from(new Set(installations.map((i) => i.assigned_technician).filter(Boolean)));
    const totalInst = installations.length;
    const inProgressCount = installations.filter((i) => ['IN_PROGRESS', 'SCHEDULED', 'QUALITY_CHECK'].includes(i.status)).length;
    const commissionedCount = installations.filter((i) => ['COMMISSIONED', 'COMPLETED'].includes(i.status)).length;

    return (
      <div className="page-container">
        <PageHeader
          title="Installation Operational & Milestone Activity Logs"
          subtitle="Central operational log and chronological milestone tracking of technician field installations and digital commissioning."
        />

        {/* Executive Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>TOTAL INSTALLATION PROJECTS</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{totalInst}</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>All historical & active sites</div>
          </div>
          <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#d97706' }}>ACTIVE & IN-PROGRESS</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#b45309', marginTop: '0.2rem' }}>{inProgressCount}</div>
            <div style={{ fontSize: '0.7rem', color: '#d97706', marginTop: '0.2rem' }}>Mounting, wiring & sync</div>
          </div>
          <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#059669' }}>COMMISSIONED & HANDED OVER</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#047857', marginTop: '0.2rem' }}>{commissionedCount}</div>
            <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem' }}>Solar passports generated</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '320px' }}>
            <input
              type="text"
              placeholder="Search by Customer, Project ID, or Installation #..."
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: '240px',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
              }}
            />
            <select
              value={adminStatusFilter}
              onChange={(e) => setAdminStatusFilter(e.target.value)}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="QUALITY_CHECK">Quality Check</option>
              <option value="CUSTOMER_SIGNOFF">Customer Sign-off</option>
              <option value="COMMISSIONED">Commissioned</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <select
              value={adminTechFilter}
              onChange={(e) => setAdminTechFilter(e.target.value)}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
            >
              <option value="ALL">All Technicians</option>
              {uniqueTechnicians.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadInstallations}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={13} />
            <span>Refresh Logs</span>
          </button>
        </div>

        {/* Compact Operational Log Table */}
        <div className="card" style={{ padding: '1.25rem' }}>
          {loadingInstallations ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading operational logs...</div>
          ) : filteredInstallations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No operational records match filter criteria.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Installation ID</th>
                    <th>Project ID</th>
                    <th>Customer Name</th>
                    <th>Assigned Technician</th>
                    <th>Installation Date</th>
                    <th>Status</th>
                    <th>Last Activity</th>
                    <th>Activity Description</th>
                    <th>Handover Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstallations.map((inst) => {
                    const isCommissioned = inst.status === 'COMMISSIONED' || inst.status === 'COMPLETED';
                    return (
                      <tr key={inst.id}>
                        <td>
                          <strong>#INST-{inst.id}</strong>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#2563eb' }}>
                            {inst.order_number || `#ORD-${inst.order_id}`}
                          </span>
                        </td>
                        <td>
                          <div>
                            <strong>{inst.customer_name || 'N/A'}</strong>
                            {inst.customer_city && (
                              <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{inst.customer_city}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <UserCheck size={14} style={{ color: '#475569' }} />
                            <span>{inst.assigned_technician || inst.lead_engineer || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td>
                          {inst.scheduled_start_date ? new Date(inst.scheduled_start_date).toLocaleDateString() : 'Unscheduled'}
                        </td>
                        <td>
                          <StatusBadge status={inst.status} />
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                          {inst.completion_date
                            ? new Date(inst.completion_date).toLocaleString()
                            : inst.scheduled_start_date
                            ? new Date(inst.scheduled_start_date).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#475569' }}>
                          {inst.notes || inst.team_notes || `Status: ${inst.status.replace('_', ' ')}`}
                        </td>
                        <td>
                          <span className={`badge ${isCommissioned ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                            {isCommissioned ? 'Commissioned' : 'Pending Handover'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => setAdminSelectedInst(inst)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Read-Only Inspection Modal for Administrator */}
        {adminSelectedInst && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>OPERATIONAL LOG RECORD</span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.2rem 0', color: '#0f172a' }}>
                    Installation #{adminSelectedInst.id} · {adminSelectedInst.order_number || `#ORD-${adminSelectedInst.order_id}`}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <StatusBadge status={adminSelectedInst.status} />
                    <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                      Lead: {adminSelectedInst.assigned_technician || 'Unassigned'}
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAdminSelectedInst(null)}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Customer & Location</span>
                  <strong>{adminSelectedInst.customer_name || 'N/A'}</strong>
                  <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: '0.25rem' }}>{adminSelectedInst.installation_address || 'Address on file'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Commissioning Status</span>
                  <strong style={{ color: adminSelectedInst.all_mandatory_checks_passed ? '#059669' : '#d97706' }}>
                    {adminSelectedInst.all_mandatory_checks_passed ? 'All Mandatory Tests Passed' : 'Verification Incomplete'}
                  </strong>
                  <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Peak Power: {adminSelectedInst.peak_power_tested_kw || adminSelectedInst.power_output_kw || '0.0'} kW
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>
                  Checklist Completion Summary
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.78rem' }}>
                  {MANDATORY_CHECKLIST_ITEMS.map((item) => {
                    const passed = adminSelectedInst[item.key];
                    return (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.5rem', background: passed ? '#f0fdf4' : '#f8fafc', borderRadius: '4px' }}>
                        {passed ? <CheckCircle size={14} color="#059669" /> : <Clock size={14} color="#94a3b8" />}
                        <span style={{ color: passed ? '#065f46' : '#64748b', fontWeight: passed ? 600 : 400 }}>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {adminSelectedInst.notes && (
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', fontSize: '0.8rem', color: '#334155' }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#0f172a' }}>Operational Notes:</strong>
                  {adminSelectedInst.notes}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Field Installation & Digital Commissioning"
        subtitle="Stage B: Dispatched component verification, camera photographic evidence capture, electrical measurements, and warranty activation."
        action={
          selectedInstallation?.status === 'COMMISSIONED' || selectedInstallation?.status === 'COMPLETED' ? (
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/solar-passport?orderId=${selectedInstallation.order_id}`)}
            >
              <QrCode size={16} /> Open Digital Solar Passport
            </button>
          ) : null
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => handleTabChange('all')}
        >
          All Installations ({installations.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'mine' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => handleTabChange('mine')}
        >
          <UserCheck size={14} /> My Assigned Installations
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'schedule' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => handleTabChange('schedule')}
        >
          <Calendar size={14} /> Scheduled & In Progress
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => handleTabChange('completed')}
        >
          <CheckCircle2 size={14} /> Completed & Commissioned
        </button>
      </div>

      {/* Action Banners */}
      {actionSuccess && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem', background: '#ecfdf5', border: '1.5px solid var(--solar-green-400)', borderRadius: '8px', color: 'var(--navy-900)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} color="var(--solar-green-600)" />
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

      {/* Installation Selector Chips */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
        {filteredInstallations.map((inst) => (
          <div
            key={inst.id}
            onClick={() => handleSelectInstallation(inst.id)}
            style={{
              padding: '0.6rem 0.85rem',
              borderRadius: '8px',
              cursor: 'pointer',
              border: selectedInstId === inst.id ? '2px solid var(--solar-green-500)' : '1px solid #e2e8f0',
              background: selectedInstId === inst.id ? '#ffffff' : '#f8fafc',
              minWidth: '220px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--navy-900)' }}>{inst.installation_number}</strong>
              <StatusBadge status={inst.status} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {inst.customer_name} · {inst.customer_city}
            </div>
          </div>
        ))}
      </div>

      {selectedInstallation ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header Card with Passport Link & Provenance */}
          <div className="card" style={{ padding: '1.25rem', background: '#ffffff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Installation Reference
                </span>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--navy-900)' }}>
                  {selectedInstallation.installation_number}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Order: <strong>{selectedInstallation.order_number}</strong>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Linked Digital Solar Passport
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
                  {selectedInstallation.passport_number || linkedPassport?.passport_number || 'Initialized at Warehouse'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Status: <strong>{linkedPassport?.lifecycle_status || selectedInstallation.status}</strong>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Client & Site
                </span>
                <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>
                  {selectedInstallation.customer_name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {selectedInstallation.installation_address}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Assigned Lead Engineer
                </span>
                <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>
                  {selectedInstallation.assigned_technician}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Crew Size: {selectedInstallation.team_size} Field Engineers
                </div>
              </div>
            </div>
          </div>

          {/* Dispatched Components Physical Verification Ledger */}
          {linkedPassport && linkedPassport.serialized_components && (
            <div className="card" style={{ padding: '1.25rem', background: '#f8fafc', border: '1.5px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--navy-900)', margin: 0 }}>
                    Warehouse Dispatched Components Verification ({linkedPassport.serialized_components.length})
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                    Verify physical serial numbers delivered on site against the warehouse dispatch record:
                  </p>
                </div>
                <span className="badge badge-success">
                  {Object.values(verifiedSerials).filter(Boolean).length} of {linkedPassport.serialized_components.length} Verified
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem' }}>
                {linkedPassport.serialized_components.map((comp, idx) => {
                  const isChecked = Boolean(verifiedSerials[comp.serial_number]);
                  return (
                    <div
                      key={idx}
                      onClick={() => setVerifiedSerials((prev) => ({ ...prev, [comp.serial_number]: !isChecked }))}
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        background: isChecked ? '#f0fdf4' : '#ffffff',
                        border: `1.5px solid ${isChecked ? 'var(--solar-green-500)' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--navy-900)', fontFamily: 'monospace' }}>
                          {comp.serial_number}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {comp.component_name} ({comp.category}) · {comp.manufacturer}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Grid: Checklist & Measurements (Left) and Camera Evidence & Commissioning (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.25rem', alignItems: 'start' }}>
            
            {/* Left: 8-Point Commissioning Checklist */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                    Mandatory 8-Point Quality Checklist
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Mandatory engineering prerequisites: all 8 milestones must be verified to commission the solar asset.
                  </p>
                </div>
                <div
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    background: isAllMandatoryCompleted ? '#ecfdf5' : '#fffbeb',
                    color: isAllMandatoryCompleted ? 'var(--solar-green-600)' : 'var(--amber-600)',
                    border: `1px solid ${isAllMandatoryCompleted ? 'var(--solar-green-400)' : 'var(--amber-500)'}`,
                  }}
                >
                  {completedChecksCount} of 8 Completed
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {MANDATORY_CHECKLIST_ITEMS.map((item) => {
                  const isChecked = Boolean(selectedInstallation[item.key]);
                  return (
                    <div
                      key={item.key}
                      onClick={() => handleChecklistToggle(item.key, isChecked)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: `1.5px solid ${isChecked ? 'var(--solar-green-400)' : 'var(--border-subtle)'}`,
                        background: isChecked ? '#f0fdf4' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.65rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ marginTop: '0.2rem', cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: isChecked ? 'var(--navy-900)' : 'var(--navy-800)', fontSize: '0.88rem' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {item.desc}
                        </div>
                      </div>
                      {isChecked && (
                        <CheckCircle size={18} color="var(--solar-green-600)" style={{ flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Customer Acknowledgement Section */}
              <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Star size={16} color="var(--amber-500)" /> Customer Handover Acknowledgement
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                      Customer Signee Name
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={signoffData.customer_signed_by_name}
                      onChange={(e) => setSignoffData((p) => ({ ...p, customer_signed_by_name: e.target.value }))}
                      placeholder="e.g. Ramesh Patil"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                      Customer Rating (1-5)
                    </label>
                    <select
                      className="input"
                      value={signoffData.customer_feedback_rating}
                      onChange={(e) => setSignoffData((p) => ({ ...p, customer_feedback_rating: parseInt(e.target.value) }))}
                    >
                      <option value="5">★★★★★ (5/5 Excellent)</option>
                      <option value="4">★★★★☆ (4/5 Very Good)</option>
                      <option value="3">★★★☆☆ (3/5 Satisfactory)</option>
                      <option value="2">★★☆☆☆ (2/5 Needs Improvement)</option>
                      <option value="1">★☆☆☆☆ (1/5 Poor)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Customer Handover Remarks
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={signoffData.customer_remarks}
                    onChange={(e) => setSignoffData((p) => ({ ...p, customer_remarks: e.target.value }))}
                  />
                </div>
              </div>

              {/* Commission Action Bar */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '1rem',
                  borderRadius: '8px',
                  background: isAllMandatoryCompleted ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : '#f8fafc',
                  border: isAllMandatoryCompleted ? 'none' : '1px solid var(--border-strong)',
                  color: isAllMandatoryCompleted ? '#ffffff' : 'var(--navy-900)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                    {isAllMandatoryCompleted
                      ? '✓ All 8 Engineering Milestones Passed'
                      : `⚠️ ${8 - completedChecksCount} Mandatory Checks Incomplete`}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                    {isAllMandatoryCompleted
                      ? 'System is ready for grid sync. Commissioning will advance Digital Passport to ACTIVE and trigger warranties.'
                      : 'Commissioning is blocked until all mandatory physical installation milestones are verified.'}
                  </div>
                </div>

                {selectedInstallation.status === 'COMMISSIONED' || selectedInstallation.status === 'COMPLETED' ? (
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/solar-passport?orderId=${selectedInstallation.order_id}`)}
                  >
                    <QrCode size={14} /> View Passport
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{
                      background: isAllMandatoryCompleted ? '#ffffff' : undefined,
                      color: isAllMandatoryCompleted ? 'var(--solar-green-600)' : undefined,
                      fontWeight: 800,
                    }}
                    onClick={handleCommission}
                    disabled={!isAllMandatoryCompleted || isCommissioning}
                  >
                    <Sparkles size={16} />
                    <span>{isCommissioning ? 'Activating Warranties...' : 'Commission & Activate Warranties'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right: Technical Measurements & Live Camera Photo Evidence */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Telemetry Measurements Card */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--navy-900)' }}>
                  Electrical Measurements & Telemetry
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <FormField label="AC Voltage (V)">
                      <Input
                        type="number"
                        step="0.5"
                        value={signoffData.voltage_reading_volts}
                        onChange={(e) => handleTechnicalUpdate('voltage_reading_volts', parseFloat(e.target.value))}
                      />
                    </FormField>
                    <FormField label="AC Current (A)">
                      <Input
                        type="number"
                        step="0.1"
                        value={signoffData.current_reading_amps}
                        onChange={(e) => handleTechnicalUpdate('current_reading_amps', parseFloat(e.target.value))}
                      />
                    </FormField>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <FormField label="Power Output (kW)">
                      <Input
                        type="number"
                        step="0.1"
                        value={signoffData.power_output_kw}
                        onChange={(e) => handleTechnicalUpdate('power_output_kw', parseFloat(e.target.value))}
                      />
                    </FormField>
                    <FormField label="Grid Frequency (Hz)">
                      <Input
                        type="number"
                        step="0.01"
                        value={signoffData.grid_frequency_hz}
                        onChange={(e) => handleTechnicalUpdate('grid_frequency_hz', parseFloat(e.target.value))}
                      />
                    </FormField>
                  </div>

                  <FormField label="Earthing Pit Resistance (< 5.0Ω)">
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Input
                        type="number"
                        step="0.1"
                        value={signoffData.earthing_resistance_ohms}
                        onChange={(e) => handleTechnicalUpdate('earthing_resistance_ohms', parseFloat(e.target.value))}
                      />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: signoffData.earthing_resistance_ohms < 5.0 ? 'var(--solar-green-600)' : 'var(--red-600)' }}>
                        {signoffData.earthing_resistance_ohms < 5.0 ? 'PASS (< 5Ω)' : 'FAIL (High)'}
                      </span>
                    </div>
                  </FormField>
                </div>
              </div>

              {/* Live Camera Photo Evidence Capture */}
              <div className="card" style={{ padding: '1.25rem', background: '#0b1329', border: '1.5px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Live Camera Evidence Capture
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                      Capture photographs of panels, structure, inverters, earthing, and net-metering.
                    </p>
                  </div>
                </div>

                <CameraCapture
                  mode="photo"
                  title="Field Installation Evidence Camera"
                  onCapture={handleCameraEvidenceCapture}
                />
              </div>

              {/* Uploaded Evidence Gallery */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--navy-900)', margin: 0 }}>
                    Attached Site Photographs ({selectedInstallation.evidence_files?.length || 0})
                  </h4>
                  <span className="badge badge-info">
                    {selectedInstallation.evidence_files?.length || 0} Photos Stored
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {selectedInstallation.evidence_files && selectedInstallation.evidence_files.length > 0 ? (
                    selectedInstallation.evidence_files.map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.5rem',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--navy-900)' }}>
                            <span className="badge badge-info" style={{ fontSize: '0.68rem', marginRight: '0.35rem' }}>
                              {file.category || 'PHOTO'}
                            </span>
                            {file.description || file.original_name}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {file.uploaded_at} {file.latitude ? `· GPS: ${file.latitude.toFixed(3)}°N, ${file.longitude.toFixed(3)}°E` : ''}
                          </div>
                        </div>
                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                          STORED
                        </span>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      No photographic evidence captured yet. Use the camera above to capture site photos.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Wrench size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
          <h3>No Installation Selected</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Deliver a dispatch to schedule on-site installation and begin commissioning.
          </p>
        </div>
      )}
    </div>
  );
}
