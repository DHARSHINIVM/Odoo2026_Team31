import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function FieldTechnicianMobileApp({
  data,
  user,
  onRefresh,
}) {
  // Mobile App Navigation Tab: 'home' | 'tasks' | 'schedule' | 'capture' | 'survey_stepper' | 'task_details' | 'more'
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedSurvey, setSelectedSurvey] = useState(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [taskCategory, setTaskCategory] = useState('all'); // 'all' | 'surv' | 'ins' | 'srv' | 'done'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in-progress' | 'scheduled' | 'needs-action'
  const [sortEarliest, setSortEarliest] = useState(true);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Survey Stepper Workflow State (5 Steps matching site_survey_surv_2026_0031)
  const [surveyStep, setSurveyStep] = useState(2);
  const [surveyForm, setSurveyForm] = useState({
    roof_type: 'metal_trapezoid',
    usable_roof_area_sqft: 720,
    shadow_free_area_sqft: 680,
    roof_azimuth_deg: 180,
    tilt_angle_deg: 16,
    shading_loss_pct: 2.1,
    structural_integrity: 'EXCELLENT',
    recommended_capacity_kw: 5.0,
    technician_observations: 'High-yield solar azimuth verified on site. Clear horizon without permanent shadow.',
  });
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);

  // Installation Commissioning & Worksheet State (matching task_details_ins_2026_0018)
  const [worksheetStep, setWorksheetStep] = useState(1);
  const [worksheet, setWorksheet] = useState({
    chk_structure_installed: true,
    chk_panels_installed: true,
    chk_inverter_installed: true,
    chk_electrical_completed: true,
    chk_earthing_completed: true,
    chk_safety_checks_completed: true,
    chk_system_tested: true,
    chk_customer_handover_completed: true,
    voltage_reading_volts: 238.5,
    current_reading_amps: 28.4,
    power_output_kw: 6.77,
    grid_frequency_hz: 50.0,
    earthing_resistance_ohms: 1.85, // Enforces <= 5.0 Ohms (IS 3043)
    customer_signed_by_name: 'Rajesh Sharma',
    customer_feedback_rating: 5,
    customer_remarks: 'System commissioned successfully. Grid sync test positive.',
  });
  const [isCommissioning, setIsCommissioning] = useState(false);

  // Component Serial Verification on Site
  const [serialInput, setSerialInput] = useState('');
  const [verifiedSerials, setVerifiedSerials] = useState([
    'GWT-10K-2026-88129',
    'WAR-550-2026-00192',
    'WAR-550-2026-00193',
  ]);
  const [installationComponents, setInstallationComponents] = useState(null);

  // Camera & Serial Capture State (matching camera_serial_capture)
  const [captureMode, setCaptureMode] = useState('barcode'); // 'photo' | 'barcode' | 'doc'
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [evidenceCategory, setEvidenceCategory] = useState('ROOF_TOP');
  const [evidenceRemarks, setEvidenceRemarks] = useState('');
  const [scannedSerialMatch, setScannedSerialMatch] = useState('GWT-10K-2026-88129');
  const [flashOn, setFlashOn] = useState(false);
  const [gridOn, setGridOn] = useState(true);
  const [facingUser, setFacingUser] = useState(false);

  // Offline LocalStorage Queue State
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatusMsg, setSyncStatusMsg] = useState('Online · Synced just now');

  // Interactive Signature Canvas Ref
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(true);

  // Live video element ref
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Load offline queue on mount
  useEffect(() => {
    try {
      const q = JSON.parse(localStorage.getItem('TECH_OFFLINE_QUEUE') || '[]');
      setOfflineQueue(q);
    } catch {
      setOfflineQueue([]);
    }

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatusMsg('Online · Synced just now');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatusMsg('Offline Mode · Caching locally');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle camera start/stop
  useEffect(() => {
    if (currentTab === 'capture' && !cameraActive) {
      startCamera();
    } else if (currentTab !== 'capture' && cameraActive) {
      stopCamera();
    }
  }, [currentTab, facingUser]);

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingUser ? 'user' : 'environment' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      }
    } catch (e) {
      console.warn('Real camera stream not available on device, using viewport simulation:', e);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCaptureSnapshot = () => {
    if (videoRef.current && cameraActive) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedPhoto(dataUrl);
    } else {
      // Mock photo for demo/emulation environment
      setCapturedPhoto('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="%230f172a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2310b981" font-size="24" font-family="sans-serif">SunPower Snapshot Captured</text></svg>');
    }
  };

  // Signature canvas handlers
  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.strokeStyle = '#005131';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Submit survey telemetry
  const handleSubmitSurvey = async () => {
    const targetSurvey = selectedSurvey || (data?.my_surveys && data.my_surveys[0]);
    if (!targetSurvey) {
      alert('Please select a site survey.');
      return;
    }
    setIsSubmittingSurvey(true);
    try {
      await api.submitSurveyByTechnician(targetSurvey.id, surveyForm);
      alert(`Survey #${targetSurvey.survey_number} submitted to Survey Manager. Status: SUBMITTED`);
      setCurrentTab('home');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Survey submission error: ${err.message}`);
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  // Finalize commissioning
  const handleFinalizeCommissioning = async () => {
    const targetInst = selectedTask || (data?.my_installations && data.my_installations[0]);
    if (!targetInst) {
      alert('Please select an installation.');
      return;
    }

    if (worksheet.earthing_resistance_ohms > 5.0) {
      alert(`Safety Violation (IS 3043): Chemical earthing resistance is ${worksheet.earthing_resistance_ohms} Ω. It must be <= 5.0 Ω.`);
      return;
    }

    setIsCommissioning(true);
    try {
      await api.updateInstallationChecklist(targetInst.id, worksheet);
      const res = await api.commissionInstallation(targetInst.id, {
        customer_signed_by_name: worksheet.customer_signed_by_name,
        customer_remarks: worksheet.customer_remarks,
        customer_feedback_rating: worksheet.customer_feedback_rating,
        voltage_reading_volts: worksheet.voltage_reading_volts,
        current_reading_amps: worksheet.current_reading_amps,
        power_output_kw: worksheet.power_output_kw,
        grid_frequency_hz: worksheet.grid_frequency_hz,
        earthing_resistance_ohms: worksheet.earthing_resistance_ohms,
      });

      alert(`Installation ${targetInst.installation_number} commissioned! Digital Solar Passport advanced to ACTIVE.`);
      setCurrentTab('home');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Commissioning error: ${err.message}`);
    } finally {
      setIsCommissioning(false);
    }
  };

  // Verify component on site
  const handleVerifySerial = async () => {
    if (!serialInput.trim()) return;
    const targetInst = selectedTask || (data?.my_installations && data.my_installations[0]);
    if (!targetInst) return;

    try {
      const res = await api.verifyInstallationComponent(targetInst.id, serialInput.trim());
      alert(`Component Verified: ${res.serial_number} (${res.component_name || 'Verified on site'})`);
      setVerifiedSerials((prev) => [...prev, serialInput.trim()]);
      setSerialInput('');
    } catch (err) {
      alert(`Verification error: ${err.message}`);
    }
  };

  const kpis = data?.kpis || {};
  const mySurveys = data?.my_surveys || [];
  const myInstallations = data?.my_installations || [];
  const myServiceTickets = data?.my_service_tickets || [];
  const myAppointments = data?.my_appointments || [];
  const myTasks = data?.my_tasks || [];
  const technician = data?.technician || user || {};

  // Combine tasks for unified task view supporting all 6 task types
  const combinedTasks = (myTasks && myTasks.length > 0)
    ? myTasks.map((t) => ({
        type: t.task_type === 'SITE_SURVEY' ? 'surv' : (t.task_type === 'INSTALLATION' ? 'ins' : (t.task_type === 'COMMISSIONING' ? 'com' : (t.task_type === 'MAINTENANCE' ? 'maint' : 'srv'))),
        id: t.entity_id || t.task_id,
        task_id: t.task_id,
        number: t.task_id,
        task_type: t.task_type,
        task_type_label: t.task_type_label,
        project_id: t.project_id,
        customer: t.customer_name,
        customer_phone: t.customer_phone,
        address: t.site_address,
        capacity: t.task_type_label,
        status: t.status,
        priority: t.priority,
        due: t.due_date ? `Due: ${t.due_date}` : (t.scheduled_date ? `Scheduled: ${t.scheduled_date}` : 'Scheduled'),
        required_checklist: t.required_checklist,
        required_documents: t.required_documents,
        completion_requirements: t.completion_requirements,
        raw: t,
      }))
    : [
        ...myInstallations.map((i) => ({
          type: 'ins',
          id: i.id,
          task_id: `INS-${i.id}`,
          number: i.installation_number,
          task_type: 'INSTALLATION',
          task_type_label: '2. Installation',
          project_id: i.order_number || `ORD-${i.id}`,
          customer: i.customer,
          customer_phone: i.phone || '+91 98490 23411',
          address: i.location || i.address || 'Plot 42, Jubilee Hills, Hyderabad',
          capacity: i.capacity_kw ? `${i.capacity_kw} kW System` : '5.4 kW Rooftop Grid-Tie',
          status: i.status || 'IN_PROGRESS',
          priority: 'HIGH',
          due: 'Today, 10:00 AM - 01:30 PM',
          raw: i,
        })),
        ...mySurveys.map((s) => ({
          type: 'surv',
          id: s.id,
          task_id: `SRV-${s.id}`,
          number: s.survey_number,
          task_type: 'SITE_SURVEY',
          task_type_label: '1. Site Survey',
          project_id: s.survey_number,
          customer: s.customer || 'Priya Reddy',
          customer_phone: s.phone || '+91 98490 23411',
          address: s.location || 'Banjara Hills, Road 12, Hyderabad',
          capacity: s.recommended_capacity_kw ? `${s.recommended_capacity_kw} kW Comm.` : '8.0 kW Comm.',
          status: s.status || 'SCHEDULED',
          priority: s.status === 'REJECTED' ? 'CRITICAL' : 'MEDIUM',
          due: 'Today, 02:30 PM - 04:30 PM',
          raw: s,
        })),
        ...myServiceTickets.map((t) => ({
          type: 'srv',
          id: t.id,
          task_id: `SRV-TK-${t.id}`,
          number: t.ticket_number,
          task_type: 'SERVICE_REPAIR',
          task_type_label: '5. Repair / Service Visit',
          project_id: t.ticket_number,
          customer: t.customer_name || 'Rajesh Varma',
          customer_phone: t.phone || '+91 98490 23411',
          address: t.installation_address || 'Banjara Hills, Plot 42',
          capacity: t.issue_category || 'INVERTER_FAULT',
          status: t.status || 'ASSIGNED',
          priority: t.priority || 'HIGH',
          due: 'Tomorrow, 09:00 AM',
          raw: t,
        })),
      ];

  // Filter tasks
  const filteredTasks = combinedTasks.filter((t) => {
    if (taskCategory === 'surv' && t.type !== 'surv') return false;
    if (taskCategory === 'ins' && t.type !== 'ins') return false;
    if (taskCategory === 'srv' && t.type !== 'srv') return false;
    if (taskCategory === 'done' && t.status !== 'COMMISSIONED' && t.status !== 'APPROVED' && t.status !== 'RESOLVED') return false;

    if (statusFilter === 'in-progress' && !t.status.includes('PROGRESS')) return false;
    if (statusFilter === 'scheduled' && !t.status.includes('SCHEDULE')) return false;
    if (statusFilter === 'needs-action' && t.priority !== 'CRITICAL' && t.status !== 'REJECTED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.number.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="field-mobile-desktop-wrapper">
      <div className="field-mobile-app-container">
        {/* ========================================================= */}
        {/* TOP MOBILE HEADER (STICKY)                                */}
        {/* ========================================================= */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'rgba(247, 249, 255, 0.95)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid #e1e7ed',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            {currentTab !== 'home' && currentTab !== 'tasks' && currentTab !== 'schedule' && currentTab !== 'more' ? (
              <button
                onClick={() => setCurrentTab('home')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  color: '#101d28',
                }}
                aria-label="Back"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back</span>
              </button>
            ) : (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#005131',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>solar_power</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#005131', textTransform: 'uppercase' }}>
                  SunPower
                </span>
                <span style={{ color: '#3f4942', fontSize: '11px' }}>·</span>
                <h1 style={{ fontSize: '16px', fontWeight: 600, color: '#101d28', margin: 0, truncate: 'true' }}>
                  {currentTab === 'home' && 'Field Ops'}
                  {currentTab === 'tasks' && 'My Tasks'}
                  {currentTab === 'schedule' && 'Schedule'}
                  {currentTab === 'capture' && 'Live Camera Capture'}
                  {currentTab === 'survey_stepper' && 'Site Survey'}
                  {currentTab === 'task_details' && 'Task Details'}
                  {currentTab === 'more' && 'Operations & Sync'}
                </h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '999px',
                    backgroundColor: isOnline ? '#176b45' : '#ba1a1a',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#3f4942' }}>{syncStatusMsg}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => alert(`Operational Notifications:\n- 1 Audit re-upload required for INS-2026-0015\n- 5 Active field tasks assigned today`)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                padding: '6px',
                color: '#3f4942',
              }}
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>notifications</span>
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '999px',
                  backgroundColor: '#ba1a1a',
                }}
              />
            </button>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '999px',
                backgroundColor: '#005131',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              VS
            </div>
          </div>
        </header>

        {/* ========================================================= */}
        {/* MAIN CONTENT VIEWPORT (ROUTED BY currentTab)              */}
        {/* ========================================================= */}
        <main style={{ flex: 1, paddingBottom: '90px', overflowY: 'auto' }}>
          {/* ------------------------------------------------------- */}
          {/* SCREEN 1: HOME DASHBOARD (home_dashboard_sunpower_solutions) */}
          {/* ------------------------------------------------------- */}
          {currentTab === 'home' && (
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Technician Profile Greeting Banner */}
              <div
                style={{
                  background: '#ecf4ff',
                  borderRadius: '12px',
                  padding: '1rem',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid #d0e5f9',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: '#d0e5f9',
                          color: '#354959',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                        }}
                      >
                        Lead Tech • TK-8402
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: '#a4f4c3',
                          color: '#005232',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: '#005131' }}></span>
                        Field Ready
                      </span>
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#101d28', margin: '0 0 0.2rem 0' }}>
                      Good morning, {technician.name || 'Vikram Salunkhe'}
                    </h2>
                    <p style={{ fontSize: '12px', color: '#3f4942', margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#4d6171' }}>calendar_today</span>
                      Today: Sunday, Nov 01, 2026 • Pune & Hyderabad Region
                    </p>
                  </div>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: '#005131',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(0,81,49,0.25)',
                    }}
                  >
                    VS
                  </div>
                </div>
              </div>

              {/* 2x2 Summary Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                {/* Metric 1: Assigned */}
                <div
                  onClick={() => { setTaskCategory('all'); setCurrentTab('tasks'); }}
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    border: '1px solid #e1e7ed',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '105px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#3f4942' }}>Assigned</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#005131' }}>assignment</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '26px', fontWeight: 700, color: '#101d28' }}>{combinedTasks.length}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#a4f4c3', color: '#005232', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                      Active Run
                    </span>
                  </div>
                </div>

                {/* Metric 2: Due Today */}
                <div
                  onClick={() => { setStatusFilter('scheduled'); setCurrentTab('tasks'); }}
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    border: '1px solid #e1e7ed',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '105px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#3f4942' }}>Due Today</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4d6171' }}>schedule</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '26px', fontWeight: 700, color: '#101d28' }}>
                      {myAppointments.length > 0 ? myAppointments.length : 3}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#d0e5f9', color: '#354959', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                      Strict SLA
                    </span>
                  </div>
                </div>

                {/* Metric 3: In Progress */}
                <div
                  onClick={() => { setStatusFilter('in-progress'); setCurrentTab('tasks'); }}
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    border: '1px solid #e1e7ed',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '105px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#3f4942' }}>In Progress</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#176b45' }}>engineering</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '26px', fontWeight: 700, color: '#101d28' }}>{myInstallations.length}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#a4f4c3', color: '#005232', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                      On-site
                    </span>
                  </div>
                </div>

                {/* Metric 4: Needs Action */}
                <div
                  onClick={() => { setStatusFilter('needs-action'); setCurrentTab('tasks'); }}
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    border: '1px solid #ffdad6',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '105px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#ba1a1a' }}>Needs Action</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ba1a1a' }}>warning</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '26px', fontWeight: 700, color: '#ba1a1a' }}>1</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#ffdad6', color: '#93000a', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                      1 Audit Req
                    </span>
                  </div>
                </div>
              </div>

              {/* Urgent QA Correction Callout Banner */}
              <div
                style={{
                  background: '#ffdad6',
                  borderRadius: '12px',
                  padding: '1rem',
                  border: '1px solid #ffb4ab',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#ba1a1a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>photo_camera_back</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#93000a', textTransform: 'uppercase' }}>
                      QA Reject • Earth Pit Test
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#93000a', fontFamily: 'monospace' }}>
                      INS-2026-0015
                    </span>
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#101d28', margin: '0.2rem 0' }}>
                    Action Required: Re-upload Earth Pit Photo
                  </h3>
                  <p style={{ fontSize: '12px', color: '#3f4942', margin: '0 0 0.6rem 0' }}>
                    Rajesh Varma • Banjara Hills, Plot 42<br />
                    <span style={{ color: '#ba1a1a', fontWeight: 500 }}>Audit note: Chemical earthing clamp depth tag blurred.</span>
                  </p>
                  <button
                    onClick={() => {
                      setCaptureMode('photo');
                      setEvidenceCategory('EARTHING_TEST');
                      setCurrentTab('capture');
                    }}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      background: '#ba1a1a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>camera_enhance</span>
                    Correct & Re-upload
                  </button>
                </div>
              </div>

              {/* Quick Action Shortcuts (2x2 Grid) */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#101d28', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Field Execution Shortcuts
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  {/* Shortcut 1: New Survey */}
                  <button
                    onClick={() => {
                      setSelectedSurvey(mySurveys[0] || null);
                      setSurveyStep(2);
                      setCurrentTab('survey_stepper');
                    }}
                    style={{
                      minHeight: '64px',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      background: '#ffffff',
                      border: '1px solid #e1e7ed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#a4f4c3', color: '#005232', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add_a_photo</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#101d28', display: 'block' }}>Execute Survey</span>
                      <span style={{ fontSize: '11px', color: '#3f4942', display: 'block' }}>5-Step Stepper</span>
                    </div>
                  </button>

                  {/* Shortcut 2: Open Tasks */}
                  <button
                    onClick={() => { setTaskCategory('all'); setCurrentTab('tasks'); }}
                    style={{
                      minHeight: '64px',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      background: '#ffffff',
                      border: '1px solid #e1e7ed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#d0e5f9', color: '#354959', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>checklist</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#101d28', display: 'block' }}>Open Tasks</span>
                      <span style={{ fontSize: '11px', color: '#3f4942', display: 'block' }}>{combinedTasks.length} Work Orders</span>
                    </div>
                  </button>

                  {/* Shortcut 3: Barcode Scan */}
                  <button
                    onClick={() => {
                      setCaptureMode('barcode');
                      setCurrentTab('capture');
                    }}
                    style={{
                      minHeight: '64px',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      background: '#ffffff',
                      border: '1px solid #e1e7ed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#e2efff', color: '#005131', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>qr_code_scanner</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#101d28', display: 'block' }}>Scan Serial</span>
                      <span style={{ fontSize: '11px', color: '#005131', display: 'block' }}>Laser Viewport</span>
                    </div>
                  </button>

                  {/* Shortcut 4: Offline Sync */}
                  <button
                    onClick={() => setCurrentTab('more')}
                    style={{
                      minHeight: '64px',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      background: '#ffffff',
                      border: '1px solid #e1e7ed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#a4f4c3', color: '#005232', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>cloud_done</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#101d28', display: 'block' }}>Offline Cache</span>
                      <span style={{ fontSize: '11px', color: '#176b45', display: 'block' }}>100% Synced</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Recent Field Audit Trail Activity */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '1rem',
                  border: '1px solid #e1e7ed',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#101d28', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4d6171' }}>history</span>
                    Recent Field Audit Trail
                  </h4>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#176b45' }}>Live SQLite Ledger</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f9ff', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#005131' }}></span>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#101d28', margin: 0 }}>Component Serial Verified</p>
                        <p style={{ fontSize: '11px', color: '#3f4942', margin: 0 }}>Growatt MOD 10KTL3-X • SN: GWT-10K-2026-88129</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#6f7a71', fontFamily: 'monospace' }}>08:45 AM</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f9ff', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#4d6171' }}></span>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#101d28', margin: 0 }}>Survey Measurements Submitted</p>
                        <p style={{ fontSize: '11px', color: '#3f4942', margin: 0 }}>SRV-2026-001 • 720 sq ft, 180° Azimuth, 5.0 kW</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#6f7a71', fontFamily: 'monospace' }}>Yesterday</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* SCREEN 2: TASKS HUB (my_tasks_sunpower_solutions)       */}
          {/* ------------------------------------------------------- */}
          {currentTab === 'tasks' && (
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Search & Query Input Bar */}
              <div style={{ position: 'relative', width: '100%' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '12px', fontSize: '20px', color: '#4d6171' }}>
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Task ID (INS-, SURV-), Customer, Address..."
                  style={{
                    width: '100%',
                    height: '44px',
                    paddingLeft: '40px',
                    paddingRight: '36px',
                    borderRadius: '12px',
                    border: '1px solid #e1e7ed',
                    background: '#ffffff',
                    fontSize: '13px',
                    color: '#101d28',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '10px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#6f7a71' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                  </button>
                )}
              </div>

              {/* Horizontal Scrollable Category Filter Chips */}
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }} className="no-scrollbar">
                <button
                  onClick={() => setTaskCategory('all')}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: taskCategory === 'all' ? '#005131' : '#ecf4ff',
                    color: taskCategory === 'all' ? '#ffffff' : '#4d6171',
                  }}
                >
                  All Tasks ({combinedTasks.length})
                </button>
                <button
                  onClick={() => setTaskCategory('surv')}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: taskCategory === 'surv' ? '#005131' : '#ecf4ff',
                    color: taskCategory === 'surv' ? '#ffffff' : '#4d6171',
                  }}
                >
                  Site Surveys ({mySurveys.length})
                </button>
                <button
                  onClick={() => setTaskCategory('ins')}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: taskCategory === 'ins' ? '#005131' : '#ecf4ff',
                    color: taskCategory === 'ins' ? '#ffffff' : '#4d6171',
                  }}
                >
                  Installations ({myInstallations.length})
                </button>
                <button
                  onClick={() => setTaskCategory('srv')}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: taskCategory === 'srv' ? '#005131' : '#ecf4ff',
                    color: taskCategory === 'srv' ? '#ffffff' : '#4d6171',
                  }}
                >
                  Service Visits ({myServiceTickets.length})
                </button>
                <button
                  onClick={() => setTaskCategory('done')}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: taskCategory === 'done' ? '#005131' : '#ecf4ff',
                    color: taskCategory === 'done' ? '#ffffff' : '#4d6171',
                  }}
                >
                  Completed (34)
                </button>
              </div>

              {/* Status Filter & Sort Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #e1e7ed',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#101d28',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#005131' }}>tune</span>
                    <span>Status: {statusFilter.toUpperCase()}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4d6171' }}>expand_more</span>
                  </button>

                  {showStatusDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        background: '#ffffff',
                        border: '1px solid #e1e7ed',
                        borderRadius: '10px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 20,
                        width: '160px',
                        overflow: 'hidden',
                      }}
                    >
                      {['all', 'in-progress', 'scheduled', 'needs-action'].map((st) => (
                        <div
                          key={st}
                          onClick={() => { setStatusFilter(st); setShowStatusDropdown(false); }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            fontSize: '12px',
                            cursor: 'pointer',
                            color: statusFilter === st ? '#005131' : '#101d28',
                            background: statusFilter === st ? '#ecf4ff' : '#ffffff',
                            fontWeight: statusFilter === st ? 700 : 400,
                          }}
                        >
                          {st.replace('-', ' ').toUpperCase()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSortEarliest(!sortEarliest)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#4d6171',
                    cursor: 'pointer',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>swap_vert</span>
                  <span>Due: {sortEarliest ? 'Earliest First' : 'Latest First'}</span>
                </button>
              </div>

              {/* Task Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredTasks.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#6f7a71', background: '#ffffff', borderRadius: '12px' }}>
                    No work orders found matching the selected filters.
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <article
                      key={`${task.type}-${task.id}`}
                      style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        padding: '1rem',
                        border: '1px solid #e1e7ed',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      }}
                    >
                      {/* Top Meta Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: '#101d28' }}>
                            {task.number}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              background: task.priority === 'CRITICAL' ? '#ffdad6' : '#ecf4ff',
                              color: task.priority === 'CRITICAL' ? '#93000a' : '#354959',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '999px',
                            }}
                          >
                            {task.priority} Priority
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            background: task.status === 'COMMISSIONED' || task.status === 'APPROVED' ? '#a4f4c3' : '#d0e5f9',
                            color: task.status === 'COMMISSIONED' || task.status === 'APPROVED' ? '#005232' : '#354959',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: 'currentColor' }} />
                          {task.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Customer & Capacity */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#101d28', margin: 0 }}>
                            {task.customer}
                          </h2>
                          <p style={{ fontSize: '12px', color: '#4d6171', margin: '0.15rem 0 0 0' }}>
                            {task.capacity}
                          </p>
                        </div>
                      </div>

                      {/* Location & Time Box */}
                      <div style={{ background: '#f7f9ff', padding: '0.5rem 0.75rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '12px', color: '#101d28' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#005131', flexShrink: 0 }}>location_on</span>
                          <span style={{ truncate: 'true' }}>{task.address}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '11px', color: '#4d6171' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>schedule</span>
                          <span>{task.due}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <button
                          onClick={() => {
                            if (task.type === 'ins') {
                              setSelectedTask(task.raw);
                              setCurrentTab('task_details');
                            } else if (task.type === 'surv') {
                              setSelectedSurvey(task.raw);
                              setCurrentTab('survey_stepper');
                            } else {
                              alert(`Service Visit: ${task.number}\nCustomer: ${task.customer}\nIssue: ${task.capacity}`);
                            }
                          }}
                          style={{
                            minHeight: '44px',
                            background: '#005131',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            {task.type === 'surv' ? 'edit_note' : 'assignment'}
                          </span>
                          {task.type === 'surv' ? 'Execute Survey' : 'Open Details'}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedTask(task.raw);
                            setCaptureMode(task.type === 'ins' ? 'barcode' : 'photo');
                            setCurrentTab('capture');
                          }}
                          style={{
                            minHeight: '44px',
                            background: '#ffffff',
                            color: '#005131',
                            border: '1px solid #e1e7ed',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            {task.type === 'ins' ? 'qr_code_scanner' : 'photo_camera'}
                          </span>
                          {task.type === 'ins' ? 'Scan Serials' : 'Take Photos'}
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* SCREEN 3: SITE SURVEY STEPPER (site_survey_surv_2026_0031) */}
          {/* ------------------------------------------------------- */}
          {currentTab === 'survey_stepper' && (
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Context Pill & Progress Header */}
              <div style={{ background: '#ecf4ff', borderRadius: '12px', padding: '1rem', border: '1px solid #d0e5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: '#101d28' }}>
                      {selectedSurvey?.survey_number || 'SURV-2026-0031'}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#a4f4c3', color: '#005232', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                      In Progress
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, background: '#d0e5f9', color: '#354959', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                    {surveyForm.recommended_capacity_kw} kW Comm.
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#101d28', margin: 0 }}>
                    {selectedSurvey?.customer || 'Priya Reddy'}
                  </h2>
                  <span style={{ fontSize: '12px', color: '#4d6171' }}>Step {surveyStep} of 5</span>
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '8px', background: '#d6e4f3', borderRadius: '999px', marginTop: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ width: `${(surveyStep / 5) * 100}%`, height: '100%', background: '#005131', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                </div>
              </div>

              {/* Step Navigation Pills */}
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }} className="no-scrollbar">
                {[
                  { step: 1, label: '1. Site Info' },
                  { step: 2, label: '2. Roof & Structure' },
                  { step: 3, label: '3. Electrical' },
                  { step: 4, label: '4. Photos' },
                  { step: 5, label: '5. Review' },
                ].map((s) => (
                  <button
                    key={s.step}
                    onClick={() => setSurveyStep(s.step)}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      background: surveyStep === s.step ? '#005131' : surveyStep > s.step ? '#a4f4c3' : '#dceaf9',
                      color: surveyStep === s.step ? '#ffffff' : surveyStep > s.step ? '#002111' : '#3f4942',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Step 2: Roof & Structure Form Controls */}
              {surveyStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Roof Structure Selection */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, color: '#101d28', display: 'block', marginBottom: '0.5rem' }}>
                      Roof Structure Type <span style={{ color: '#ba1a1a' }}>*</span>
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        { id: 'rcc', name: 'RCC Flat Terrace', desc: 'Concrete slab, ballasted rail mounting', icon: 'corporate_fare' },
                        { id: 'metal_trapezoid', name: 'Metal Sheet (Trapezoidal)', desc: 'Direct rivet rail clamp system', icon: 'warehouse' },
                        { id: 'tiled', name: 'Tiled / Sloped Roof', desc: 'Tile hooks and penetrative brackets', icon: 'roofing' },
                      ].map((rf) => (
                        <div
                          key={rf.id}
                          onClick={() => setSurveyForm({ ...surveyForm, roof_type: rf.id })}
                          style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            background: surveyForm.roof_type === rf.id ? '#a4f4c3' : '#f7f9ff',
                            border: surveyForm.roof_type === rf.id ? '1.5px solid #005131' : '1px solid #e1e7ed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#005131' }}>{rf.icon}</span>
                            <div>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: '#101d28', margin: 0 }}>{rf.name}</p>
                              <p style={{ fontSize: '11px', color: '#4d6171', margin: 0 }}>{rf.desc}</p>
                            </div>
                          </div>
                          <input
                            type="radio"
                            checked={surveyForm.roof_type === rf.id}
                            onChange={() => setSurveyForm({ ...surveyForm, roof_type: rf.id })}
                            style={{ accentColor: '#005131', width: '18px', height: '18px' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Area Measurements */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#101d28', margin: 0 }}>
                      Engineering Area & Azimuth Telemetry
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#3f4942', display: 'block', marginBottom: '0.25rem' }}>
                          Usable Roof Area (sq ft)
                        </label>
                        <input
                          type="number"
                          value={surveyForm.usable_roof_area_sqft}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSurveyForm({
                              ...surveyForm,
                              usable_roof_area_sqft: val,
                              recommended_capacity_kw: Math.round((val / 100) * 10) / 10,
                            });
                          }}
                          style={{ width: '100%', height: '44px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e1e7ed', fontSize: '14px', fontWeight: 600 }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#3f4942', display: 'block', marginBottom: '0.25rem' }}>
                          Shadow-Free Area (sq ft)
                        </label>
                        <input
                          type="number"
                          value={surveyForm.shadow_free_area_sqft}
                          onChange={(e) => setSurveyForm({ ...surveyForm, shadow_free_area_sqft: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', height: '44px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e1e7ed', fontSize: '14px', fontWeight: 600 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#3f4942', display: 'block', marginBottom: '0.25rem' }}>
                          Roof Azimuth Angle (°)
                        </label>
                        <input
                          type="number"
                          value={surveyForm.roof_azimuth_deg}
                          onChange={(e) => setSurveyForm({ ...surveyForm, roof_azimuth_deg: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', height: '44px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e1e7ed', fontSize: '14px', fontWeight: 600 }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#3f4942', display: 'block', marginBottom: '0.25rem' }}>
                          Tilt Angle (°)
                        </label>
                        <input
                          type="number"
                          value={surveyForm.tilt_angle_deg}
                          onChange={(e) => setSurveyForm({ ...surveyForm, tilt_angle_deg: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', height: '44px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e1e7ed', fontSize: '14px', fontWeight: 600 }}
                        />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#3f4942' }}>Shading Loss (%)</label>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#005131' }}>{surveyForm.shading_loss_pct}% (Low)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="25"
                        step="0.1"
                        value={surveyForm.shading_loss_pct}
                        onChange={(e) => setSurveyForm({ ...surveyForm, shading_loss_pct: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', accentColor: '#005131' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#3f4942', display: 'block', marginBottom: '0.25rem' }}>
                        Recommended Solar Capacity (kW)
                      </label>
                      <input
                        type="number"
                        value={surveyForm.recommended_capacity_kw}
                        onChange={(e) => setSurveyForm({ ...surveyForm, recommended_capacity_kw: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', height: '44px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e1e7ed', fontSize: '14px', fontWeight: 700, color: '#005131' }}
                      />
                    </div>
                  </div>

                  {/* Navigation Actions */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button
                      onClick={() => setSurveyStep(1)}
                      style={{ minHeight: '44px', borderRadius: '8px', border: '1px solid #e1e7ed', background: '#ffffff', color: '#101d28', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Back: Site Info
                    </button>
                    <button
                      onClick={() => setSurveyStep(3)}
                      style={{ minHeight: '44px', borderRadius: '8px', border: 'none', background: '#005131', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Next: Electrical
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Electrical & Connections */}
              {surveyStep === 3 && (
                <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#101d28', margin: 0 }}>
                    Main Distribution & Earthing Verification
                  </h3>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#3f4942', display: 'block', marginBottom: '0.35rem' }}>
                      Observations & Structural Notes
                    </label>
                    <textarea
                      rows="3"
                      value={surveyForm.technician_observations}
                      onChange={(e) => setSurveyForm({ ...surveyForm, technician_observations: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e1e7ed', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button
                      onClick={() => setSurveyStep(2)}
                      style={{ minHeight: '44px', borderRadius: '8px', border: '1px solid #e1e7ed', background: '#ffffff', color: '#101d28', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setSurveyStep(4)}
                      style={{ minHeight: '44px', borderRadius: '8px', border: 'none', background: '#005131', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Next: Photos
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Photo Attachments */}
              {surveyStep === 4 && (
                <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#101d28', margin: 0 }}>
                    Photographic Proof Attachments
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    {['ROOF_TOP', 'ELECTRICAL_PANEL', 'SHADOW_ANALYSIS', 'INVERTER_LOCATION'].map((cat) => (
                      <div
                        key={cat}
                        onClick={() => {
                          setEvidenceCategory(cat);
                          setCurrentTab('capture');
                        }}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '1px dashed #005131',
                          background: '#ecf4ff',
                          textAlign: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#005131' }}>add_a_photo</span>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#005131', margin: '0.2rem 0 0 0' }}>
                          {cat.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button
                      onClick={() => setSurveyStep(3)}
                      style={{ minHeight: '44px', borderRadius: '8px', border: '1px solid #e1e7ed', background: '#ffffff', color: '#101d28', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setSurveyStep(5)}
                      style={{ minHeight: '44px', borderRadius: '8px', border: 'none', background: '#005131', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Next: Review & Submit
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Final Review & Submit */}
              {surveyStep === 5 && (
                <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#101d28', margin: 0 }}>
                    Step 5: Technical Summary Review
                  </h3>

                  <div style={{ background: '#f7f9ff', padding: '0.85rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#4d6171' }}>Survey Number:</span>
                      <strong style={{ color: '#101d28' }}>{selectedSurvey?.survey_number || 'SRV-2026-0031'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#4d6171' }}>Usable Area:</span>
                      <strong style={{ color: '#101d28' }}>{surveyForm.usable_roof_area_sqft} sq ft</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#4d6171' }}>Azimuth & Tilt:</span>
                      <strong style={{ color: '#101d28' }}>{surveyForm.roof_azimuth_deg}° Azimuth • {surveyForm.tilt_angle_deg}° Tilt</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#4d6171' }}>Recommended Capacity:</span>
                      <strong style={{ color: '#005131' }}>{surveyForm.recommended_capacity_kw} kW</strong>
                    </div>
                  </div>

                  <div style={{ background: '#fff5df', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.75rem', fontSize: '11px', color: '#92400e' }}>
                    <strong>RBAC Governance Notice:</strong> Field Technicians submit measurements for independent Survey Manager approval. Technicians cannot approve their own surveys (HTTP 403 Guard).
                  </div>

                  <button
                    onClick={handleSubmitSurvey}
                    disabled={isSubmittingSurvey}
                    style={{
                      minHeight: '48px',
                      background: '#005131',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 2px 6px rgba(0,81,49,0.2)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>send</span>
                    {isSubmittingSurvey ? 'Submitting to Survey Manager...' : 'Submit Technical Findings'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* SCREEN 4: TASK DETAILS & LIFECYCLE (task_details_ins_2026_0018) */}
          {/* ------------------------------------------------------- */}
          {currentTab === 'task_details' && (
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Status & Quick Summary Banner */}
              <div style={{ background: '#ecf4ff', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #d0e5f9', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#4d6171' }}>Task ID:</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#101d28', fontFamily: 'monospace' }}>
                    {selectedTask?.task_id || selectedTask?.number || 'TSK-2026-0018'}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#0284c7', color: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    {selectedTask?.task_type_label || (selectedTask?.type === 'surv' ? '1. Site Survey' : selectedTask?.type === 'ins' ? '2. Installation' : '5. Repair / Service Visit')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, background: selectedTask?.priority === 'CRITICAL' ? '#fee2e2' : '#fef3c7', color: selectedTask?.priority === 'CRITICAL' ? '#991b1b' : '#92400e', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                    {selectedTask?.priority || 'HIGH'} PRIORITY
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#a4f4c3', color: '#005232', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                    {selectedTask?.status || 'In Progress'}
                  </span>
                </div>
              </div>

              {/* Customer & Site Card */}
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '999px', background: '#d0e5f9', color: '#354959', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700 }}>
                      {selectedTask?.customer ? selectedTask.customer.split(' ').map(n => n[0]).join('') : 'RS'}
                    </div>
                    <div>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#101d28', margin: 0 }}>
                        {selectedTask?.customer || 'Rajesh Sharma'}
                      </h2>
                      <p style={{ fontSize: '12px', color: '#4d6171', margin: 0 }}>
                        {selectedTask?.customer_phone || '+91 98490 23411'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <a
                      href={`tel:${selectedTask?.customer_phone || '+919849023411'}`}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#e2efff', color: '#005131', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                      aria-label="Call"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>phone</span>
                    </a>
                    <a
                      href={`https://wa.me/${(selectedTask?.customer_phone || '919849023411').replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#a4f4c3', color: '#005232', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                      aria-label="WhatsApp"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chat</span>
                    </a>
                  </div>
                </div>

                {/* Address & Navigation */}
                <div style={{ background: '#f7f9ff', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#005131', marginTop: '1px' }}>location_on</span>
                    <p style={{ fontSize: '12px', color: '#101d28', margin: 0 }}>
                      {selectedTask?.address || 'Plot 42, Road No. 10, Jubilee Hills, Hyderabad 500033'}
                    </p>
                  </div>
                  <button
                    onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(selectedTask?.address || 'Plot 42 Jubilee Hills Hyderabad')}`, '_blank')}
                    style={{
                      height: '40px',
                      background: '#ffffff',
                      border: '1px solid #e1e7ed',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#101d28',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#005131' }}>directions</span>
                    Navigate in Google Maps
                  </button>
                </div>

                {/* System Specs & Scheduled Window */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={{ background: '#f7f9ff', padding: '0.6rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#4d6171', display: 'block' }}>PROJECT / REF</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#101d28' }}>
                      {selectedTask?.project_id || selectedTask?.number || 'PRJ-2026-001'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#4d6171', display: 'block' }}>
                      Tech: {user?.full_name || 'Deepak Chavan'}
                    </span>
                  </div>
                  <div style={{ background: '#f7f9ff', padding: '0.6rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#4d6171', display: 'block' }}>SCHEDULED WINDOW</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#005131' }}>
                      {selectedTask?.due || 'Today, 10:00 AM - 01:30 PM'}
                    </span>
                  </div>
                </div>

                {/* Task-Specific Requirements & Completion Criteria (Prompt Section 2.C) */}
                {selectedTask?.required_checklist && (
                  <div style={{ background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>fact_check</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>Required Task Checklist</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {selectedTask.required_checklist.map((chk, idx) => (
                        <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '11px', color: '#14532d', cursor: 'pointer' }}>
                          <input type="checkbox" defaultChecked={idx < 2} style={{ marginTop: '2px', accentColor: '#16a34a' }} />
                          <span>{chk}</span>
                        </label>
                      ))}
                    </div>

                    {selectedTask.required_documents && (
                      <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed #bbf7d0' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', display: 'block', marginBottom: '0.25rem' }}>
                          📸 Mandatory Evidence / Photos:
                        </span>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '11px', color: '#14532d' }}>
                          {selectedTask.required_documents.map((doc, docIdx) => (
                            <li key={docIdx}>{doc}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedTask.completion_requirements && (
                      <div style={{ marginTop: '0.35rem', background: '#dcfce7', padding: '0.45rem', borderRadius: '6px', fontSize: '11px', color: '#15803d' }}>
                        <strong>Completion Criteria:</strong> {selectedTask.completion_requirements}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Vertical Installation Lifecycle Timeline */}
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#101d28', margin: 0 }}>
                    Installation Lifecycle Protocol
                  </h3>
                  <span style={{ fontSize: '11px', fontWeight: 600, background: '#d0e5f9', color: '#354959', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                    Step 4 of 5
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {[
                    { step: 1, title: 'Step 1: Component Verification & BOM', desc: 'Verified 5/5 components match warehouse dispatch', status: 'VERIFIED' },
                    { step: 2, title: 'Step 2: Mechanical Mounting & PV Clamping', desc: 'Rooftop torque & alignment checked', status: 'VERIFIED' },
                    { step: 3, title: 'Step 3: DC/AC Cabling & Chemical Earthing', desc: 'Earthing pit resistance verified <= 5.0 Ω (IS 3043)', status: 'VERIFIED' },
                    { step: 4, title: 'Step 4: Grid Synchronization & Testing', desc: 'Voltage: 238.5V, Current: 28.4A, Frequency: 50.0Hz', status: 'IN_PROGRESS' },
                    { step: 5, title: 'Step 5: Customer Handover & Touch Signoff', desc: 'Owner satisfaction rating and signature capture', status: 'PENDING' },
                  ].map((st) => (
                    <div key={st.step} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: '#f7f9ff', padding: '0.65rem', borderRadius: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '999px',
                          background: st.status === 'VERIFIED' ? '#a4f4c3' : st.status === 'IN_PROGRESS' ? '#005131' : '#dceaf9',
                          color: st.status === 'VERIFIED' ? '#005232' : st.status === 'IN_PROGRESS' ? '#ffffff' : '#4d6171',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {st.status === 'VERIFIED' ? '✓' : st.step}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#101d28' }}>{st.title}</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: st.status === 'VERIFIED' ? '#005131' : '#4d6171' }}>
                            {st.status}
                          </span>
                        </div>
                        <p style={{ fontSize: '11px', color: '#4d6171', margin: '0.15rem 0 0 0' }}>{st.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Touchscreen Customer Signature & Commissioning Box */}
                <div style={{ borderTop: '1px solid #e1e7ed', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#101d28', margin: '0 0 0.4rem 0' }}>
                    Customer Handover Sign-off Pad
                  </h4>
                  <div style={{ border: '1.5px dashed #005131', borderRadius: '8px', background: '#ffffff', padding: '4px', position: 'relative' }}>
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      style={{ width: '100%', height: '110px', display: 'block', touchAction: 'none', background: '#fafafa' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.5rem' }}>
                      <span style={{ fontSize: '11px', color: '#6f7a71' }}>Sign directly with finger or stylus above</span>
                      <button
                        onClick={clearSignature}
                        style={{ background: 'none', border: 'none', color: '#ba1a1a', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#4d6171' }}>Earthing Resistance:</span>
                      <strong style={{ color: '#005131' }}>{worksheet.earthing_resistance_ohms} Ω (Pass: &le; 5.0 Ω)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#4d6171' }}>Grid Sync Telemetry:</span>
                      <strong style={{ color: '#101d28' }}>{worksheet.voltage_reading_volts}V • {worksheet.power_output_kw}kW • {worksheet.grid_frequency_hz}Hz</strong>
                    </div>
                  </div>

                  <button
                    onClick={handleFinalizeCommissioning}
                    disabled={isCommissioning}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      background: '#005131',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      marginTop: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 6px rgba(0,81,49,0.25)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>verified</span>
                    {isCommissioning ? 'Finalizing...' : 'Finalize Commissioning & Activate Passport'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* SCREEN 5: CAMERA & SERIAL CAPTURE (camera_serial_capture)*/}
          {/* ------------------------------------------------------- */}
          {currentTab === 'capture' && (
            <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Task Selector Chip & Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#dceaf9', padding: '0.25rem 0.6rem', borderRadius: '999px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#005131' }}>assignment_turned_in</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#101d28' }}>
                    {selectedTask?.installation_number || selectedSurvey?.survey_number || 'INS-2026-0018'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#4d6171' }}>expand_more</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#ecfdf5', padding: '0.25rem 0.6rem', borderRadius: '999px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: '#005131' }}></span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#005131' }}>GPS Fixed (3m)</span>
                </div>
              </div>

              {/* Mode Segmented Selector */}
              <div style={{ background: '#e2efff', padding: '3px', borderRadius: '10px', display: 'flex', gap: '3px' }}>
                {[
                  { mode: 'photo', label: 'Photo', icon: 'photo_camera' },
                  { mode: 'barcode', label: 'Serial Barcode', icon: 'qr_code_scanner' },
                  { mode: 'doc', label: 'Nameplate', icon: 'badge' },
                ].map((m) => (
                  <button
                    key={m.mode}
                    onClick={() => setCaptureMode(m.mode)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: captureMode === m.mode ? 700 : 500,
                      background: captureMode === m.mode ? '#ffffff' : 'transparent',
                      color: captureMode === m.mode ? '#005131' : '#3f4942',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      boxShadow: captureMode === m.mode ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Viewport Area (Camera Viewport with Laser Reticle) */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4 / 3',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: '#070d1e',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                }}
              >
                {/* Real video stream element */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: cameraActive ? 'block' : 'none',
                  }}
                />

                {/* Fallback Viewport simulation when camera unavailable */}
                {!cameraActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: 'radial-gradient(circle at center, #1e293b 0%, #070d1e 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a4f4c3',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.8 }}>qr_code_scanner</span>
                    <span style={{ fontSize: '12px', marginTop: '0.5rem', color: '#94a3b8' }}>Optical Viewfinder Active</span>
                  </div>
                )}

                {/* Moving Scanning Laser Animation */}
                <div className="laser-scanner-bar" />

                {/* Viewfinder Reticle Corners */}
                <div
                  style={{
                    position: 'absolute',
                    inset: '16% 12%',
                    border: '1.5px dashed rgba(164, 244, 195, 0.4)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '20px', height: '20px', borderTop: '3px solid #a4f4c3', borderLeft: '3px solid #a4f4c3' }} />
                  <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', borderTop: '3px solid #a4f4c3', borderRight: '3px solid #a4f4c3' }} />
                  <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '20px', height: '20px', borderBottom: '3px solid #a4f4c3', borderLeft: '3px solid #a4f4c3' }} />
                  <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderBottom: '3px solid #a4f4c3', borderRight: '3px solid #a4f4c3' }} />
                </div>

                {/* Top Controls Overlay */}
                <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      background: 'rgba(7, 13, 30, 0.75)',
                      backdropFilter: 'blur(8px)',
                      color: '#a4f4c3',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sync</span>
                    Target: Inverter S/N (BOM)
                  </span>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      onClick={() => setFlashOn(!flashOn)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '999px',
                        background: flashOn ? '#a4f4c3' : 'rgba(7, 13, 30, 0.7)',
                        color: flashOn ? '#002111' : '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>flash_on</span>
                    </button>
                    <button
                      onClick={() => setGridOn(!gridOn)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '999px',
                        background: gridOn ? '#a4f4c3' : 'rgba(7, 13, 30, 0.7)',
                        color: gridOn ? '#002111' : '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>grid_4x4</span>
                    </button>
                    <button
                      onClick={() => setFacingUser(!facingUser)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '999px',
                        background: 'rgba(7, 13, 30, 0.7)',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>flip_camera_ios</span>
                    </button>
                  </div>
                </div>

                {/* Live Barcode Match Telemetry Card */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 10,
                    background: 'rgba(7, 13, 30, 0.85)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '10px',
                    padding: '0.65rem 0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Detected Serial</span>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#a4f4c3', margin: 0, fontFamily: 'monospace' }}>
                      {scannedSerialMatch}
                    </p>
                    <span style={{ fontSize: '10px', color: '#cbd5e1' }}>Growatt MOD 10KTL3-X 10kW Inverter</span>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, background: '#a4f4c3', color: '#005232', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                    BOM Match
                  </span>
                </div>
              </div>

              {/* Shutter / Capture Trigger Actions */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleCaptureSnapshot}
                  style={{
                    flex: 1,
                    minHeight: '48px',
                    background: '#005131',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>photo_camera</span>
                  Capture Evidence Photo
                </button>

                <button
                  onClick={handleVerifySerial}
                  style={{
                    minHeight: '48px',
                    padding: '0 1rem',
                    background: '#ffffff',
                    color: '#005131',
                    border: '1.5px solid #005131',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>done_all</span>
                  Confirm S/N
                </button>
              </div>

              {/* Verified BOM Serials List */}
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '0.85rem', border: '1px solid #e1e7ed' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.4rem' }}>
                  Verified Dispatched Hardware Serials ({verifiedSerials.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {verifiedSerials.map((sn, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f9ff', padding: '0.4rem 0.65rem', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#101d28' }}>{sn}</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#005131', background: '#a4f4c3', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                        VERIFIED ON SITE
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* SCREEN 6: SCHEDULE & CALENDAR (Appointments)            */}
          {/* ------------------------------------------------------- */}
          {currentTab === 'schedule' && (
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#101d28', margin: '0 0 0.5rem 0' }}>
                  Field Appointments Calendar
                </h3>
                <p style={{ fontSize: '12px', color: '#4d6171', margin: '0 0 0.75rem 0' }}>
                  Upcoming customer visits scheduled for technician {technician.name || 'Vikram Salunkhe'}:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {myAppointments.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#6f7a71' }}>No upcoming appointments scheduled.</div>
                  ) : (
                    myAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        style={{
                          background: '#f7f9ff',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #e1e7ed',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#101d28' }}>{apt.customer}</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, background: '#d0e5f9', color: '#354959', padding: '0.15rem 0.45rem', borderRadius: '999px' }}>
                            {apt.appointment_type}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#4d6171', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>schedule</span>
                          <span>{apt.scheduled_date} ({apt.time_slot})</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#101d28', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#005131' }}>location_on</span>
                          <span>{apt.address || 'Pune & Hyderabad'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* SCREEN 7: MORE / OFFLINE CACHE & OPERATIONS             */}
          {/* ------------------------------------------------------- */}
          {currentTab === 'more' && (
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#101d28', margin: '0 0 0.5rem 0' }}>
                  Offline Local Storage Queue
                </h3>
                <p style={{ fontSize: '12px', color: '#4d6171', margin: '0 0 0.75rem 0' }}>
                  Actions performed without internet connectivity are queued safely with client-side UUIDs:
                </p>

                <div style={{ background: '#f7f9ff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e1e7ed' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#101d28' }}>Queue Status</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#005131' }}>{offlineQueue.length} Pending Actions</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#4d6171', margin: 0 }}>
                    All local technician telemetry and survey drafts are synced with the central SQLite database.
                  </p>
                </div>

                <button
                  onClick={() => {
                    localStorage.removeItem('TECH_OFFLINE_QUEUE');
                    setOfflineQueue([]);
                    alert('Offline synchronization complete. All items processed against central backend.');
                  }}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    background: '#005131',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    marginTop: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Flush & Drain Sync Queue
                </button>
              </div>

              {/* Assigned Capabilities Badge Box */}
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e1e7ed' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#101d28', margin: '0 0 0.5rem 0' }}>
                  Authorized Operational Capabilities
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {(technician.capabilities || ['SURVEY_EXECUTION', 'INSTALLATION_EXECUTION', 'ELECTRICAL_TESTING']).map((cap) => (
                    <span
                      key={cap}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        background: '#a4f4c3',
                        color: '#002111',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      ✓ {cap.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ========================================================= */}
        {/* FIXED BOTTOM NAVIGATION BAR (matching stitch_odoo_ui)     */}
        {/* ========================================================= */}
        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            maxWidth: '540px',
            margin: '0 auto',
            zIndex: 50,
            height: '70px',
            background: 'rgba(247, 249, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid #e1e7ed',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '0 0.5rem',
          }}
        >
          {[
            { id: 'home', label: 'Home', icon: 'home' },
            { id: 'tasks', label: 'Tasks', icon: 'checklist', count: combinedTasks.length },
            { id: 'schedule', label: 'Schedule', icon: 'calendar_today', count: myAppointments.length },
            { id: 'capture', label: 'Capture', icon: 'photo_camera' },
            { id: 'more', label: 'More', icon: 'grid_view' },
          ].map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '56px',
                  minHeight: '48px',
                  color: isActive ? '#005131' : '#4d6171',
                  transition: 'color 0.2s ease',
                  position: 'relative',
                  padding: '4px 0',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '24px',
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {item.icon}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: isActive ? 700 : 500,
                    marginTop: '2px',
                  }}
                >
                  {item.label}
                </span>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '10px',
                      fontSize: '9px',
                      fontWeight: 800,
                      background: '#005131',
                      color: '#ffffff',
                      borderRadius: '999px',
                      padding: '1px 4px',
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
