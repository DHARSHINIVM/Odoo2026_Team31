const realData = {"customer":{"id":1,"name":"Rajesh Sharma","city":"Pune","phone":"+91 98230 11223","consumer_number":"MSEDCL-PUN-849201"},"active_project":{"order_id":6,"order_number":"ORD-2026-006","system_capacity_kw":5.5,"grid_type":"ON_GRID","stage":"BOM_GENERATED"},"milestones":[{"step_number":1,"title":"Survey","is_completed":true}],"hardware_items":[{"name":"Panel","category":"PANEL","is_ready":true,"status":"Allocated"}],"coordinator":{"name":"Rahul Deshmukh","phone":"+91 98200 22002"},"passport":{"id":1,"passport_number":"DSP-MH-2026-0081","system_health_score":98,"lifetime_mwh":187.5},"warranties_count":3,"open_service_tickets_count":1,"unread_notifications_count":2,"recent_activity":[{"title":"Order Confirmed","date":"Oct 29","desc":"Order confirmed"}]};
const mockProjects = [{"id":6,"order_id":6,"order_number":"ORD-2026-006","stage":"BOM_GENERATED","system_capacity_kw":6.5,"address":"Baner, Pune"},{"id":1,"order_id":1,"order_number":"ORD-2026-001","stage":"COMMISSIONED","system_capacity_kw":5.5,"address":"Baner, Pune"}];
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Sun, Shield, Calendar, Clock, MapPin, Phone, Mail, CheckCircle2,
  AlertCircle, ChevronRight, X, Camera, QrCode, Upload, Star,
  MessageSquare, RefreshCw, ArrowRight, Check, AlertTriangle,
  Info, ExternalLink, FileText, Zap, User, Settings,
  Bell, Award, Send, Wrench, Eye, Layers, Cpu, Battery,
  Activity, CheckSquare, Plus, Filter, ThumbsUp, Search, DollarSign,
  Download, ShieldCheck, CheckCircle
} from 'lucide-react';

export default function CustomerDashboard({ refreshTrigger }) {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab: 'lead' (Module 1) | 'projects' (Module 2) | 'passport' (Module 3) | 'feedback' (Module 4)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam === 'projects' || tabParam === 'passport' || tabParam === 'feedback'
      ? tabParam
      : 'lead'
  );

  useEffect(() => {
    if (tabParam && ['lead', 'projects', 'passport', 'feedback'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  // Telemetry & Backend State
  const [data, setData] = useState(realData);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Projects State
  const [projectsList, setProjectsList] = useState(mockProjects);
  const [selectedProject, setSelectedProject] = useState(null);

  // Passport & Verification State
  const [verifiedPassport, setVerifiedPassport] = useState(null);
  const [qrTokenInput, setQrTokenInput] = useState('');
  const [qrScanLoading, setQrScanLoading] = useState(false);
  const [qrScanError, setQrScanError] = useState(null);

  // Hardware Camera Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Appointments & Service Tickets
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [serviceTickets, setServiceTickets] = useState([]);

  // Active Modals: null | 'service_booking' | 'appointment_reg' | 'complaint' | 'passport_ack'
  const [activeModal, setActiveModal] = useState(null);

  // ---------------------------------------------------------------------------
  // MODULE 1: REQUIREMENT FILLING FORM (NEW LEAD REQUEST)
  // ---------------------------------------------------------------------------
  const [leadForm, setLeadForm] = useState({
    customer_name: user?.full_name || 'Rajesh Sharma',
    mobile_number: user?.phone || '+91 98230 11223',
    email: user?.email || 'customer@sunpower.com',
    installation_address: 'Baner Road, Pune, Maharashtra 411045',
    customer_type: 'Residential',
    monthly_bill_inr: 4500,
    solar_preference: 'On-Grid',
    approximate_capacity: '5 kW',
    roof_surface: 'RCC Flat Terrace',
    roof_area_sqft: 650,
    additional_remarks: 'Require terrace structure with shadow-free elevation and PM Surya Ghar subsidy processing.',
    preferred_survey_date: '',
    preferred_time_window: '10:00 - 12:00',
    alternative_preferred_date: '',
    access_instructions: 'Terrace key available with apartment security supervisor.',
  });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccessResult, setLeadSuccessResult] = useState(null);

  // Dynamic capacity suggestion based on electricity bill
  useEffect(() => {
    const bill = parseFloat(leadForm.monthly_bill_inr) || 0;
    let recKw = '3 kW';
    if (bill > 8000) recKw = '10 kW';
    else if (bill > 5000) recKw = '6 kW';
    else if (bill > 3000) recKw = '5 kW';
    else if (bill > 1500) recKw = '3 kW';
    else recKw = '2 kW';
    setLeadForm((prev) => ({ ...prev, approximate_capacity: recKw }));
  }, [leadForm.monthly_bill_inr]);

  // ---------------------------------------------------------------------------
  // MODULE 3: SERVICE BOOKING, APPOINTMENT & COMPLAINT FORMS
  // ---------------------------------------------------------------------------
  const [serviceCategory, setServiceCategory] = useState('GENERAL_MAINTENANCE');
  const [serviceDesc, setServiceDesc] = useState('');
  const [serviceVisitDate, setServiceVisitDate] = useState('');
  const [serviceVisitSlot, setServiceVisitSlot] = useState('10:00 - 12:00');
  const [servicePhotoFile, setServicePhotoFile] = useState(null);
  const [servicePhotoPreview, setServicePhotoPreview] = useState(null);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState('');

  // Standalone Appointment Registration
  const [aptType, setAptType] = useState('SERVICE');
  const [aptDate, setAptDate] = useState('');
  const [aptSlot, setAptSlot] = useState('10:00 - 12:00');
  const [aptNotes, setAptNotes] = useState('');
  const [aptSubmitting, setAptSubmitting] = useState(false);
  const [aptSuccessMsg, setAptSuccessMsg] = useState('');

  // Formal Complaint
  const [complaintCategory, setComplaintCategory] = useState('WORKMANSHIP_ISSUE');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintDate, setComplaintDate] = useState('');
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintSuccessMsg, setComplaintSuccessMsg] = useState('');

  // ---------------------------------------------------------------------------
  // MODULE 4: TEXT-FORMAT FEEDBACK STATE
  // ---------------------------------------------------------------------------
  const [feedbackTab, setFeedbackTab] = useState('PRODUCT'); // 'PRODUCT' | 'TECHNICIAN'
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [productReviewText, setProductReviewText] = useState('');
  const [technicianReviewText, setTechnicianReviewText] = useState('');
  const [feedbackSubRatings, setFeedbackSubRatings] = useState({
    system_performance: 5,
    build_quality: 5,
    professionalism: 5,
    cleanliness: 5,
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState('');
  const [feedbackList, setFeedbackList] = useState([]);

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, projects, apts, tickets, fbs] = await Promise.all([
        api.getCustomerDashboard(),
        api.getCustomerProjects().catch(() => []),
        api.getCustomerAppointments().catch(() => []),
        api.getCustomerServiceTickets().catch(() => []),
        api.getCustomerFeedback().catch(() => []),
      ]);

      setData(dash);
      setProjectsList(projects);
      if (projects.length > 0) {
        setSelectedProject(projects[0]);
      }
      setAppointmentsList(apts);
      setServiceTickets(tickets);
      setFeedbackList(fbs);

      if (dash?.customer) {
        setLeadForm((prev) => ({
          ...prev,
          customer_name: dash.customer.name || prev.customer_name,
          mobile_number: dash.customer.phone || prev.mobile_number,
          email: dash.customer.email || prev.email,
          installation_address: dash.customer.installation_address || dash.customer.address || prev.installation_address,
        }));
      }

      if (dash?.passport) {
        setVerifiedPassport(dash.passport);
      }
    } catch (err) {
      console.error('Customer dashboard load error:', err);
      setError(err.message || 'Failed to synchronize with SunPower central backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [refreshTrigger]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboardData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // CAMERA STREAM MANAGEMENT
  // ---------------------------------------------------------------------------
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Device camera not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Live camera stream error, falling back to file input:', err.message);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setServicePhotoPreview(dataUrl);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `evidence_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setServicePhotoFile(file);
      }
    }, 'image/jpeg', 0.85);

    stopCamera();
  };

  // ---------------------------------------------------------------------------
  // MODULE 1: SUBMIT LEAD REQUIREMENT FORM
  // ---------------------------------------------------------------------------
  const handleSubmitLeadForm = async (e) => {
    e.preventDefault();
    if (!leadForm.customer_name.trim() || !leadForm.mobile_number.trim() || !leadForm.installation_address.trim()) {
      alert('Please fill in Customer Name, Mobile Number, and Installation Address.');
      return;
    }

    setLeadSubmitting(true);
    setLeadSuccessResult(null);
    try {
      const payload = {
        customer_name: leadForm.customer_name.trim(),
        mobile_number: leadForm.mobile_number.trim(),
        email: leadForm.email.trim() || undefined,
        installation_address: leadForm.installation_address.trim(),
        customer_type: leadForm.customer_type,
        solar_preference: leadForm.solar_preference,
        approximate_capacity: leadForm.approximate_capacity,
        additional_remarks: leadForm.additional_remarks
          ? `${leadForm.additional_remarks} | Roof: ${leadForm.roof_surface} (${leadForm.roof_area_sqft} sqft) | Monthly Bill: ₹${leadForm.monthly_bill_inr}`
          : `Roof: ${leadForm.roof_surface} (${leadForm.roof_area_sqft} sqft) | Monthly Bill: ₹${leadForm.monthly_bill_inr}`,
        preferred_survey_date: leadForm.preferred_survey_date || undefined,
        preferred_time_window: leadForm.preferred_time_window || '10:00 - 12:00',
        alternative_preferred_date: leadForm.alternative_preferred_date || undefined,
        access_instructions: leadForm.access_instructions || undefined,
      };

      const res = await api.submitInstallationRequest(payload);
      setLeadSuccessResult(res);
      await loadDashboardData();
    } catch (err) {
      alert(err.message || 'Failed to submit solar lead requirement. Please check your inputs.');
    } finally {
      setLeadSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 3: DIGITAL PASSPORT QR VERIFICATION
  // ---------------------------------------------------------------------------
  const handleVerifyPassport = async (candidateToken) => {
    const token = (candidateToken || qrTokenInput || data?.passport?.qr_code_token || 'DSP-MH-2026-0081').trim();
    if (!token) {
      alert('Please enter a Passport Number, QR token, or scan a valid QR code.');
      return;
    }

    setQrScanLoading(true);
    setQrScanError(null);
    try {
      const res = await api.verifyCustomerPassportQr(token);
      if (res && res.valid) {
        setVerifiedPassport(res);
        setQrTokenInput('');
        stopCamera();
      } else {
        throw new Error('Passport reference invalid or not recognized.');
      }
    } catch (err) {
      setQrScanError(err.message || 'Invalid or unrecognized SunPower Digital Passport.');
    } finally {
      setQrScanLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 3: SUBMIT SERVICE BOOKING
  // ---------------------------------------------------------------------------
  const handleBookService = async (e) => {
    e.preventDefault();
    if (serviceDesc.trim().length < 5) {
      alert('Please provide at least 5 characters describing the service issue.');
      return;
    }

    setServiceSubmitting(true);
    setServiceSuccessMsg('');
    try {
      const payload = {
        issue_category: serviceCategory,
        description: serviceDesc.trim(),
        order_id: selectedProject?.id || selectedProject?.order_id || data?.active_project?.order_id,
        passport_id: verifiedPassport?.id || verifiedPassport?.passport_id || data?.passport?.id,
        preferred_visit_date: serviceVisitDate || undefined,
        preferred_time_slot: serviceVisitSlot || undefined,
        service_type: 'SERVICE_VISIT',
      };

      const res = await api.createCustomerServiceTicket(payload);

      if (servicePhotoFile && res.ticket_id) {
        const formData = new FormData();
        formData.append('file', servicePhotoFile);
        formData.append('description', `Service request photo: ${serviceCategory}`);
        await api.uploadComplaintEvidence(res.ticket_id, formData).catch(() => {});
      }

      setServiceSuccessMsg(`Service ticket #${res.ticket_number} scheduled successfully! Central O&M dispatch team notified.`);
      await loadDashboardData();
      setTimeout(() => {
        setActiveModal(null);
        setServiceSuccessMsg('');
        setServiceDesc('');
        setServicePhotoFile(null);
        setServicePhotoPreview(null);
      }, 2000);
    } catch (err) {
      alert(err.message || 'Failed to schedule service visit.');
    } finally {
      setServiceSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 3: SUBMIT APPOINTMENT REGISTRATION
  // ---------------------------------------------------------------------------
  const handleRegisterAppointment = async (e) => {
    e.preventDefault();
    if (!aptDate || !aptSlot) {
      alert('Please select both a date and time slot.');
      return;
    }

    setAptSubmitting(true);
    setAptSuccessMsg('');
    try {
      const payload = {
        appointment_type: aptType,
        scheduled_date: aptDate,
        time_slot: aptSlot,
        customer_notes: aptNotes.trim() || undefined,
        order_id: selectedProject?.id || selectedProject?.order_id || data?.active_project?.order_id,
      };

      const res = await api.bookCustomerAppointment(payload);
      setAptSuccessMsg(`Appointment #${res.appointment_number} registered for ${aptDate} (${aptSlot})!`);
      await loadDashboardData();
      setTimeout(() => {
        setActiveModal(null);
        setAptSuccessMsg('');
        setAptNotes('');
      }, 2000);
    } catch (err) {
      alert(err.message || 'Failed to book appointment.');
    } finally {
      setAptSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 3: SUBMIT COMPLAINT LOGGING
  // ---------------------------------------------------------------------------
  const handleLogComplaint = async (e) => {
    e.preventDefault();
    if (complaintDesc.trim().length < 5) {
      alert('Please provide at least 5 characters describing your complaint.');
      return;
    }

    setComplaintSubmitting(true);
    setComplaintSuccessMsg('');
    try {
      const payload = {
        issue_category: complaintCategory,
        description: complaintDesc.trim(),
        order_id: selectedProject?.id || selectedProject?.order_id || data?.active_project?.order_id,
        passport_id: verifiedPassport?.id || verifiedPassport?.passport_id || data?.passport?.id,
        preferred_visit_date: complaintDate || undefined,
        service_type: 'COMPLAINT',
      };

      const res = await api.createCustomerServiceTicket(payload);

      setComplaintSuccessMsg(`Complaint #${res.ticket_number} registered! A senior customer success manager is assigned.`);
      await loadDashboardData();
      setTimeout(() => {
        setActiveModal(null);
        setComplaintSuccessMsg('');
        setComplaintDesc('');
      }, 2000);
    } catch (err) {
      alert(err.message || 'Failed to register complaint.');
    } finally {
      setComplaintSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 4: SUBMIT TEXT-FORMAT FEEDBACK
  // ---------------------------------------------------------------------------
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    const commentText = feedbackTab === 'PRODUCT' ? productReviewText.trim() : technicianReviewText.trim();
    if (!commentText || commentText.length < 5) {
      alert('Please provide a detailed written feedback review in text format (minimum 5 characters).');
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackSuccessMsg('');
    try {
      await api.submitCustomerFeedback({
        feedback_type: feedbackTab,
        rating: feedbackRating,
        category_ratings: feedbackSubRatings,
        comments: commentText,
        order_id: selectedProject?.id || selectedProject?.order_id || data?.active_project?.order_id,
      });

      setFeedbackSuccessMsg('Thank you! Your verified written feedback has been recorded into the central audit registry.');
      await loadDashboardData();
      setTimeout(() => {
        setFeedbackSuccessMsg('');
        if (feedbackTab === 'PRODUCT') setProductReviewText('');
        else setTechnicianReviewText('');
      }, 2200);
    } catch (err) {
      alert(err.message || 'Failed to submit feedback.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={28} className="loading-spinner" style={{ margin: '0 auto 1rem', color: '#059669' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Synchronizing Customer Web Workspace...</h3>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.3rem' }}>Connecting to SunPower Central EPC Network</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', textAlign: 'center', borderColor: '#fecaca', background: '#fef2f2' }}>
        <AlertTriangle size={36} style={{ color: '#dc2626', margin: '0 auto 0.75rem' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#991b1b' }}>Synchronization Error</h3>
        <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: '0.5rem 0 1.25rem' }}>{error}</p>
        <button onClick={loadDashboardData} className="btn btn-primary btn-sm" style={{ background: '#059669' }}>
          <RefreshCw size={14} /> Retry Connection
        </button>
      </div>
    );
  }

  const activeProj = data?.active_project || {};
  const passport = verifiedPassport || data?.passport;

  // Common input style
  const inputStyle = {
    width: '100%',
    height: '38px',
    padding: '0.45rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.85rem',
    background: '#ffffff',
    color: '#0f172a',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#334155',
    marginBottom: '0.3rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ===================================================================== */}
      {/* TOP EXECUTIVE HEADER BANNER                                           */}
      {/* ===================================================================== */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
        padding: '1.5rem 2rem',
        borderRadius: '12px',
        color: '#ffffff',
        border: '1px solid #059669',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 4px 12px rgba(6, 78, 59, 0.15)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Customer Web Portal
            </span>
            <span style={{
              background: 'rgba(52, 211, 153, 0.2)',
              color: '#34d399',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              border: '1px solid rgba(52, 211, 153, 0.3)'
            }}>
              Live EPC Workspace
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.15rem 0' }}>
            Welcome, {data?.customer?.name || user?.full_name || 'Rajesh Sharma'}
          </h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1' }}>
            Consumer No: <strong style={{ color: '#ffffff' }}>{data?.customer?.consumer_number || 'MSEDCL-PUN-849201'}</strong> ({data?.customer?.city || 'Pune'}) · Discom: Maharashtra State Electricity Distribution
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleRefresh}
            className="btn btn-secondary btn-sm"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)' }}
            disabled={isRefreshing}
            title="Refresh live data"
          >
            <RefreshCw size={13} className={isRefreshing ? 'loading-spinner' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4 PRIMARY WEB MODULE TABS STRIP                                       */}
      {/* ===================================================================== */}
      <div className="card" style={{ padding: '0.5rem 0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', flexWrap: 'wrap' }}>
          {[
            { id: 'lead', label: '1. Dashboard & Lead Form', icon: Sun },
            { id: 'projects', label: '2. My Projects', icon: Layers, badge: projectsList.length || 1 },
            { id: 'passport', label: '3. Digital Passport & Scanner', icon: QrCode },
            { id: 'feedback', label: '4. Feedback Collection', icon: Star, badge: feedbackList.length || 0 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: isActive ? '#059669' : '#ffffff',
                  color: isActive ? '#ffffff' : '#334155',
                  borderColor: isActive ? '#059669' : '#cbd5e1',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                    color: isActive ? '#ffffff' : '#475569',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    marginLeft: '0.2rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODULE 1: DASHBOARD & LEAD REQUIREMENT FILLING FORM                    */}
      {/* ===================================================================== */}
      {activeTab === 'lead' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Executive KPI Stats Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #059669' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Subscribed Projects</span>
                <Boxes size={17} style={{ color: '#059669' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                {projectsList.length || 1}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Rooftop Active</span>
            </div>

            <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Installed Capacity</span>
                <Sun size={17} style={{ color: '#0284c7' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0284c7' }}>
                {activeProj.system_capacity_kw || 5.5} kWp
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Waaree Tier-1 Bifacial</span>
            </div>

            <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Clean Generation</span>
                <Zap size={17} style={{ color: '#f59e0b' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                {passport?.lifetime_mwh || 187.5} MWh
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Lifetime Solar Yield</span>
            </div>

            <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>System Health Score</span>
                <CheckCircle2 size={17} style={{ color: '#10b981' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981' }}>
                {passport?.system_health_score || 98}%
              </div>
              <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Grid Synced & Optimal</span>
            </div>

            <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #d97706', background: '#fffbeb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#92400e', fontWeight: 600 }}>PM Surya Ghar Subsidy</span>
                <Award size={17} style={{ color: '#d97706' }} />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#b45309' }}>
                ₹78,000
              </div>
              <span style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600 }}>Approved Direct DBT</span>
            </div>
          </div>

          {/* Sizing Calculator & New Solar Lead Requirement Form (2 Columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.25rem', alignItems: 'flex-start' }}>
            
            {/* Form Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sun size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                      Create New Solar Lead / Sizing Requirement
                    </h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                      Submit your rooftop sizing requirements to schedule an authorized engineering site survey
                    </p>
                  </div>
                </div>
                <span className="badge badge-success" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}>
                  Free Site Audit
                </span>
              </div>

              {leadSuccessResult ? (
                <div style={{ padding: '1.5rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', textAlign: 'center' }}>
                  <CheckCircle2 size={40} style={{ color: '#059669', margin: '0 auto 0.75rem' }} />
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#064e3b', margin: '0 0 0.5rem' }}>
                    Solar Lead & Survey Appointment Registered!
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: '#047857', maxWidth: '500px', margin: '0 auto 1rem', lineHeight: 1.5 }}>
                    {leadSuccessResult.message}
                  </p>
                  <div style={{ display: 'inline-flex', gap: '1.5rem', padding: '0.6rem 1.25rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #a7f3d0', fontSize: '0.8rem', fontFamily: 'monospace', marginBottom: '1rem' }}>
                    <div>Enquiry: <strong style={{ color: '#059669' }}>{leadSuccessResult.enquiry_number || 'ENQ-2026-AUTO'}</strong></div>
                    <div>Appointment: <strong style={{ color: '#059669' }}>{leadSuccessResult.appointment_number}</strong></div>
                  </div>
                  <div>
                    <button
                      onClick={() => setLeadSuccessResult(null)}
                      className="btn btn-primary btn-sm"
                      style={{ background: '#059669' }}
                    >
                      Fill Another Sizing Requirement
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitLeadForm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                    <div>
                      <label style={labelStyle}>Customer Name *</label>
                      <input
                        type="text"
                        required
                        value={leadForm.customer_name}
                        onChange={(e) => setLeadForm({ ...leadForm, customer_name: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Mobile Contact *</label>
                      <input
                        type="tel"
                        required
                        value={leadForm.mobile_number}
                        onChange={(e) => setLeadForm({ ...leadForm, mobile_number: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Email Address</label>
                      <input
                        type="email"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem' }}>
                    <div>
                      <label style={labelStyle}>Property Type</label>
                      <select
                        value={leadForm.customer_type}
                        onChange={(e) => setLeadForm({ ...leadForm, customer_type: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="Residential">Residential Rooftop</option>
                        <option value="Commercial">Commercial Enterprise</option>
                        <option value="Industrial">Industrial Facility</option>
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Monthly Bill (₹)</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b', fontWeight: 700 }}>₹</span>
                        <input
                          type="number"
                          value={leadForm.monthly_bill_inr}
                          onChange={(e) => setLeadForm({ ...leadForm, monthly_bill_inr: e.target.value })}
                          style={{ ...inputStyle, paddingLeft: '1.75rem', fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Recommended Sizing</label>
                      <input
                        type="text"
                        value={leadForm.approximate_capacity}
                        onChange={(e) => setLeadForm({ ...leadForm, approximate_capacity: e.target.value })}
                        style={{ ...inputStyle, fontWeight: 800, color: '#059669', background: '#ecfdf5', borderColor: '#10b981' }}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Solar Type</label>
                      <select
                        value={leadForm.solar_preference}
                        onChange={(e) => setLeadForm({ ...leadForm, solar_preference: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="On-Grid">On-Grid (Net Meter)</option>
                        <option value="Off-Grid">Off-Grid (Battery)</option>
                        <option value="Hybrid">Hybrid Microgrid</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div>
                      <label style={labelStyle}>Roof Surface Type</label>
                      <select
                        value={leadForm.roof_surface}
                        onChange={(e) => setLeadForm({ ...leadForm, roof_surface: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="RCC Flat Terrace">RCC Flat Terrace</option>
                        <option value="Sloped Metal Sheet">Sloped Metal Sheet (Industrial)</option>
                        <option value="Mangalore Clay Tile">Mangalore Clay Tile</option>
                        <option value="Ground Mount">Ground Mount Yard</option>
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Approx Roof Area (sq. ft.)</label>
                      <input
                        type="number"
                        value={leadForm.roof_area_sqft}
                        onChange={(e) => setLeadForm({ ...leadForm, roof_area_sqft: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Installation Site Address *</label>
                    <input
                      type="text"
                      required
                      value={leadForm.installation_address}
                      onChange={(e) => setLeadForm({ ...leadForm, installation_address: e.target.value })}
                      style={inputStyle}
                      placeholder="Street, locality, city, pincode"
                    />
                  </div>

                  {/* Survey Scheduling Section */}
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                      <Calendar size={15} style={{ color: '#059669' }} />
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Schedule Preferred Site Survey Slot</strong>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Preferred Date</label>
                        <input
                          type="date"
                          value={leadForm.preferred_survey_date}
                          onChange={(e) => setLeadForm({ ...leadForm, preferred_survey_date: e.target.value })}
                          style={{ ...inputStyle, height: '34px' }}
                        />
                      </div>

                      <div>
                        <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Time Window</label>
                        <select
                          value={leadForm.preferred_time_window}
                          onChange={(e) => setLeadForm({ ...leadForm, preferred_time_window: e.target.value })}
                          style={{ ...inputStyle, height: '34px' }}
                        >
                          <option value="09:00 - 11:00">Morning (09:00 - 11:00)</option>
                          <option value="10:00 - 12:00">Late Morning (10:00 - 12:00)</option>
                          <option value="14:00 - 16:00">Afternoon (14:00 - 16:00)</option>
                          <option value="16:00 - 18:00">Evening (16:00 - 18:00)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Alternative Date</label>
                        <input
                          type="date"
                          value={leadForm.alternative_preferred_date}
                          onChange={(e) => setLeadForm({ ...leadForm, alternative_preferred_date: e.target.value })}
                          style={{ ...inputStyle, height: '34px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      type="submit"
                      disabled={leadSubmitting}
                      className="btn btn-primary"
                      style={{ background: '#059669', padding: '0.6rem 1.5rem', fontSize: '0.88rem', fontWeight: 700 }}
                    >
                      {leadSubmitting ? (
                        <>
                          <RefreshCw size={15} className="loading-spinner" />
                          <span>Submitting Sizing Form...</span>
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>Submit Requirement & Book Survey</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Sizing & Benefits Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.25rem', borderTop: '4px solid #059669' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0f172a' }}>
                  <Award size={16} style={{ color: '#059669' }} />
                  <span>PM Surya Ghar Subsidy Guide</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                  <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <strong>1 kW to 2 kW Systems:</strong>
                    <div style={{ color: '#059669', fontWeight: 700, marginTop: '2px' }}>₹30,000 to ₹60,000 Direct DBT</div>
                  </div>
                  <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <strong>3 kW and Above:</strong>
                    <div style={{ color: '#059669', fontWeight: 700, marginTop: '2px' }}>₹78,000 Maximum Subsidy</div>
                  </div>
                  <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <strong>Net Metering:</strong>
                    <div style={{ color: '#0284c7', fontWeight: 700, marginTop: '2px' }}>MSEDCL Bi-directional Solar Metering</div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem', borderTop: '4px solid #0284c7' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0f172a' }}>
                  <ShieldCheck size={16} style={{ color: '#0284c7' }} />
                  <span>SunPower Warranty Guarantee</span>
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
                  All systems installed by SunPower Solutions include verified serial numbers and digital passport activation:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <span style={{ color: '#059669', fontWeight: 600 }}>✓ 25-Year Linear Power Warranty</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>✓ 10-Year Inverter Replacement Warranty</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>✓ 5-Year Rooftop Workmanship Guarantee</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODULE 2: MY PROJECTS SCREEN                                          */}
      {/* ===================================================================== */}
      {activeTab === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Subscribed Projects Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {projectsList.map((p) => {
              const isSelected = selectedProject?.id === p.id || selectedProject?.order_id === p.order_id;
              return (
                <div
                  key={p.id || p.order_id}
                  className="card"
                  onClick={() => setSelectedProject(p)}
                  style={{
                    padding: '1.25rem',
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #059669' : '1px solid #e2e8f0',
                    background: isSelected ? '#f0fdf4' : '#ffffff',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                        {p.order_number || `#ORD-${p.id || p.order_id}`}
                      </span>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0.3rem 0 0', color: '#0f172a' }}>
                        {p.system_capacity_kw || p.capacity_kw || 5.5} kWp Solar Rooftop
                      </h4>
                    </div>
                    <span className={`badge ${p.stage === 'COMMISSIONED' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.7rem' }}>
                      {p.stage || 'ACTIVE'}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.85rem' }}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />
                    {p.installation_address || p.address || 'Baner Road, Pune'}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                    <span style={{ color: '#64748b' }}>Contract Value: <strong style={{ color: '#0f172a' }}>₹{(p.contract_value_inr || 320000).toLocaleString()}</strong></span>
                    <span style={{ color: '#059669', fontWeight: 700 }}>{isSelected ? '✓ Viewing Details' : 'Click to View'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Project Milestone & BOM Details */}
          {selectedProject && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Project Lifecycle: {selectedProject.order_number || `#ORD-${selectedProject.id || selectedProject.order_id}`}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Authoritative tracking across all 8 EPC deployment milestones
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleTabChange('passport')}
                    className="btn btn-primary btn-sm"
                    style={{ background: '#059669' }}
                  >
                    <QrCode size={13} /> View Digital Passport
                  </button>
                </div>
              </div>

              {/* 8 Customer-Facing Milestones Visual Tracker */}
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  8 Customer-Facing EPC Milestones
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  {[
                    { step: 1, name: 'Feasibility Survey', done: true, date: 'Completed' },
                    { step: 2, name: 'Design & Quotation', done: true, date: 'Approved' },
                    { step: 3, name: 'Contract Booking', done: true, date: 'Confirmed' },
                    { step: 4, name: 'BOM Procurement', done: true, date: 'Allocated' },
                    { step: 5, name: 'On-Site Dispatch', done: true, date: 'Dispatched' },
                    { step: 6, name: 'Rooftop EPC', done: selectedProject.stage === 'COMMISSIONED', date: selectedProject.stage === 'COMMISSIONED' ? 'Complete' : 'In Progress' },
                    { step: 7, name: 'Net-Meter Discom', done: selectedProject.stage === 'COMMISSIONED', date: selectedProject.stage === 'COMMISSIONED' ? 'Synced' : 'Pending' },
                    { step: 8, name: 'Digital Passport', done: selectedProject.stage === 'COMMISSIONED', date: selectedProject.stage === 'COMMISSIONED' ? 'Handed Over' : 'Awaiting' },
                  ].map((m) => (
                    <div
                      key={m.step}
                      style={{
                        padding: '0.75rem',
                        background: m.done ? '#f0fdf4' : '#f8fafc',
                        border: m.done ? '1px solid #86efac' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: m.done ? '#059669' : '#cbd5e1',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        margin: '0 auto 0.4rem'
                      }}>
                        {m.done ? '✓' : m.step}
                      </div>
                      <strong style={{ fontSize: '0.75rem', display: 'block', color: m.done ? '#065f46' : '#334155' }}>
                        {m.name}
                      </strong>
                      <span style={{ fontSize: '0.68rem', color: m.done ? '#059669' : '#94a3b8' }}>
                        {m.date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Installed BOM Components Table */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Installed Bill of Materials & Hardware Serials
                </h4>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Hardware Component</th>
                        <th>Category</th>
                        <th>Serial Number</th>
                        <th>Status</th>
                        <th>Warranty Protection</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.installed_hardware || [
                        { name: 'Sungrow SG5.0RS Residential Inverter 5kW', category: 'INVERTER', serial: 'SNG-5K-2026-90412', status: 'ACTIVE', warranty: '10 Years Replacement' },
                        { name: 'Waaree Bi-550 Bifacial Dual Glass Panel #1', category: 'PANEL', serial: 'WRE-550-2026A-001', status: 'ACTIVE', warranty: '25 Years Linear Performance' },
                        { name: 'Waaree Bi-550 Bifacial Dual Glass Panel #2', category: 'PANEL', serial: 'WRE-550-2026A-002', status: 'ACTIVE', warranty: '25 Years Linear Performance' },
                        { name: 'Waaree Bi-550 Bifacial Dual Glass Panel #3', category: 'PANEL', serial: 'WRE-550-2026A-003', status: 'ACTIVE', warranty: '25 Years Linear Performance' },
                        { name: 'Waaree Bi-550 Bifacial Dual Glass Panel #4', category: 'PANEL', serial: 'WRE-550-2026A-004', status: 'ACTIVE', warranty: '25 Years Linear Performance' },
                        { name: 'Waaree Bi-550 Bifacial Dual Glass Panel #5', category: 'PANEL', serial: 'WRE-550-2026A-005', status: 'ACTIVE', warranty: '25 Years Linear Performance' },
                      ]).map((hw, idx) => (
                        <tr key={idx}>
                          <td><strong>{hw.component_name || hw.name}</strong></td>
                          <td><span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>{hw.category}</span></td>
                          <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{hw.serial_number || hw.serial}</span></td>
                          <td><span className="badge badge-success" style={{ fontSize: '0.68rem' }}>{hw.status}</span></td>
                          <td style={{ color: '#059669', fontSize: '0.78rem', fontWeight: 600 }}>{hw.warranty || '25-Year Performance'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ===================================================================== */}
      {/* MODULE 3: DIGITAL PASSPORT QR SCANNER & DOWNSTREAM SERVICES           */}
      {/* ===================================================================== */}
      {activeTab === 'passport' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Scanner & Manual Query Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Digital Solar Passport Scanner & Lookup
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Scan the physical QR code on your solar inverter or enter your Passport Number to access verified warranties
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleVerifyPassport('DSP-MH-2026-0081')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', fontWeight: 600 }}
                >
                  ⚡ Load Demo Passport (DSP-MH-2026-0081)
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'flex-start' }}>
              {/* Input Search Form */}
              <div>
                <label style={labelStyle}>Enter Passport ID or Scanned QR Token</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={qrTokenInput}
                    onChange={(e) => setQrTokenInput(e.target.value)}
                    placeholder="e.g. DSP-MH-2026-0081"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => handleVerifyPassport()}
                    disabled={qrScanLoading}
                    className="btn btn-primary btn-sm"
                    style={{ background: '#059669', padding: '0 1rem', whiteSpace: 'nowrap' }}
                  >
                    {qrScanLoading ? 'Verifying...' : 'Verify Passport'}
                  </button>
                </div>
                {qrScanError && (
                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.4rem' }}>{qrScanError}</p>
                )}

                <div style={{ marginTop: '1rem' }}>
                  <button
                    onClick={isCameraActive ? stopCamera : startCamera}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Camera size={14} />
                    <span>{isCameraActive ? 'Stop Camera' : 'Open Camera Viewfinder'}</span>
                  </button>
                </div>
              </div>

              {/* Camera Video Viewfinder */}
              {isCameraActive && (
                <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                  <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: '200px', borderRadius: '6px', objectFit: 'cover' }} />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <button onClick={capturePhoto} className="btn btn-primary btn-sm" style={{ background: '#059669' }}>
                      Capture QR
                    </button>
                    <button onClick={stopCamera} className="btn btn-secondary btn-sm">
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Verified Digital Passport Certificate */}
          {passport && (
            <div className="card" style={{ padding: '1.75rem', border: '2px solid #059669', background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {/* SVG QR Code */}
                  <div style={{ padding: '0.6rem', background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                    <svg width="90" height="90" viewBox="0 0 100 100">
                      <rect width="100" height="100" fill="#ffffff" />
                      {/* Standard QR Code Matrix Simulation */}
                      <rect x="5" y="5" width="28" height="28" fill="#064e3b" />
                      <rect x="9" y="9" width="20" height="20" fill="#ffffff" />
                      <rect x="13" y="13" width="12" height="12" fill="#064e3b" />
                      <rect x="67" y="5" width="28" height="28" fill="#064e3b" />
                      <rect x="71" y="9" width="20" height="20" fill="#ffffff" />
                      <rect x="75" y="13" width="12" height="12" fill="#064e3b" />
                      <rect x="5" y="67" width="28" height="28" fill="#064e3b" />
                      <rect x="9" y="71" width="20" height="20" fill="#ffffff" />
                      <rect x="13" y="75" width="12" height="12" fill="#064e3b" />
                      <rect x="40" y="40" width="20" height="20" fill="#059669" />
                      <rect x="45" y="10" width="8" height="8" fill="#064e3b" />
                      <rect x="10" y="45" width="8" height="8" fill="#064e3b" />
                      <rect x="45" y="75" width="8" height="8" fill="#064e3b" />
                      <rect x="75" y="45" width="8" height="8" fill="#064e3b" />
                    </svg>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                        ✓ Cryptographically Verified
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Certificate: {passport.passport_number || 'DSP-MH-2026-0081'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                      Digital Solar Passport Certificate
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>
                      Installed at: {passport.site_address || 'Baner Road, Pune'} · Commissioned on 2026-10-31
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                    {passport.system_capacity_kw || 5.5} kWp
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>On-Grid Solar System</span>
                </div>
              </div>

              {/* Warranties Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '0.85rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>
                    <ShieldCheck size={16} />
                    <span>25-Year Panel Warranty</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                    Waaree Bi-550 Linear Performance Protection (90% at 10 yrs, 80% at 25 yrs)
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0284c7', fontWeight: 700, fontSize: '0.85rem' }}>
                    <ShieldCheck size={16} />
                    <span>10-Year Inverter Warranty</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                    Sungrow SG5.0RS Full Hardware Replacement Protection
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#d97706', fontWeight: 700, fontSize: '0.85rem' }}>
                    <ShieldCheck size={16} />
                    <span>5-Year Workmanship</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                    SunPower Solutions EPC Structural & Mechanical Mounting Warranty
                  </div>
                </div>
              </div>

              {/* Downstream Actions Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                  Authorized Customer Downstream Services:
                </span>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActiveModal('service_booking')}
                    className="btn btn-primary btn-sm"
                    style={{ background: '#059669' }}
                  >
                    <Wrench size={13} /> Book Service Visit
                  </button>
                  <button
                    onClick={() => setActiveModal('appointment_reg')}
                    className="btn btn-secondary btn-sm"
                  >
                    <Calendar size={13} /> Schedule Appointment
                  </button>
                  <button
                    onClick={() => setActiveModal('complaint')}
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    <AlertTriangle size={13} /> Log Formal Complaint
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ===================================================================== */}
      {/* MODULE 4: FEEDBACK COLLECTION (TEXT FORMAT)                           */}
      {/* ===================================================================== */}
      {activeTab === 'feedback' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr', gap: '1.25rem', alignItems: 'flex-start' }}>
            
            {/* Feedback Form Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Customer Feedback & Quality Review
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Submit verbatim reviews in text format for hardware performance and technician workmanship
                </p>
              </div>

              {/* Sub-tab Switcher: Product vs Technician */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setFeedbackTab('PRODUCT')}
                  className={`btn btn-sm ${feedbackTab === 'PRODUCT' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ background: feedbackTab === 'PRODUCT' ? '#059669' : '#ffffff' }}
                >
                  <Sun size={13} /> Product & Hardware Review
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackTab('TECHNICIAN')}
                  className={`btn btn-sm ${feedbackTab === 'TECHNICIAN' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ background: feedbackTab === 'TECHNICIAN' ? '#059669' : '#ffffff' }}
                >
                  <Wrench size={13} /> Technician Workmanship Review
                </button>
              </div>

              {feedbackSuccessMsg && (
                <div style={{ padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  ✓ {feedbackSuccessMsg}
                </div>
              )}

              <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Star Rating Selector */}
                <div>
                  <label style={labelStyle}>Overall Rating (1 - 5 Stars)</label>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.2rem',
                          color: star <= feedbackRating ? '#f59e0b' : '#cbd5e1'
                        }}
                      >
                        <Star size={24} fill={star <= feedbackRating ? '#f59e0b' : 'none'} />
                      </button>
                    ))}
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b', marginLeft: '0.5rem' }}>
                      {feedbackRating} / 5 Stars
                    </span>
                  </div>
                </div>

                {/* Multi-line Written Review in Text Format */}
                <div>
                  <label style={labelStyle}>
                    {feedbackTab === 'PRODUCT'
                      ? 'Detailed Product Review (Panels, Inverter & Generation) *'
                      : 'Detailed Technician Workmanship Review (Punctuality, Quality & Safety) *'}
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={feedbackTab === 'PRODUCT' ? productReviewText : technicianReviewText}
                    onChange={(e) => {
                      if (feedbackTab === 'PRODUCT') setProductReviewText(e.target.value);
                      else setTechnicianReviewText(e.target.value);
                    }}
                    placeholder={
                      feedbackTab === 'PRODUCT'
                        ? 'Describe your experience with solar generation yield, panel appearance, inverter app sync, and overall equipment satisfaction...'
                        : 'Describe your experience with the technician crew, punctuality, site safety, structural installation quality, and clean-up...'
                    }
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      outline: 'none',
                      lineHeight: 1.4
                    }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Minimum 5 characters required for authoritative registry.</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={feedbackSubmitting}
                    className="btn btn-primary"
                    style={{ background: '#059669', padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    {feedbackSubmitting ? 'Recording Feedback...' : 'Submit Written Review'}
                  </button>
                </div>
              </form>
            </div>

            {/* Review History Cards */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
                Your Submitted Reviews ({feedbackList.length})
              </h4>

              {feedbackList.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.82rem' }}>No feedback submissions yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                  {feedbackList.map((f, idx) => (
                    <div key={idx} style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                          {f.feedback_type || f.type || 'PRODUCT'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#f59e0b' }}>
                          <Star size={13} fill="#f59e0b" />
                          <strong style={{ fontSize: '0.75rem' }}>{f.rating} / 5</strong>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#334155', margin: '0 0 0.35rem', fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{f.comments || f.comment}"
                      </p>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        {f.created_at ? new Date(f.created_at).toLocaleDateString() : 'Verified Review'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* DOWNSTREAM WORKFLOW MODALS                                            */}
      {/* ===================================================================== */}
      {activeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                {activeModal === 'service_booking' && 'Schedule Solar Service Visit'}
                {activeModal === 'appointment_reg' && 'Register Field Appointment'}
                {activeModal === 'complaint' && 'Log Formal Customer Complaint'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Service Booking Modal Form */}
            {activeModal === 'service_booking' && (
              <form onSubmit={handleBookService} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {serviceSuccessMsg && (
                  <div style={{ padding: '0.6rem', background: '#ecfdf5', color: '#047857', borderRadius: '6px', fontSize: '0.8rem' }}>
                    {serviceSuccessMsg}
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Issue Category</label>
                  <select
                    value={serviceCategory}
                    onChange={(e) => setServiceCategory(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="GENERAL_MAINTENANCE">General Maintenance & Cleaning</option>
                    <option value="INVERTER_FAULT">Inverter Error Code / Disconnect</option>
                    <option value="GENERATION_DROP">Generation Output Drop</option>
                    <option value="ELECTRICAL_WIRING">Electrical Wiring / Earthing Check</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={serviceDesc}
                    onChange={(e) => setServiceDesc(e.target.value)}
                    placeholder="Describe the issue observed..."
                    style={{ ...inputStyle, height: 'auto' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Preferred Date</label>
                    <input
                      type="date"
                      value={serviceVisitDate}
                      onChange={(e) => setServiceVisitDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Time Slot</label>
                    <select
                      value={serviceVisitSlot}
                      onChange={(e) => setServiceVisitSlot(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="09:00 - 11:00">09:00 - 11:00</option>
                      <option value="10:00 - 12:00">10:00 - 12:00</option>
                      <option value="14:00 - 16:00">14:00 - 16:00</option>
                      <option value="16:00 - 18:00">16:00 - 18:00</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={serviceSubmitting} className="btn btn-primary btn-sm" style={{ background: '#059669' }}>
                    {serviceSubmitting ? 'Booking...' : 'Confirm Service Request'}
                  </button>
                </div>
              </form>
            )}

            {/* Appointment Modal Form */}
            {activeModal === 'appointment_reg' && (
              <form onSubmit={handleRegisterAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {aptSuccessMsg && (
                  <div style={{ padding: '0.6rem', background: '#ecfdf5', color: '#047857', borderRadius: '6px', fontSize: '0.8rem' }}>
                    {aptSuccessMsg}
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Appointment Type</label>
                  <select
                    value={aptType}
                    onChange={(e) => setAptType(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="SERVICE">Service & Repair Visit</option>
                    <option value="MAINTENANCE">Scheduled Preventive Maintenance</option>
                    <option value="SITE_SURVEY">Site Inspection & Survey</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Scheduled Date *</label>
                    <input
                      type="date"
                      required
                      value={aptDate}
                      onChange={(e) => setAptDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Time Slot *</label>
                    <select
                      value={aptSlot}
                      onChange={(e) => setAptSlot(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="09:00 - 11:00">09:00 - 11:00</option>
                      <option value="10:00 - 12:00">10:00 - 12:00</option>
                      <option value="14:00 - 16:00">14:00 - 16:00</option>
                      <option value="16:00 - 18:00">16:00 - 18:00</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Customer Notes</label>
                  <input
                    type="text"
                    value={aptNotes}
                    onChange={(e) => setAptNotes(e.target.value)}
                    placeholder="e.g. Please call 30 mins before arrival"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={aptSubmitting} className="btn btn-primary btn-sm" style={{ background: '#059669' }}>
                    {aptSubmitting ? 'Registering...' : 'Register Appointment'}
                  </button>
                </div>
              </form>
            )}

            {/* Formal Complaint Modal Form */}
            {activeModal === 'complaint' && (
              <form onSubmit={handleLogComplaint} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {complaintSuccessMsg && (
                  <div style={{ padding: '0.6rem', background: '#ecfdf5', color: '#047857', borderRadius: '6px', fontSize: '0.8rem' }}>
                    {complaintSuccessMsg}
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Complaint Category</label>
                  <select
                    value={complaintCategory}
                    onChange={(e) => setComplaintCategory(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="WORKMANSHIP_ISSUE">Workmanship / Structure Flaw</option>
                    <option value="DELAY_ESCALATION">Service Delay Escalation</option>
                    <option value="BILLING_SUBSIDY">PM Surya Ghar Subsidy Dispute</option>
                    <option value="SAFETY_CONCERN">Safety Hazard Concern</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Detailed Complaint Description *</label>
                  <textarea
                    required
                    rows={4}
                    value={complaintDesc}
                    onChange={(e) => setComplaintDesc(e.target.value)}
                    placeholder="Provide details for senior management escalation..."
                    style={{ ...inputStyle, height: 'auto' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={complaintSubmitting} className="btn btn-primary btn-sm" style={{ background: '#dc2626' }}>
                    {complaintSubmitting ? 'Filing Complaint...' : 'File Formal Complaint'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
