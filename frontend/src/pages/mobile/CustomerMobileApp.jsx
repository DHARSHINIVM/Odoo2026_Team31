import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Sun, Shield, Calendar, Clock, MapPin, Phone, Mail, CheckCircle2,
  AlertCircle, ChevronRight, X, Camera, QrCode, Upload, Star,
  MessageSquare, RefreshCw, LogOut, ArrowRight, Check, AlertTriangle,
  Info, ExternalLink, HelpCircle, FileText, Zap, User, Settings,
  Bell, ChevronDown, Award, Send, Wrench, Eye, ArrowLeft,
  Smartphone, Share2, Layers, Cpu, Battery, Activity, CheckSquare,
  Plus, Filter, ThumbsUp, Radio, Search
} from 'lucide-react';

export default function CustomerMobileApp({ initialData, user, onRefresh }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Primary 5 Bottom-Navigation Tabs: 'home' | 'projects' | 'scan' | 'history' | 'profile'
  const [currentTab, setCurrentTab] = useState('home');

  // Live Backend Data
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Projects List & Selection
  const [projectsList, setProjectsList] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Appointments & History State
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('ALL'); // 'ALL' | 'SURVEY' | 'INSTALLATION' | 'SERVICE'
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(initialData?.unread_notifications_count || 0);

  // Service Tickets & Complaints List
  const [serviceTickets, setServiceTickets] = useState([]);

  // Customer Feedback List
  const [feedbackList, setFeedbackList] = useState([]);

  // Active Modals:
  // null | 'installation_request' | 'service_booking' | 'complaint' | 'feedback' |
  // 'reschedule_apt' | 'cancel_apt' | 'notifications' | 'edit_profile' | 'view_equipment' | 'view_warranty' | 'passport_ack'
  const [activeModal, setActiveModal] = useState(null);

  // Hardware Camera Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // ---------------------------------------------------------------------------
  // MODULE 2: INSTALLATION REQUEST & SURVEY BOOKING STATE
  // ---------------------------------------------------------------------------
  const [enquiryStep, setEnquiryStep] = useState(1); // 1: Details, 2: Survey Preferences, 3: Review
  const [enquiryForm, setEnquiryForm] = useState({
    customer_name: user?.full_name || initialData?.customer?.name || '',
    mobile_number: initialData?.customer?.phone || '',
    email: user?.email || initialData?.customer?.email || '',
    installation_address: initialData?.customer?.installation_address || initialData?.customer?.address || '',
    customer_type: 'Residential',
    solar_preference: 'On-Grid',
    approximate_capacity: '5 kW',
    additional_remarks: '',
    preferred_survey_date: '',
    preferred_time_window: '10:00 - 12:00',
    alternative_preferred_date: '',
    access_instructions: '',
  });
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);
  const [enquirySuccessResult, setEnquirySuccessResult] = useState(null);

  // ---------------------------------------------------------------------------
  // MODULE 4: DIGITAL PASSPORT QR SCANNER STATE
  // ---------------------------------------------------------------------------
  const [qrTokenInput, setQrTokenInput] = useState('');
  const [isScanningQrCamera, setIsScanningQrCamera] = useState(false);
  const [verifiedPassport, setVerifiedPassport] = useState(initialData?.passport || null);
  const [qrScanLoading, setQrScanLoading] = useState(false);
  const [qrScanError, setQrScanError] = useState(null);

  // ---------------------------------------------------------------------------
  // MODULE 5: SERVICE BOOKING & COMPLAINT REGISTRATION STATE
  // ---------------------------------------------------------------------------
  const [serviceCategory, setServiceCategory] = useState('GENERAL_MAINTENANCE');
  const [serviceDesc, setServiceDesc] = useState('');
  const [serviceEquipmentId, setServiceEquipmentId] = useState('');
  const [serviceSerial, setServiceSerial] = useState('');
  const [serviceVisitDate, setServiceVisitDate] = useState('');
  const [serviceVisitSlot, setServiceVisitSlot] = useState('10:00 - 12:00');
  const [servicePhotoFile, setServicePhotoFile] = useState(null);
  const [servicePhotoPreview, setServicePhotoPreview] = useState(null);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState('');

  // Complaint Specifics
  const [complaintCategory, setComplaintCategory] = useState('WORKMANSHIP_ISSUE');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintPreferredDate, setComplaintPreferredDate] = useState('');
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintSuccessMsg, setComplaintSuccessMsg] = useState('');

  // ---------------------------------------------------------------------------
  // MODULE 6: APPOINTMENT RESCHEDULE & CANCEL STATE
  // ---------------------------------------------------------------------------
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('10:00 - 12:00');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of schedule');
  const [cancelLoading, setCancelLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // MODULE 7: CUSTOMER FEEDBACK STATE
  // ---------------------------------------------------------------------------
  const [feedbackTab, setFeedbackTab] = useState('PRODUCT'); // 'PRODUCT' | 'TECHNICIAN'
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [feedbackCategoryRatings, setFeedbackCategoryRatings] = useState({
    system_performance: 5,
    build_quality: 5,
    professionalism: 5,
    punctuality: 5,
    cleanliness: 5,
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState('');

  // ---------------------------------------------------------------------------
  // MODULE 8: PROFILE & CONTACT PREFERENCES STATE
  // ---------------------------------------------------------------------------
  const [profilePhone, setProfilePhone] = useState(initialData?.customer?.phone || '');
  const [profileEmail, setProfileEmail] = useState(initialData?.customer?.email || '');
  const [profileAddress, setProfileAddress] = useState(initialData?.customer?.address || '');
  const [contactPrefs, setContactPrefs] = useState({
    notify_whatsapp: true,
    notify_sms: true,
    notify_email: true,
    notify_push: true,
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // DATA LOADING
  // ---------------------------------------------------------------------------
  const loadAllCustomerData = async () => {
    try {
      const [projects, apts, tcks, notifs, fbs, prof] = await Promise.all([
        api.getCustomerProjects().catch(() => []),
        api.getCustomerAppointments().catch(() => []),
        api.getCustomerServiceTickets().catch(() => []),
        api.getCustomerNotifications().catch(() => []),
        api.getCustomerFeedback().catch(() => []),
        api.getCustomerProfile().catch(() => null),
      ]);

      setProjectsList(projects);
      if (projects.length > 0 && !selectedProject) {
        setSelectedProject(projects[0]);
      }
      setAppointmentsList(apts);
      setServiceTickets(tcks);
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.is_read).length);
      setFeedbackList(fbs);

      if (prof) {
        setProfilePhone(prof.phone || '');
        setProfileEmail(prof.email || '');
        setProfileAddress(prof.installation_address || prof.address || '');
        if (prof.contact_preferences) setContactPrefs(prof.contact_preferences);

        setEnquiryForm((prev) => ({
          ...prev,
          customer_name: prof.name || prev.customer_name,
          mobile_number: prof.phone || prev.mobile_number,
          email: prof.email || prev.email,
          installation_address: prof.installation_address || prof.address || prev.installation_address,
        }));
      }

      // Check for canonical passport
      if (!verifiedPassport) {
        try {
          const pass = await api.getCustomerPassport();
          if (pass && pass.passport_number) {
            setVerifiedPassport(pass);
          }
        } catch {
          // Passport may be issued upon commissioning
        }
      }
    } catch (err) {
      console.warn('Error loading secondary customer records:', err);
    }
  };

  useEffect(() => {
    loadAllCustomerData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await api.getCustomerDashboard();
      setData(updated);
      await loadAllCustomerData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Customer telemetry refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // CAMERA HARDWARE MANAGEMENT
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
    setIsScanningQrCamera(false);
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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setServicePhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => setServicePhotoPreview(reader.result);
      reader.readAsDataURL(file);
      stopCamera();
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 2: SUBMIT INSTALLATION REQUEST & SURVEY PREFERENCE
  // ---------------------------------------------------------------------------
  const handleSubmitInstallationRequest = async (e) => {
    e.preventDefault();
    if (!enquiryForm.customer_name.trim() || !enquiryForm.mobile_number.trim() || !enquiryForm.installation_address.trim()) {
      alert('Please fill in Customer Name, Mobile Number and Installation Address.');
      return;
    }

    setEnquirySubmitting(true);
    try {
      const payload = {
        customer_name: enquiryForm.customer_name.trim(),
        mobile_number: enquiryForm.mobile_number.trim(),
        email: enquiryForm.email.trim() || undefined,
        installation_address: enquiryForm.installation_address.trim(),
        customer_type: enquiryForm.customer_type,
        solar_preference: enquiryForm.solar_preference,
        approximate_capacity: enquiryForm.approximate_capacity,
        additional_remarks: enquiryForm.additional_remarks || undefined,
        preferred_survey_date: enquiryForm.preferred_survey_date || undefined,
        preferred_time_window: enquiryForm.preferred_time_window || '10:00 - 12:00',
        alternative_preferred_date: enquiryForm.alternative_preferred_date || undefined,
        access_instructions: enquiryForm.access_instructions || undefined,
      };

      const res = await api.submitInstallationRequest(payload);
      setEnquirySuccessResult(res);
      await handleRefresh();
    } catch (err) {
      alert(err.message || 'Failed to submit installation request. Please verify inputs.');
    } finally {
      setEnquirySubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 4: VERIFY DIGITAL PASSPORT QR TOKEN
  // ---------------------------------------------------------------------------
  const handleVerifyPassportToken = async (tokenCandidate) => {
    const target = (tokenCandidate || qrTokenInput || data?.passport?.qr_code_token || data?.passport?.passport_number || '').trim();
    if (!target) {
      alert('Please enter a Passport Number, QR token, or scan a valid code.');
      return;
    }

    setQrScanLoading(true);
    setQrScanError(null);
    try {
      const res = await api.verifyCustomerPassportQr(target);
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
  // MODULE 5: SERVICE BOOKING SUBMISSION
  // ---------------------------------------------------------------------------
  const handleBookServiceVisit = async (e) => {
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
        component_id: serviceEquipmentId ? parseInt(serviceEquipmentId) : undefined,
        serial_number: serviceSerial || undefined,
        order_id: selectedProject?.id || selectedProject?.order_id || data?.active_project?.order_id,
        passport_id: verifiedPassport?.id || verifiedPassport?.passport_id || data?.passport?.id,
        preferred_visit_date: serviceVisitDate || undefined,
        preferred_time_slot: serviceVisitSlot || undefined,
        service_type: 'SERVICE_VISIT',
      };

      const res = await api.createCustomerServiceTicket(payload);

      // Upload photo if present
      if (servicePhotoFile && res.ticket_id) {
        const formData = new FormData();
        formData.append('file', servicePhotoFile);
        formData.append('description', `Service request photo: ${serviceCategory}`);
        await api.uploadComplaintEvidence(res.ticket_id, formData).catch(() => {});
      }

      setServiceSuccessMsg(`Service ticket #${res.ticket_number} scheduled! Our technical dispatch team has received your request.`);
      await handleRefresh();
      setTimeout(() => {
        setActiveModal(null);
        setServiceSuccessMsg('');
        setServiceDesc('');
        setServicePhotoFile(null);
        setServicePhotoPreview(null);
      }, 2200);
    } catch (err) {
      alert(err.message || 'Failed to schedule service visit.');
    } finally {
      setServiceSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 5: COMPLAINT REGISTRATION SUBMISSION
  // ---------------------------------------------------------------------------
  const handleRegisterComplaint = async (e) => {
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
        preferred_visit_date: complaintPreferredDate || undefined,
        service_type: 'COMPLAINT',
      };

      const res = await api.createCustomerServiceTicket(payload);

      // Upload photo if present
      if (servicePhotoFile && res.ticket_id) {
        const formData = new FormData();
        formData.append('file', servicePhotoFile);
        formData.append('description', `Complaint evidence: ${complaintCategory}`);
        await api.uploadComplaintEvidence(res.ticket_id, formData).catch(() => {});
      }

      setComplaintSuccessMsg(`Complaint #${res.ticket_number} registered! A senior customer success manager is assigned.`);
      await handleRefresh();
      setTimeout(() => {
        setActiveModal(null);
        setComplaintSuccessMsg('');
        setComplaintDesc('');
        setServicePhotoFile(null);
        setServicePhotoPreview(null);
      }, 2200);
    } catch (err) {
      alert(err.message || 'Failed to register complaint.');
    } finally {
      setComplaintSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 6: APPOINTMENT RESCHEDULE & CANCEL
  // ---------------------------------------------------------------------------
  const handleRescheduleAppointment = async (e) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleSlot) {
      alert('Please select both a new date and time slot.');
      return;
    }

    setRescheduleLoading(true);
    try {
      await api.rescheduleCustomerAppointment(selectedAppointment.id, {
        new_date: rescheduleDate,
        new_time_slot: rescheduleSlot,
        reason: 'Customer updated preferred timing',
      });
      alert('Appointment successfully rescheduled.');
      setActiveModal(null);
      await handleRefresh();
    } catch (err) {
      alert(err.message || 'Failed to reschedule.');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!confirm('Are you sure you want to cancel this scheduled appointment?')) return;
    setCancelLoading(true);
    try {
      await api.cancelCustomerAppointment(selectedAppointment.id, {
        cancellation_reason: cancelReason,
      });
      alert('Appointment has been cancelled.');
      setActiveModal(null);
      await handleRefresh();
    } catch (err) {
      alert(err.message || 'Failed to cancel.');
    } finally {
      setCancelLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 7: FEEDBACK SUBMISSION
  // ---------------------------------------------------------------------------
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setFeedbackSubmitting(true);
    setFeedbackSuccessMsg('');
    try {
      await api.submitCustomerFeedback({
        feedback_type: feedbackTab,
        rating: feedbackRating,
        category_ratings: feedbackCategoryRatings,
        comments: feedbackComments.trim() || undefined,
        order_id: selectedProject?.id || selectedProject?.order_id || data?.active_project?.order_id,
      });

      setFeedbackSuccessMsg('Thank you for sharing your verified SunPower experience!');
      await handleRefresh();
      setTimeout(() => {
        setActiveModal(null);
        setFeedbackSuccessMsg('');
        setFeedbackComments('');
      }, 1800);
    } catch (err) {
      alert(err.message || 'Failed to submit feedback.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 8: PROFILE UPDATE & NOTIFICATIONS
  // ---------------------------------------------------------------------------
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSubmitting(true);
    try {
      await api.updateCustomerProfile({
        phone: profilePhone.trim(),
        email: profileEmail.trim(),
        installation_address: profileAddress.trim(),
        contact_preferences: contactPrefs,
      });
      alert('Customer profile and contact preferences updated successfully.');
      setActiveModal(null);
      await handleRefresh();
    } catch (err) {
      alert(err.message || 'Failed to update profile.');
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      await api.markCustomerNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn(err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllCustomerNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn(err);
    }
  };

  // Active Project & Milestone Mappings
  const activeProj = data?.active_project || {};
  const milestones = data?.milestones || [];
  const hardwareItems = data?.hardware_items || [];
  const coordinator = data?.coordinator || {};
  const recentActivities = data?.recent_activity || [];

  // Filtered Appointments
  const filteredAppointments = appointmentsList.filter((apt) => {
    if (historyFilter === 'ALL') return true;
    if (historyFilter === 'SURVEY') return apt.appointment_type === 'SITE_SURVEY';
    if (historyFilter === 'INSTALLATION') return apt.appointment_type === 'INSTALLATION';
    if (historyFilter === 'SERVICE') return apt.appointment_type === 'SERVICE';
    return true;
  });

  return (
    <div className="bg-[#f0f5f2] font-sans text-[#121e17] antialiased min-h-screen flex flex-col selection:bg-[#006c36]/20">
      {/* Mobile Shell Wrapper (Centered with sleek device frame feel) */}
      <div className="w-full max-w-lg mx-auto bg-white min-h-screen flex flex-col shadow-2xl relative pb-24 border-x border-[#ddece0]">

        {/* =================================================================== */}
        {/* TOP STATUS & HEADER BAR                                             */}
        {/* =================================================================== */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#ddece0] px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#006c36] text-white flex items-center justify-center font-black shadow-sm">
              <Sun className="w-5 h-5 text-amber-300 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-[#006c36]">
                  SunPower
                </span>
                <span className="text-[10px] text-[#56615a]">· Customer</span>
              </div>
              <p className="text-xs font-bold text-[#121e17] leading-none mt-0.5">
                {data?.customer?.name || user?.full_name || 'Customer Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Live Telemetry Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-[#006c36] hover:bg-[#e8f7eb] active:scale-95 transition-all ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              title="Refresh Telemetry"
              type="button"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => setActiveModal('notifications')}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#56615a] hover:bg-[#e8f7eb] active:scale-95 transition-all"
              title="Notifications"
              type="button"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              )}
            </button>

            {/* Profile Avatar Shortcut */}
            <button
              onClick={() => setCurrentTab('profile')}
              className="w-8 h-8 rounded-full bg-[#006c36] text-white font-bold text-xs flex items-center justify-center hover:opacity-90 active:scale-95 ml-0.5"
              title="My Account"
              type="button"
            >
              {data?.customer?.name ? data.customer.name.charAt(0) : 'C'}
            </button>
          </div>
        </header>

        {/* =================================================================== */}
        {/* TAB 1: HOME / DASHBOARD                                             */}
        {/* =================================================================== */}
        {currentTab === 'home' && (
          <main className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* Welcome & System Status Card */}
            <div className="bg-gradient-to-br from-[#006c36] to-[#044424] text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
                <Sun className="w-44 h-44 text-white" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 text-white px-2 py-0.5 rounded">
                  Solar Rooftop EPC
                </span>
                <span className="text-[10px] text-white/80 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Network
                </span>
              </div>

              <h2 className="text-lg font-extrabold text-white mt-2 leading-tight">
                Welcome, {data?.customer?.name?.split(' ')[0] || 'Customer'}
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                {activeProj.system_capacity_kw || 5.0} kWp Rooftop System · {data?.customer?.city || 'Pune'}
              </p>

              <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/20 text-center">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-white/70 block">Projects</span>
                  <span className="text-sm font-black text-white">{projectsList.length || 1} Active</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-white/70 block">Capacity</span>
                  <span className="text-sm font-black text-white">{activeProj.system_capacity_kw || 5.0} kWp</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-white/70 block">Status</span>
                  <span className="text-xs font-bold text-emerald-300 truncate block mt-0.5">
                    {activeProj.current_stage_label || 'Commissioned'}
                  </span>
                </div>
              </div>
            </div>

            {/* --------------------------------------------------------------- */}
            {/* JOURNEY A: NEW CUSTOMER — REQUEST NEW SOLAR INSTALLATION        */}
            {/* --------------------------------------------------------------- */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border-2 border-amber-500/40 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#121e17]">
                      Request New Solar Installation
                    </h3>
                    <p className="text-[11px] text-[#56615a]">
                      Quick 2-minute enquiry & preferred survey time
                    </p>
                  </div>
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                  New Lead
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-[#56615a] bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                <span className="text-[11px]">Free site survey & ₹78,000 PM Surya Ghar subsidy guidance</span>
              </div>

              <button
                onClick={() => {
                  setEnquirySuccessResult(null);
                  setEnquiryStep(1);
                  setActiveModal('installation_request');
                }}
                className="mt-3 w-full h-10 rounded-xl bg-[#006c36] hover:bg-[#00552a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                type="button"
              >
                <span>Request New Solar Installation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* --------------------------------------------------------------- */}
            {/* JOURNEY B: EXISTING CUSTOMER — MY PROJECTS & PASSPORT SHORTCUT  */}
            {/* --------------------------------------------------------------- */}
            <div className="grid grid-cols-2 gap-3">
              {/* My Projects Shortcut */}
              <div
                onClick={() => setCurrentTab('projects')}
                className="bg-white rounded-2xl p-3.5 border border-[#ddece0] shadow-sm hover:border-[#006c36] cursor-pointer transition-all active:scale-95 flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#e3f2e6] text-[#006c36] flex items-center justify-center mb-2">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-[#121e17]">My Projects</h4>
                  <p className="text-[10px] text-[#56615a] mt-0.5 leading-snug">
                    {projectsList.length || 1} Subscribed rooftop system
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-[#006c36] pt-2 border-t border-[#ddece0]">
                  <span>View Timeline</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Digital Passport Shortcut */}
              <div
                onClick={() => setCurrentTab('scan')}
                className="bg-white rounded-2xl p-3.5 border border-[#ddece0] shadow-sm hover:border-[#006c36] cursor-pointer transition-all active:scale-95 flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#006c36] text-white flex items-center justify-center mb-2">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-[#121e17]">Digital Passport</h4>
                  <p className="text-[10px] text-[#56615a] mt-0.5 leading-snug">
                    Scan QR, verified serials & warranties
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-[#006c36] pt-2 border-t border-[#ddece0]">
                  <span>Scan / Open</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white rounded-2xl p-3.5 border border-[#ddece0] shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#56615a] block mb-2">
                Quick Service Actions
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setActiveModal('service_booking');
                  }}
                  className="p-2.5 rounded-xl bg-[#f4faf5] hover:bg-[#e8f7eb] border border-[#ddece0] flex flex-col items-center text-center transition-all active:scale-95"
                  type="button"
                >
                  <Wrench className="w-4 h-4 text-[#006c36] mb-1" />
                  <span className="text-[11px] font-bold text-[#121e17]">Book Service</span>
                  <span className="text-[9px] text-[#56615a]">Maintenance</span>
                </button>

                <button
                  onClick={() => {
                    setActiveModal('complaint');
                  }}
                  className="p-2.5 rounded-xl bg-[#f4faf5] hover:bg-[#e8f7eb] border border-[#ddece0] flex flex-col items-center text-center transition-all active:scale-95"
                  type="button"
                >
                  <AlertCircle className="w-4 h-4 text-amber-600 mb-1" />
                  <span className="text-[11px] font-bold text-[#121e17]">Complaint</span>
                  <span className="text-[9px] text-[#56615a]">Support Ticket</span>
                </button>

                <button
                  onClick={() => {
                    setActiveModal('feedback');
                  }}
                  className="p-2.5 rounded-xl bg-[#f4faf5] hover:bg-[#e8f7eb] border border-[#ddece0] flex flex-col items-center text-center transition-all active:scale-95"
                  type="button"
                >
                  <Star className="w-4 h-4 text-amber-500 mb-1" />
                  <span className="text-[11px] font-bold text-[#121e17]">Feedback</span>
                  <span className="text-[9px] text-[#56615a]">Rate System</span>
                </button>
              </div>
            </div>

            {/* Recent Activity Log Feed */}
            <div className="bg-white rounded-2xl p-4 border border-[#ddece0] shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#006c36]" />
                  <h3 className="text-xs font-bold text-[#121e17] uppercase tracking-wider">
                    Recent Activity & Milestones
                  </h3>
                </div>
                <span className="text-[9px] text-[#006c36] font-bold bg-[#006c36]/10 px-1.5 py-0.5 rounded">
                  Live Feed
                </span>
              </div>

              {recentActivities.length === 0 ? (
                <div className="p-4 text-center text-[#56615a] text-xs bg-[#f4faf5] rounded-xl">
                  No recent activities recorded.
                </div>
              ) : (
                <div className="space-y-2.5 pl-2 border-l-2 border-[#e3f2e6] text-xs">
                  {recentActivities.slice(0, 4).map((act, idx) => (
                    <div key={idx} className="relative pl-3">
                      <div
                        className={`absolute -left-[13px] top-1.5 w-2 h-2 rounded-full ${
                          act.is_highlight ? 'bg-[#006c36] ring-2 ring-emerald-200' : 'bg-[#56615a]'
                        }`}
                      />
                      <div className="bg-[#f4faf5] p-2.5 rounded-xl border border-[#ddece0]">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[11px] font-bold text-[#121e17] leading-tight">
                            {act.title}
                          </span>
                          <span className="text-[9px] text-[#56615a] shrink-0">{act.date}</span>
                        </div>
                        <p className="text-[10px] text-[#56615a] mt-0.5">{act.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Project Coordinator Card */}
            <div className="bg-[#f4faf5] rounded-2xl p-3.5 border border-[#ddece0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#006c36] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {coordinator.name ? coordinator.name.charAt(0) : 'V'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#121e17]">{coordinator.name || 'Vikram Rao'}</h4>
                  <p className="text-[10px] text-[#56615a]">{coordinator.title || 'Assigned Solar Project Lead'}</p>
                </div>
              </div>
              <a
                href={`tel:${coordinator.phone || '+919823011223'}`}
                className="h-8 px-2.5 rounded-lg bg-white border border-[#ddece0] text-[#006c36] text-[11px] font-semibold flex items-center gap-1 active:scale-95 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            </div>
          </main>
        )}

        {/* =================================================================== */}
        {/* TAB 2: MY PROJECTS                                                  */}
        {/* =================================================================== */}
        {currentTab === 'projects' && (
          <main className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#121e17]">My Subscribed Projects</h2>
                <p className="text-xs text-[#56615a]">Solar rooftop systems owned by you</p>
              </div>
              <button
                onClick={() => {
                  setEnquiryStep(1);
                  setEnquirySuccessResult(null);
                  setActiveModal('installation_request');
                }}
                className="h-8 px-2.5 rounded-xl bg-[#006c36] text-white font-bold text-[11px] flex items-center gap-1 shadow-sm active:scale-95"
                type="button"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            </div>

            {/* Projects List */}
            {projectsList.length === 0 && !activeProj.system_capacity_kw ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#ddece0] shadow-sm space-y-3">
                <Sun className="w-12 h-12 text-[#006c36] mx-auto opacity-40" />
                <h3 className="text-sm font-bold text-[#121e17]">No Solar Projects Found</h3>
                <p className="text-xs text-[#56615a] max-w-xs mx-auto">
                  You haven't subscribed to a solar installation yet. Request an installation enquiry to get started!
                </p>
                <button
                  onClick={() => {
                    setEnquiryStep(1);
                    setEnquirySuccessResult(null);
                    setActiveModal('installation_request');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#006c36] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md"
                  type="button"
                >
                  <span>Request New Solar Installation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {(projectsList.length > 0 ? projectsList : [activeProj]).map((proj, pIdx) => {
                  const isSelected = (selectedProject?.id === proj.id) || (pIdx === 0 && !selectedProject);
                  return (
                    <div
                      key={proj.id || pIdx}
                      onClick={() => setSelectedProject(proj)}
                      className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white border-[#006c36] ring-2 ring-[#006c36]/20 shadow-md'
                          : 'bg-[#f4faf5] border-[#ddece0] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[#121e17]">
                              {proj.order_number || `Order #${proj.order_id || 'ORD-2026-0001'}`}
                            </h3>
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {proj.status || proj.stage || 'COMMISSIONED'}
                            </span>
                          </div>
                          <p className="text-xs text-[#56615a] mt-0.5">
                            {proj.system_capacity_kw || 5.0} kWp · {proj.system_type || 'On-Grid Residential'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-[#006c36] block">
                            {proj.contract_inr ? `₹${proj.contract_inr.toLocaleString()}` : '₹2,65,000'}
                          </span>
                          <span className="text-[9px] text-[#56615a]">
                            {proj.installation_date ? `Installed: ${proj.installation_date}` : 'Nov 2026'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-1 text-[11px] text-[#56615a]">
                        <MapPin className="w-3 h-3 text-[#006c36] shrink-0" />
                        <span className="truncate">{proj.address || data?.customer?.address || 'Baner Road, Pune'}</span>
                      </div>

                      {/* Expanded Project Timeline & Details */}
                      {isSelected && (
                        <div className="mt-3.5 pt-3.5 border-t border-[#e3f2e6] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-[#56615a]">
                              Milestone Progression (8 Customer Stages)
                            </span>
                            <span className="text-[10px] font-bold text-[#006c36]">
                              {activeProj.momentum_pct || 100}% Completed
                            </span>
                          </div>

                          {/* 8 Customer-Safe Milestones Ribbon */}
                          <div className="overflow-x-auto no-scrollbar py-1 flex items-start gap-1">
                            {[
                              { step: 1, title: 'Enquiry', done: true },
                              { step: 2, title: 'Site Survey', done: true },
                              { step: 3, title: 'Proposal & Order', done: true },
                              { step: 4, title: 'Material Prep', done: true },
                              { step: 5, title: 'Scheduling', done: true },
                              { step: 6, title: 'Installation', done: true },
                              { step: 7, title: 'Commissioning', done: true },
                              { step: 8, title: 'Handover & Passport', done: true },
                            ].map((st, sIdx, arr) => (
                              <React.Fragment key={st.step}>
                                <div className="flex flex-col items-center text-center shrink-0 w-16">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${
                                      st.done ? 'bg-[#006c36] text-white' : 'bg-[#e3f2e6] text-[#56615a]'
                                    }`}
                                  >
                                    {st.done ? <Check className="w-3.5 h-3.5" /> : st.step}
                                  </div>
                                  <span className="text-[9px] font-semibold text-[#121e17] mt-1 leading-tight truncate max-w-[60px]">
                                    {st.title}
                                  </span>
                                </div>
                                {sIdx < arr.length - 1 && (
                                  <div className="w-2.5 h-0.5 mt-3 -mx-0.5 shrink-0 bg-[#006c36]" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>

                          {/* Project Actions Button Grid */}
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentTab('scan');
                              }}
                              className="h-9 rounded-xl bg-[#006c36] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                              type="button"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Digital Passport</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveModal('service_booking');
                              }}
                              className="h-9 rounded-xl bg-[#e8f7eb] text-[#006c36] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                              type="button"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Book Service</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveModal('complaint');
                              }}
                              className="h-9 rounded-xl bg-white border border-[#ddece0] text-[#121e17] font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                              type="button"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Complaint</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveModal('feedback');
                              }}
                              className="h-9 rounded-xl bg-white border border-[#ddece0] text-[#121e17] font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                              type="button"
                            >
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              <span>Rate Work</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        )}

        {/* =================================================================== */}
        {/* TAB 3: SCAN DIGITAL PASSPORT QR CODE                                */}
        {/* =================================================================== */}
        {currentTab === 'scan' && (
          <main className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#121e17]">Digital Passport Scanner</h2>
                <p className="text-xs text-[#56615a]">Primary access point for existing solar assets</p>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider bg-[#006c36]/10 text-[#006c36] px-2 py-0.5 rounded">
                Verified Asset
              </span>
            </div>

            {/* Camera Viewfinder / Scanner Area */}
            <div className="bg-[#121e17] rounded-2xl p-4 text-white shadow-lg overflow-hidden relative">
              <div className="relative aspect-video bg-black/60 rounded-xl overflow-hidden flex flex-col items-center justify-center border border-white/10">
                {isCameraActive ? (
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
                ) : (
                  <div className="text-center p-4">
                    <QrCode className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-semibold text-white/90">Camera Standby</p>
                    <p className="text-[10px] text-white/60 mt-0.5">Point camera at your Digital Passport QR token</p>
                  </div>
                )}

                {/* Reticle Focus Box */}
                <div className="absolute inset-8 border-2 border-dashed border-emerald-400/70 rounded-xl pointer-events-none flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                </div>
              </div>

              {/* Camera Controls */}
              <div className="mt-3 flex items-center justify-between gap-2">
                {!isCameraActive ? (
                  <button
                    onClick={startCamera}
                    className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    type="button"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Start Scanner Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                    <span>Stop Camera</span>
                  </button>
                )}

                <button
                  onClick={() => handleVerifyPassportToken('DSP-MH-2026-0081')}
                  className="px-3 h-9 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs active:scale-95"
                  title="Load Scanned Demo Token"
                  type="button"
                >
                  Load Token
                </button>
              </div>

              {/* Manual Entry Fallback */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <label className="block text-[10px] uppercase font-bold tracking-wider text-white/70 mb-1">
                  Manual Entry Fallback
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={qrTokenInput}
                    onChange={(e) => setQrTokenInput(e.target.value)}
                    placeholder="e.g. DSP-MH-2026-0081 or token_dsp_..."
                    className="flex-1 h-9 rounded-xl bg-white/10 border border-white/20 px-3 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button
                    onClick={() => handleVerifyPassportToken()}
                    disabled={qrScanLoading}
                    className="h-9 px-3 rounded-xl bg-[#006c36] text-white font-bold text-xs active:scale-95 shrink-0 flex items-center gap-1"
                    type="button"
                  >
                    {qrScanLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>Verify</span>
                  </button>
                </div>
                {qrScanError && (
                  <p className="text-[10px] text-red-400 mt-1.5 font-medium">{qrScanError}</p>
                )}
              </div>
            </div>

            {/* Verified Digital Passport Card */}
            {verifiedPassport && (
              <div className="bg-white rounded-2xl p-4 border-2 border-[#006c36] shadow-md space-y-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      Official Certified Passport
                    </span>
                    <h3 className="text-base font-extrabold text-[#121e17] mt-1">
                      {verifiedPassport.passport_number || 'DSP-MH-2026-0081'}
                    </h3>
                    <p className="text-xs text-[#56615a]">
                      Commissioned: {verifiedPassport.commissioning_date || '2026-10-31'} · {verifiedPassport.grid_type || 'ON_GRID'}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#006c36] text-white flex items-center justify-center font-bold shadow-sm">
                    <Shield className="w-5 h-5 text-emerald-300" />
                  </div>
                </div>

                {/* Passport QR & Metrics */}
                <div className="bg-[#f4faf5] p-3 rounded-xl border border-[#ddece0] flex items-center gap-3">
                  <div
                    className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden"
                    dangerouslySetInnerHTML={{
                      __html: verifiedPassport.qr_code_svg || `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#006c36"/><text x="50" y="55" font-size="12" fill="#fff" text-anchor="middle">QR CODE</text></svg>`,
                    }}
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <span className="text-[9px] uppercase font-bold text-[#56615a] block">Encrypted Asset Token</span>
                    <span className="font-mono text-[10px] font-bold text-[#006c36] truncate block">
                      {verifiedPassport.qr_code_token || 'token_dsp_rajesh_sharma_5kw_pune_2026'}
                    </span>
                    <div className="grid grid-cols-2 gap-1 mt-1 text-[10px]">
                      <div>Health: <b className="text-emerald-700">{verifiedPassport.system_health_score || 98}%</b></div>
                      <div>Yield: <b>{verifiedPassport.lifetime_mwh || 187.5} MWh</b></div>
                    </div>
                  </div>
                </div>

                {/* Verified Serial Numbers Preview */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#121e17] flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-[#006c36]" />
                      Installed Verified Hardware
                    </span>
                    <span className="text-[10px] text-[#006c36] font-semibold">3 Components</span>
                  </div>
                  <div className="bg-[#f4faf5] rounded-xl p-2.5 border border-[#ddece0] text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#121e17]">Waaree 550W Bifacial Panels (10x)</span>
                      <span className="font-mono text-[10px] text-[#006c36] font-bold">SN: WRE-550-2026V-001</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-[#ddece0]">
                      <span className="font-medium text-[#121e17]">Sungrow 5kW String Inverter</span>
                      <span className="font-mono text-[10px] text-[#006c36] font-bold">SN: SNG-5K-2026-V9921</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-[#ddece0]">
                      <span className="font-medium text-[#121e17]">Elevated HDG Mounting Structure</span>
                      <span className="font-mono text-[10px] text-[#006c36] font-bold">SN: SP-STR-2026-HDG</span>
                    </div>
                  </div>
                </div>

                {/* THE 4 MANDATED ACTIONS AFTER SCANNING */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#56615a] block">
                    Passport Operational Actions
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Action 1: Book Service */}
                    <button
                      onClick={() => setActiveModal('service_booking')}
                      className="h-10 rounded-xl bg-[#006c36] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      type="button"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Book a Service</span>
                    </button>

                    {/* Action 2: Register Complaint */}
                    <button
                      onClick={() => setActiveModal('complaint')}
                      className="h-10 rounded-xl bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      type="button"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Register Complaint</span>
                    </button>

                    {/* Action 3: View Equipment */}
                    <button
                      onClick={() => setActiveModal('view_equipment')}
                      className="h-10 rounded-xl bg-[#e8f7eb] text-[#006c36] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                      type="button"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>View Equipment</span>
                    </button>

                    {/* Action 4: View Warranty */}
                    <button
                      onClick={() => setActiveModal('view_warranty')}
                      className="h-10 rounded-xl bg-[#e8f7eb] text-[#006c36] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                      type="button"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>View Warranty</span>
                    </button>
                  </div>

                  {/* Electronic Handover Acknowledgement */}
                  <button
                    onClick={() => setActiveModal('passport_ack')}
                    className="w-full h-9 rounded-xl bg-white border border-[#006c36] text-[#006c36] font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-[#e8f7eb] active:scale-95"
                    type="button"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#006c36]" />
                    <span>Acknowledge Handover Sign-off</span>
                  </button>
                </div>
              </div>
            )}
          </main>
        )}

        {/* =================================================================== */}
        {/* TAB 4: HISTORY (Surveys, Installations & Services)                  */}
        {/* =================================================================== */}
        {currentTab === 'history' && (
          <main className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#121e17]">Service & Visit History</h2>
                <p className="text-xs text-[#56615a]">Site surveys, installations and repairs</p>
              </div>
              <button
                onClick={() => {
                  setActiveModal('service_booking');
                }}
                className="h-8 px-2.5 rounded-xl bg-[#006c36] text-white font-bold text-[11px] flex items-center gap-1 shadow-sm active:scale-95"
                type="button"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Book Visit</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              {[
                { id: 'ALL', label: 'All Records' },
                { id: 'SURVEY', label: 'Site Surveys' },
                { id: 'INSTALLATION', label: 'Installations' },
                { id: 'SERVICE', label: 'Services' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setHistoryFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[11px] shrink-0 transition-all ${
                    historyFilter === pill.id
                      ? 'bg-[#006c36] text-white shadow-xs'
                      : 'bg-white border border-[#ddece0] text-[#56615a]'
                  }`}
                  type="button"
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Interleaved Appointments Timeline */}
            {filteredAppointments.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#ddece0] shadow-sm space-y-2">
                <Calendar className="w-10 h-10 text-[#006c36] mx-auto opacity-40" />
                <h4 className="text-xs font-bold text-[#121e17]">No Appointments Found</h4>
                <p className="text-[11px] text-[#56615a]">
                  No scheduled or completed visits matching the selected category.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3.5 rounded-2xl bg-white border border-[#ddece0] shadow-xs text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#121e17] text-xs">
                            {apt.appointment_type.replace('_', ' ')}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                              apt.status === 'CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : apt.status === 'REQUESTED'
                                ? 'bg-amber-100 text-amber-800'
                                : apt.status === 'RESCHEDULED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {apt.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#56615a] mt-0.5">
                          {apt.appointment_number} · Engineer: {apt.technician_name || 'Assigned Field Tech'}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-[#006c36] block">{apt.scheduled_date}</span>
                        <span className="text-[10px] text-[#56615a]">{apt.time_slot}</span>
                      </div>
                    </div>

                    {apt.customer_notes && (
                      <p className="text-[11px] text-[#56615a] bg-[#f4faf5] p-2 rounded-lg border border-[#ddece0]">
                        {apt.customer_notes}
                      </p>
                    )}

                    {/* Reschedule / Cancel Controls for Pending Appointments */}
                    {apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED' && (
                      <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-[#e3f2e6]">
                        <button
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setRescheduleDate(apt.scheduled_date);
                            setRescheduleSlot(apt.time_slot);
                            setActiveModal('reschedule_apt');
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#f4faf5] hover:bg-[#e8f7eb] text-[#006c36] border border-[#ddece0] rounded-lg active:scale-95"
                          type="button"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setActiveModal('cancel_apt');
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold bg-red-50 text-red-700 hover:bg-red-100 rounded-lg active:scale-95"
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>
        )}

        {/* =================================================================== */}
        {/* TAB 5: PROFILE & NOTIFICATIONS                                      */}
        {/* =================================================================== */}
        {currentTab === 'profile' && (
          <main className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#121e17]">My Customer Profile</h2>
                <p className="text-xs text-[#56615a]">Account details and contact preferences</p>
              </div>
              <button
                onClick={() => setActiveModal('edit_profile')}
                className="text-xs font-bold text-[#006c36] bg-[#006c36]/10 px-2.5 py-1 rounded-xl active:scale-95"
                type="button"
              >
                Edit Profile
              </button>
            </div>

            {/* Profile Overview Card */}
            <div className="bg-white rounded-2xl p-4 border border-[#ddece0] shadow-sm space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-[#e3f2e6]">
                <div className="w-12 h-12 rounded-2xl bg-[#006c36] text-white font-black text-lg flex items-center justify-center shadow-md">
                  {data?.customer?.name ? data.customer.name.charAt(0) : 'R'}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#121e17]">
                    {data?.customer?.name || user?.full_name || 'Rajesh Sharma'}
                  </h3>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    Verified Solar Consumer
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0]">
                  <span className="text-[9px] uppercase font-bold text-[#56615a] block">Phone</span>
                  <span className="font-bold text-[#121e17]">{profilePhone || '+91 98230 11223'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0]">
                  <span className="text-[9px] uppercase font-bold text-[#56615a] block">Email</span>
                  <span className="font-bold text-[#121e17] truncate block">{profileEmail || 'customer@sunpower.com'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0]">
                  <span className="text-[9px] uppercase font-bold text-[#56615a] block">Consumer No.</span>
                  <span className="font-bold text-[#121e17]">{data?.customer?.consumer_number || 'MSEDCL-PUN-849201'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0]">
                  <span className="text-[9px] uppercase font-bold text-[#56615a] block">Sanctioned Load</span>
                  <span className="font-bold text-[#121e17]">6.0 kW</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-xs">
                <span className="text-[9px] uppercase font-bold text-[#56615a] block">Installation Site</span>
                <span className="font-medium text-[#121e17]">{profileAddress || 'Baner Road, Pune'}</span>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-white rounded-2xl p-4 border border-[#ddece0] shadow-sm space-y-2.5">
              <h4 className="text-xs font-bold text-[#121e17] uppercase tracking-wider">
                Notification Channels
              </h4>
              {[
                { key: 'notify_whatsapp', label: 'WhatsApp Alerts (Milestones & OTP)' },
                { key: 'notify_sms', label: 'SMS Notifications (Survey & Dispatch)' },
                { key: 'notify_email', label: 'Email Invoices & Warranties' },
                { key: 'notify_push', label: 'In-App Live Status Updates' },
              ].map((ch) => (
                <div key={ch.key} className="flex items-center justify-between py-1 text-xs">
                  <span className="text-[#121e17]">{ch.label}</span>
                  <input
                    type="checkbox"
                    checked={contactPrefs[ch.key] ?? true}
                    onChange={(e) => setContactPrefs({ ...contactPrefs, [ch.key]: e.target.checked })}
                    className="w-4 h-4 accent-[#006c36] rounded"
                  />
                </div>
              ))}
            </div>

            {/* Feedback History & Review Shortcut */}
            <div className="bg-white rounded-2xl p-4 border border-[#ddece0] shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#121e17] uppercase tracking-wider">
                  Submitted Feedback & Reviews
                </h4>
                <button
                  onClick={() => setActiveModal('feedback')}
                  className="text-[11px] font-bold text-[#006c36] underline"
                  type="button"
                >
                  + Leave Review
                </button>
              </div>

              {feedbackList.length === 0 ? (
                <p className="text-xs text-[#56615a] bg-[#f4faf5] p-3 rounded-xl text-center">
                  No reviews submitted yet. Rate your solar installation experience!
                </p>
              ) : (
                <div className="space-y-2">
                  {feedbackList.map((fb) => (
                    <div key={fb.id} className="p-3 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((st) => (
                            <Star
                              key={st}
                              className={`w-3.5 h-3.5 ${st <= fb.rating ? 'fill-amber-400' : 'text-slate-300'}`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-[#56615a]">{fb.created_at || 'Recent'}</span>
                      </div>
                      {fb.comments && <p className="text-[11px] text-[#121e17] mt-1.5 italic">"{fb.comments}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logout Action */}
            <div className="pt-2">
              <button
                onClick={logout}
                className="w-full h-11 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center gap-2 border border-red-200 active:scale-95 transition-all"
                type="button"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout from SunPower Customer Workspace</span>
              </button>
            </div>
          </main>
        )}

        {/* =================================================================== */}
        {/* FIXED 5-TAB BOTTOM NAVIGATION BAR                                  */}
        {/* =================================================================== */}
        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            maxWidth: '32rem', // max-w-lg
            margin: '0 auto',
            zIndex: 40,
            height: '68px',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid #ddece0',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '0 0.5rem',
          }}
        >
          {[
            { id: 'home', label: 'Home', icon: Sun },
            { id: 'projects', label: 'My Projects', icon: Layers, badge: projectsList.length || 1 },
            { id: 'scan', label: 'Scan Passport', icon: QrCode },
            { id: 'history', label: 'History', icon: Calendar, badge: appointmentsList.length },
            { id: 'profile', label: 'Profile', icon: User },
          ].map((item) => {
            const isActive = currentTab === item.id;
            const IconComp = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90"
                style={{
                  color: isActive ? '#006c36' : '#56615a',
                  fontWeight: isActive ? 800 : 500,
                  position: 'relative',
                }}
                type="button"
              >
                <div
                  className={`w-9 h-7 rounded-xl flex items-center justify-center transition-all ${
                    isActive ? 'bg-[#006c36] text-white shadow-sm' : 'text-[#56615a]'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-1 truncate max-w-[68px]">
                  {item.label}
                </span>

                {item.badge !== undefined && item.badge > 0 && !isActive && (
                  <span className="absolute top-1 right-3 text-[8.5px] font-extrabold bg-[#006c36] text-white px-1.5 rounded-full ring-2 ring-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: INSTALLATION REQUEST & SURVEY BOOKING (MODULE 2)             */}
      {/* ===================================================================== */}
      {activeModal === 'installation_request' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-2xl border border-[#ddece0] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#e3f2e6]">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#006c36]">Module 2</span>
                <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-500" />
                  Request New Solar Installation
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            {enquirySuccessResult ? (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-[#006c36] mx-auto animate-bounce" />
                <h4 className="text-sm font-extrabold text-[#121e17]">
                  Solar Installation Request Submitted!
                </h4>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs space-y-1.5 text-emerald-900">
                  <p className="font-semibold">{enquirySuccessResult.message}</p>
                  <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between text-[11px]">
                    <span>Enquiry Ref:</span>
                    <b className="font-mono">{enquirySuccessResult.enquiry_number}</b>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span>Survey Appointment:</span>
                    <b className="font-mono">{enquirySuccessResult.appointment_number}</b>
                  </div>
                </div>
                <p className="text-[11px] text-[#56615a]">
                  Our solar engineering desk will review your preferred date and contact you with confirmation.
                </p>
                <button
                  onClick={() => {
                    setActiveModal(null);
                    setCurrentTab('history');
                  }}
                  className="w-full h-10 rounded-xl bg-[#006c36] text-white font-bold text-xs"
                  type="button"
                >
                  View My Appointments & History
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitInstallationRequest} className="mt-3 space-y-3 text-xs">
                {/* Stepper Tabs */}
                <div className="flex gap-1 p-1 bg-[#f4faf5] rounded-xl border border-[#ddece0] text-center font-bold text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEnquiryStep(1)}
                    className={`flex-1 py-1 rounded-lg ${enquiryStep === 1 ? 'bg-[#006c36] text-white' : 'text-[#56615a]'}`}
                  >
                    1. Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnquiryStep(2)}
                    className={`flex-1 py-1 rounded-lg ${enquiryStep === 2 ? 'bg-[#006c36] text-white' : 'text-[#56615a]'}`}
                  >
                    2. Survey Timing
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnquiryStep(3)}
                    className={`flex-1 py-1 rounded-lg ${enquiryStep === 3 ? 'bg-[#006c36] text-white' : 'text-[#56615a]'}`}
                  >
                    3. Review
                  </button>
                </div>

                {/* Step 1: Customer Details & Preferences */}
                {enquiryStep === 1 && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#121e17] mb-1">Customer Name *</label>
                      <input
                        type="text"
                        required
                        value={enquiryForm.customer_name}
                        onChange={(e) => setEnquiryForm({ ...enquiryForm, customer_name: e.target.value })}
                        className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-[#121e17] mb-1">Mobile Number *</label>
                        <input
                          type="tel"
                          required
                          value={enquiryForm.mobile_number}
                          onChange={(e) => setEnquiryForm({ ...enquiryForm, mobile_number: e.target.value })}
                          className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#121e17] mb-1">Email (Optional)</label>
                        <input
                          type="email"
                          value={enquiryForm.email}
                          onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
                          className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#121e17] mb-1">Installation Address *</label>
                      <textarea
                        required
                        rows={2}
                        value={enquiryForm.installation_address}
                        onChange={(e) => setEnquiryForm({ ...enquiryForm, installation_address: e.target.value })}
                        className="w-full rounded-xl border border-[#ddece0] bg-[#f4faf5] p-2.5 text-xs text-[#121e17]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-[#121e17] mb-1">Customer Type</label>
                        <select
                          value={enquiryForm.customer_type}
                          onChange={(e) => setEnquiryForm({ ...enquiryForm, customer_type: e.target.value })}
                          className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
                        >
                          <option value="Residential">Residential</option>
                          <option value="Commercial">Commercial</option>
                          <option value="Industrial">Industrial</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#121e17] mb-1">Solar Preference</label>
                        <select
                          value={enquiryForm.solar_preference}
                          onChange={(e) => setEnquiryForm({ ...enquiryForm, solar_preference: e.target.value })}
                          className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
                        >
                          <option value="On-Grid">On-Grid (Net Metered)</option>
                          <option value="Off-Grid">Off-Grid (Battery Storage)</option>
                          <option value="Not sure">Not sure (Advise Me)</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-[#121e17] mb-1">Approx Capacity</label>
                        <input
                          type="text"
                          value={enquiryForm.approximate_capacity}
                          onChange={(e) => setEnquiryForm({ ...enquiryForm, approximate_capacity: e.target.value })}
                          placeholder="e.g. 3 kW, 5 kW"
                          className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#121e17] mb-1">Remarks</label>
                        <input
                          type="text"
                          value={enquiryForm.additional_remarks}
                          onChange={(e) => setEnquiryForm({ ...enquiryForm, additional_remarks: e.target.value })}
                          placeholder="Special requests"
                          className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEnquiryStep(2)}
                      className="mt-2 w-full h-10 rounded-xl bg-[#006c36] text-white font-bold text-xs flex items-center justify-center gap-1"
                    >
                      <span>Proceed to Survey Scheduling</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Step 2: Preferred Survey Appointment */}
                {enquiryStep === 2 && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#121e17] mb-1">Preferred Survey Date *</label>
                      <input
                        type="date"
                        required
                        value={enquiryForm.preferred_survey_date}
                        onChange={(e) => setEnquiryForm({ ...enquiryForm, preferred_survey_date: e.target.value })}
                        className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#121e17] mb-1">Preferred Time Window *</label>
                      <select
                        value={enquiryForm.preferred_time_window}
                        onChange={(e) => setEnquiryForm({ ...enquiryForm, preferred_time_window: e.target.value })}
                        className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
                      >
                        <option value="09:00 - 11:00">Morning (09:00 - 11:00 AM)</option>
                        <option value="11:00 - 13:00">Midday (11:00 AM - 01:00 PM)</option>
                        <option value="14:00 - 16:00">Afternoon (02:00 - 04:00 PM)</option>
                        <option value="16:00 - 18:00">Evening (04:00 - 06:00 PM)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#121e17] mb-1">Alternative Preferred Date (Optional)</label>
                      <input
                        type="date"
                        value={enquiryForm.alternative_preferred_date}
                        onChange={(e) => setEnquiryForm({ ...enquiryForm, alternative_preferred_date: e.target.value })}
                        className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#121e17] mb-1">Terrace Access Instructions</label>
                      <input
                        type="text"
                        value={enquiryForm.access_instructions}
                        onChange={(e) => setEnquiryForm({ ...enquiryForm, access_instructions: e.target.value })}
                        placeholder="e.g. Terrace key with building security"
                        className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEnquiryStep(1)}
                        className="flex-1 h-10 rounded-xl bg-slate-100 text-[#121e17] font-semibold text-xs"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnquiryStep(3)}
                        className="flex-1 h-10 rounded-xl bg-[#006c36] text-white font-bold text-xs"
                      >
                        Review Summary
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Review and Commit */}
                {enquiryStep === 3 && (
                  <div className="space-y-3">
                    <div className="bg-[#f4faf5] p-3 rounded-xl border border-[#ddece0] text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[#56615a]">Customer:</span>
                        <b className="text-[#121e17]">{enquiryForm.customer_name}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#56615a]">Phone:</span>
                        <b>{enquiryForm.mobile_number}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#56615a]">Address:</span>
                        <b className="truncate max-w-[200px]">{enquiryForm.installation_address}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#56615a]">System Type:</span>
                        <b>{enquiryForm.solar_preference} ({enquiryForm.customer_type})</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#56615a]">Approx Capacity:</span>
                        <b>{enquiryForm.approximate_capacity}</b>
                      </div>
                      <div className="pt-2 border-t border-[#ddece0] flex justify-between text-[#006c36]">
                        <span className="font-bold">Preferred Survey:</span>
                        <b>{enquiryForm.preferred_survey_date || 'Next Open Date'} ({enquiryForm.preferred_time_window})</b>
                      </div>
                    </div>

                    <p className="text-[10px] text-[#56615a] leading-tight">
                      By submitting, our central engineering desk will create your enquiry and dispatch a certified solar technician for the site survey inspection.
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEnquiryStep(2)}
                        className="flex-1 h-10 rounded-xl bg-slate-100 text-[#121e17] font-semibold text-xs"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={enquirySubmitting}
                        className="flex-1 h-10 rounded-xl bg-[#006c36] hover:bg-[#00552a] text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md active:scale-95"
                      >
                        {enquirySubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>Confirm & Submit</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: BOOK A SERVICE VISIT (MODULE 5A)                            */}
      {/* ===================================================================== */}
      {activeModal === 'service_booking' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-2xl border border-[#ddece0] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#006c36]" />
                Book Solar Service Visit
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            {serviceSuccessMsg ? (
              <div className="p-4 my-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-center text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#006c36] mx-auto" />
                <p className="font-bold">{serviceSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleBookServiceVisit} className="mt-3 space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Service Category</label>
                  <select
                    value={serviceCategory}
                    onChange={(e) => setServiceCategory(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
                  >
                    <option value="GENERAL_MAINTENANCE">General Maintenance</option>
                    <option value="PANEL_INSPECTION">Solar Panel Inspection</option>
                    <option value="INVERTER_FAULT">Inverter Issue / Error Code</option>
                    <option value="BATTERY_ISSUE">Battery Storage Issue</option>
                    <option value="ELECTRICAL_ISSUE">Electrical / Tripping Issue</option>
                    <option value="PERFORMANCE_CONCERN">Performance / Yield Concern</option>
                    <option value="OTHER">Other Technical Service</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Description of Issue *</label>
                  <textarea
                    required
                    rows={3}
                    value={serviceDesc}
                    onChange={(e) => setServiceDesc(e.target.value)}
                    placeholder="Describe symptoms, inverter error codes, or abnormal observations..."
                    className="w-full rounded-xl border border-[#ddece0] bg-[#f4faf5] p-2.5 text-xs text-[#121e17]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#121e17] mb-1">Preferred Date</label>
                    <input
                      type="date"
                      value={serviceVisitDate}
                      onChange={(e) => setServiceVisitDate(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#121e17] mb-1">Time Slot</label>
                    <select
                      value={serviceVisitSlot}
                      onChange={(e) => setServiceVisitSlot(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2 text-xs text-[#121e17]"
                    >
                      <option value="10:00 - 12:00">10:00 - 12:00 PM</option>
                      <option value="12:00 - 14:00">12:00 - 02:00 PM</option>
                      <option value="14:00 - 16:00">02:00 - 04:00 PM</option>
                      <option value="16:00 - 18:00">04:00 - 06:00 PM</option>
                    </select>
                  </div>
                </div>

                {/* Evidence Photo Upload / Camera Stream */}
                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">
                    Photo Evidence (Optional)
                  </label>
                  {isCameraActive ? (
                    <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                      >
                        Snap Photo
                      </button>
                    </div>
                  ) : servicePhotoPreview ? (
                    <div className="relative rounded-xl overflow-hidden aspect-video border border-[#ddece0]">
                      <img src={servicePhotoPreview} alt="Evidence" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setServicePhotoFile(null);
                          setServicePhotoPreview(null);
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-[10px]"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="h-9 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-[#006c36] font-semibold text-xs flex items-center justify-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Use Camera</span>
                      </button>
                      <label className="h-9 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-[#006c36] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={serviceSubmitting}
                  className="w-full h-10 rounded-xl bg-[#006c36] hover:bg-[#00552a] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  {serviceSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Submit Service Ticket</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: REGISTER COMPLAINT (MODULE 5B)                              */}
      {/* ===================================================================== */}
      {activeModal === 'complaint' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-2xl border border-[#ddece0] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Register Customer Complaint
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            {complaintSuccessMsg ? (
              <div className="p-4 my-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-center text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-amber-600 mx-auto" />
                <p className="font-bold">{complaintSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleRegisterComplaint} className="mt-3 space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Complaint Category</label>
                  <select
                    value={complaintCategory}
                    onChange={(e) => setComplaintCategory(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
                  >
                    <option value="WORKMANSHIP_ISSUE">Workmanship / Structure Quality</option>
                    <option value="EQUIPMENT_MALFUNCTION">Component Malfunction / No Output</option>
                    <option value="INSTALLATION_DELAY">Installation Delay / Scheduling</option>
                    <option value="BILLING_INQUIRY">Billing & Invoicing Clarification</option>
                    <option value="CUSTOMER_SERVICE">Customer Support Escalation</option>
                    <option value="OTHER">Other Snag</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Complaint Details *</label>
                  <textarea
                    required
                    rows={3}
                    value={complaintDesc}
                    onChange={(e) => setComplaintDesc(e.target.value)}
                    placeholder="Provide details regarding the unresolved issue or escalation requirement..."
                    className="w-full rounded-xl border border-[#ddece0] bg-[#f4faf5] p-2.5 text-xs text-[#121e17]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Preferred Resolution Date</label>
                  <input
                    type="date"
                    value={complaintPreferredDate}
                    onChange={(e) => setComplaintPreferredDate(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={complaintSubmitting}
                  className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  {complaintSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Register Grievance Ticket</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: CUSTOMER SATISFACTION FEEDBACK (MODULE 7)                   */}
      {/* ===================================================================== */}
      {activeModal === 'feedback' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-2xl border border-[#ddece0] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                Rate Your Solar Experience
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            {feedbackSuccessMsg ? (
              <div className="p-4 my-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-center text-xs space-y-2">
                <ThumbsUp className="w-8 h-8 text-[#006c36] mx-auto" />
                <p className="font-bold">{feedbackSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="mt-3 space-y-3 text-xs">
                {/* Feedback Type Toggle */}
                <div className="flex gap-1 p-1 bg-[#f4faf5] rounded-xl border border-[#ddece0] text-center font-bold text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFeedbackTab('PRODUCT')}
                    className={`flex-1 py-1 rounded-lg ${feedbackTab === 'PRODUCT' ? 'bg-[#006c36] text-white' : 'text-[#56615a]'}`}
                  >
                    Product & System
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackTab('TECHNICIAN')}
                    className={`flex-1 py-1 rounded-lg ${feedbackTab === 'TECHNICIAN' ? 'bg-[#006c36] text-white' : 'text-[#56615a]'}`}
                  >
                    Technician Workmanship
                  </button>
                </div>

                {/* Star Rating Picker */}
                <div className="text-center py-2 bg-[#f4faf5] rounded-xl border border-[#ddece0]">
                  <span className="text-[11px] font-bold text-[#121e17] block mb-1">Overall Satisfaction Rating</span>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFeedbackRating(st)}
                        className="p-1 active:scale-125 transition-transform"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            st <= feedbackRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#56615a] mt-1 block">
                    {feedbackRating === 5
                      ? '5/5 — Outstanding performance'
                      : feedbackRating === 4
                      ? '4/5 — Very good experience'
                      : `${feedbackRating}/5 rating`}
                  </span>
                </div>

                {/* Category Ratings */}
                {feedbackTab === 'PRODUCT' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span>Solar System Energy Generation</span>
                      <select
                        value={feedbackCategoryRatings.system_performance}
                        onChange={(e) =>
                          setFeedbackCategoryRatings({ ...feedbackCategoryRatings, system_performance: parseInt(e.target.value) })
                        }
                        className="h-8 rounded-lg border border-[#ddece0] bg-[#f4faf5] px-2 text-xs"
                      >
                        <option value={5}>5 Stars - High Yield</option>
                        <option value={4}>4 Stars - As Expected</option>
                        <option value={3}>3 Stars - Average</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Physical Hardware & Mounting Build</span>
                      <select
                        value={feedbackCategoryRatings.build_quality}
                        onChange={(e) =>
                          setFeedbackCategoryRatings({ ...feedbackCategoryRatings, build_quality: parseInt(e.target.value) })
                        }
                        className="h-8 rounded-lg border border-[#ddece0] bg-[#f4faf5] px-2 text-xs"
                      >
                        <option value={5}>5 Stars - Robust HDG</option>
                        <option value={4}>4 Stars - Satisfactory</option>
                        <option value={3}>3 Stars - Moderate</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span>Field Engineer Professionalism</span>
                      <select
                        value={feedbackCategoryRatings.professionalism}
                        onChange={(e) =>
                          setFeedbackCategoryRatings({ ...feedbackCategoryRatings, professionalism: parseInt(e.target.value) })
                        }
                        className="h-8 rounded-lg border border-[#ddece0] bg-[#f4faf5] px-2 text-xs"
                      >
                        <option value={5}>5 Stars - Exemplary</option>
                        <option value={4}>4 Stars - Professional</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Site Cleanliness & Safety Handover</span>
                      <select
                        value={feedbackCategoryRatings.cleanliness}
                        onChange={(e) =>
                          setFeedbackCategoryRatings({ ...feedbackCategoryRatings, cleanliness: parseInt(e.target.value) })
                        }
                        className="h-8 rounded-lg border border-[#ddece0] bg-[#f4faf5] px-2 text-xs"
                      >
                        <option value={5}>5 Stars - Pristine</option>
                        <option value={4}>4 Stars - Good</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Comments & Suggestions</label>
                  <textarea
                    rows={2}
                    value={feedbackComments}
                    onChange={(e) => setFeedbackComments(e.target.value)}
                    placeholder="Tell us what you loved about our rooftop installation..."
                    className="w-full rounded-xl border border-[#ddece0] bg-[#f4faf5] p-2.5 text-xs text-[#121e17]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={feedbackSubmitting}
                  className="w-full h-10 rounded-xl bg-[#006c36] hover:bg-[#00552a] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  {feedbackSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Submit Verified Review</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: RESCHEDULE APPOINTMENT                                       */}
      {/* ===================================================================== */}
      {activeModal === 'reschedule_apt' && selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-[#ddece0]">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17]">Reschedule Appointment</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>
            <form onSubmit={handleRescheduleAppointment} className="mt-3 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#121e17] mb-1">New Preferred Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#121e17] mb-1">New Time Slot *</label>
                <select
                  value={rescheduleSlot}
                  onChange={(e) => setRescheduleSlot(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
                >
                  <option value="10:00 - 12:00">10:00 - 12:00 PM</option>
                  <option value="12:00 - 14:00">12:00 - 02:00 PM</option>
                  <option value="14:00 - 16:00">02:00 - 04:00 PM</option>
                  <option value="16:00 - 18:00">04:00 - 06:00 PM</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-9 rounded-xl bg-slate-100 text-[#121e17] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleLoading}
                  className="flex-1 h-9 rounded-xl bg-[#006c36] text-white font-bold text-xs flex items-center justify-center gap-1"
                >
                  {rescheduleLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Reschedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 6: CANCEL APPOINTMENT                                           */}
      {/* ===================================================================== */}
      {activeModal === 'cancel_apt' && selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-[#ddece0]">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-red-700">Cancel Appointment</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>
            <div className="mt-3 space-y-3 text-xs">
              <p className="text-[#56615a]">
                Are you sure you want to cancel appointment <b>#{selectedAppointment.appointment_number}</b> scheduled for {selectedAppointment.scheduled_date}?
              </p>
              <div>
                <label className="block text-[11px] font-bold text-[#121e17] mb-1">Reason for cancellation</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-9 rounded-xl bg-slate-100 text-[#121e17] font-semibold text-xs"
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  onClick={handleCancelAppointment}
                  disabled={cancelLoading}
                  className="flex-1 h-9 rounded-xl bg-red-600 text-white font-bold text-xs flex items-center justify-center gap-1"
                >
                  {cancelLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  <span>Confirm Cancel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 7: NOTIFICATIONS DRAWER                                         */}
      {/* ===================================================================== */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-[#ddece0] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#e3f2e6]">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#006c36]" />
                <h3 className="text-sm font-bold text-[#121e17]">In-App Notifications</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 text-[11px] text-[#56615a] border-b border-[#e3f2e6]">
              <span>{unreadCount} unread message{unreadCount !== 1 ? 's' : ''}</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllNotificationsRead}
                  className="text-[#006c36] font-bold underline"
                  type="button"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {notifications.length === 0 ? (
                <p className="text-xs text-center text-[#56615a] py-6">No notifications currently.</p>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => !notif.is_read && handleMarkNotificationRead(notif.id)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      notif.is_read
                        ? 'bg-[#f4faf5] border-[#ddece0] text-[#56615a]'
                        : 'bg-emerald-50/60 border-emerald-200 text-[#121e17] font-semibold'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px]">{notif.title}</span>
                      <span className="text-[9px] text-[#56615a]">
                        {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : 'Today'}
                      </span>
                    </div>
                    <p className="text-[11px] mt-1 text-[#56615a]">{notif.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 8: EDIT CUSTOMER PROFILE                                        */}
      {/* ===================================================================== */}
      {activeModal === 'edit_profile' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-[#ddece0]">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17]">Edit Customer Profile</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="mt-3 space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#121e17] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#121e17] mb-1">Email Address</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-3 text-xs text-[#121e17]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#121e17] mb-1">Installation Address</label>
                <textarea
                  rows={2}
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                  className="w-full rounded-xl border border-[#ddece0] bg-[#f4faf5] p-2 text-xs text-[#121e17]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-9 rounded-xl bg-slate-100 text-[#121e17] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSubmitting}
                  className="flex-1 h-9 rounded-xl bg-[#006c36] text-white font-bold text-xs"
                >
                  {profileSubmitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 9: VIEW EQUIPMENT DETAILS                                       */}
      {/* ===================================================================== */}
      {activeModal === 'view_equipment' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-2xl border border-[#ddece0]">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-[#006c36]" />
                Installed Components & Verified Serials
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-xs max-h-[60vh] overflow-y-auto">
              {[
                {
                  name: 'Waaree 550W Bifacial Mono PERC Modules',
                  serial: 'WRE-550-2026V-001',
                  count: '10 Modules (5.5 kWp Total)',
                  status: 'INSTALLED & COMMISSIONED',
                },
                {
                  name: 'Sungrow 5kW Dual-MPPT String Inverter',
                  serial: 'SNG-5K-2026-V9921',
                  count: '1 Inverter (Grid Tied)',
                  status: 'INSTALLED & COMMISSIONED',
                },
                {
                  name: 'Elevated HDG Module Mounting Structure',
                  serial: 'SP-STR-2026-HDG',
                  count: 'Hot-Dip Galvanized 80 Micron',
                  status: 'INSTALLED & COMMISSIONED',
                },
                {
                  name: 'ACDB / DCDB Protection & Surge Arrestor',
                  serial: 'SP-SPD-PUN-2026',
                  count: 'Type II SPD + MCB Set',
                  status: 'INSTALLED & COMMISSIONED',
                },
              ].map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#f4faf5] border border-[#ddece0] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#121e17]">{item.name}</span>
                    <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#56615a]">
                    <span>{item.count}</span>
                    <span className="font-mono text-[#006c36] font-bold">SN: {item.serial}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 10: VIEW WARRANTY DETAILS                                       */}
      {/* ===================================================================== */}
      {activeModal === 'view_warranty' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-2xl border border-[#ddece0]">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                25-Year Equipment Warranties
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-xs max-h-[60vh] overflow-y-auto">
              {[
                {
                  title: 'Waaree Bifacial 550W Linear Power Warranty',
                  duration: '25 Years (Active)',
                  terms: '90% power output at 10 years, 84.8% at 25 years. Validated OEM replacement coverage.',
                  days: '9,120 Days Remaining',
                },
                {
                  title: 'Sungrow 5kW Inverter Replacement Warranty',
                  duration: '10 Years (Active)',
                  terms: 'Full component and inverter exchange in case of motherboard or IGBT failure.',
                  days: '3,650 Days Remaining',
                },
                {
                  title: 'SunPower EPC Workmanship & Torquing Warranty',
                  duration: '5 Years (Active)',
                  terms: 'Zero terrace leakage guarantee and structural wind speed resistance up to 150 km/h.',
                  days: '1,825 Days Remaining',
                },
              ].map((w, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#f4faf5] border border-[#ddece0] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#121e17]">{w.title}</span>
                    <span className="text-[9px] font-extrabold bg-[#006c36] text-white px-1.5 py-0.5 rounded">
                      {w.duration}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#56615a]">{w.terms}</p>
                  <span className="text-[10px] text-[#006c36] font-bold block pt-1 border-t border-[#ddece0]">
                    {w.days}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 11: PASSPORT HANDOVER ACKNOWLEDGEMENT                          */}
      {/* ===================================================================== */}
      {activeModal === 'passport_ack' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-[#ddece0]">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17]">Acknowledge System Handover</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100" type="button">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>
            <div className="mt-3 space-y-3 text-xs">
              <p className="text-[#56615a]">
                By signing below, you acknowledge that your {activeProj.system_capacity_kw || 5.0} kWp rooftop solar system has been installed, commissioned, and demonstrated in working order with active warranties.
              </p>
              <div className="p-3 bg-[#f4faf5] rounded-xl border border-[#ddece0]">
                <span className="text-[10px] text-[#56615a] block">Electronic Sign-off Name:</span>
                <b className="text-sm text-[#121e17]">{data?.customer?.name || user?.full_name || 'Rajesh Sharma'}</b>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-9 rounded-xl bg-slate-100 text-[#121e17] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={async () => {
                    if (verifiedPassport?.id || verifiedPassport?.passport_id) {
                      await api.acknowledgeCustomerPassport({
                        passport_id: verifiedPassport.id || verifiedPassport.passport_id,
                        customer_notes: 'Verified solar hardware operational and commissioning accepted.',
                      }).catch(() => {});
                    }
                    alert('Electronic handover confirmed! Your 25-year warranty is active.');
                    setActiveModal(null);
                  }}
                  className="flex-1 h-9 rounded-xl bg-[#006c36] text-white font-bold text-xs"
                >
                  Sign & Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
