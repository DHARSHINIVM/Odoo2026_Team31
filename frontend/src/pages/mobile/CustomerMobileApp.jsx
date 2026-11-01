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
  Smartphone, Share2, Layers, Cpu, Battery, Activity
} from 'lucide-react';

export default function CustomerMobileApp({ initialData, user, onRefresh }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Local state initialized with live central backend data
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // Active Modals: null | 'specs' | 'book_apt' | 'reschedule_apt' | 'cancel_apt' | 'service_request' | 'qr_scanner' | 'passport_ack' | 'feedback' | 'edit_profile' | 'notifications'
  const [activeModal, setActiveModal] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Notifications Drawer
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(initialData?.unread_notifications_count || 0);

  // Appointments State
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [availSchedule, setAvailSchedule] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [aptType, setAptType] = useState('SITE_SURVEY');
  const [aptNotes, setAptNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [cancelReason, setCancelReason] = useState('Change of personal schedule');

  // Service Tickets & Camera Evidence State
  const [serviceTickets, setServiceTickets] = useState([]);
  const [complaintCategory, setComplaintCategory] = useState('GENERAL_QUERY');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintComponentId, setComplaintComponentId] = useState('');
  const [complaintSerial, setComplaintSerial] = useState('');
  const [complaintPhotoFile, setComplaintPhotoFile] = useState(null);
  const [complaintPhotoPreview, setComplaintPhotoPreview] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState('');

  // Hardware Camera Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // QR Scanner State
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [scannedResult, setScannedResult] = useState(null);
  const [qrScanError, setQrScanError] = useState(null);

  // Customer Feedback State
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackType, setFeedbackType] = useState('INSTALLATION');
  const [feedbackComments, setFeedbackComments] = useState('');
  const [categoryRatings, setCategoryRatings] = useState({
    timeliness: 5,
    workmanship: 5,
    cleanliness: 5,
    communication: 5
  });
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState('');

  // Profile Edit State
  const [profilePhone, setProfilePhone] = useState(initialData?.customer?.phone || '');
  const [profileEmail, setProfileEmail] = useState(initialData?.customer?.email || '');
  const [profileAddress, setProfileAddress] = useState(initialData?.customer?.address || '');
  const [contactPrefs, setContactPrefs] = useState({
    preferred_channel: 'WHATSAPP',
    notify_sms: true,
    notify_email: true,
    notify_push: true
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Load secondary lists (Appointments, Tickets, Notifications, Feedback)
  const loadAuxiliaryData = async () => {
    try {
      const [apts, tcks, notifs, fbs, prof] = await Promise.all([
        api.getCustomerAppointments().catch(() => []),
        api.getCustomerServiceTickets().catch(() => []),
        api.getCustomerNotifications().catch(() => []),
        api.getCustomerFeedback().catch(() => []),
        api.getCustomerProfile().catch(() => null)
      ]);
      setAppointmentsList(apts);
      setServiceTickets(tcks);
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
      setFeedbackList(fbs);
      if (prof) {
        setProfilePhone(prof.phone || '');
        setProfileEmail(prof.email || '');
        setProfileAddress(prof.installation_address || prof.billing_address || '');
        if (prof.contact_preferences) setContactPrefs(prof.contact_preferences);
      }
    } catch (err) {
      console.warn('Error loading secondary customer records:', err);
    }
  };

  useEffect(() => {
    loadAuxiliaryData();
  }, []);

  // Fetch slot availability when booking modal opens
  const fetchAvailability = async (type) => {
    try {
      const res = await api.getAppointmentAvailability({
        appointment_type: type || aptType,
        days_ahead: 7
      });
      if (res && res.schedule) {
        setAvailSchedule(res.schedule);
        if (res.schedule.length > 0 && !selectedDate) {
          setSelectedDate(res.schedule[0].date);
          const firstOpenSlot = res.schedule[0].slots.find(s => s.available);
          if (firstOpenSlot) setSelectedSlot(firstOpenSlot.time_slot);
        }
      }
    } catch (err) {
      console.error('Availability fetch error:', err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await api.getCustomerDashboard();
      setData(updated);
      await loadAuxiliaryData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Camera Management for Complaint Evidence
  const startCamera = async () => {
    setIsCameraActive(true);
    setComplaintPhotoFile(null);
    setComplaintPhotoPreview(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported by this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Live camera stream error, fallback to photo file input:', err.message);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
    setComplaintPhotoPreview(dataUrl);

    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `evidence_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setComplaintPhotoFile(file);
      }
    }, 'image/jpeg', 0.85);

    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setComplaintPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => setComplaintPhotoPreview(reader.result);
      reader.readAsDataURL(file);
      stopCamera();
    }
  };

  // QR Code Hardware Scanner using Camera
  const startQrScanner = async () => {
    setIsScanningQr(true);
    setQrScanError(null);
    setScannedResult(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Hardware camera not available on this device.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setQrScanError(err.message || 'Unable to access camera for QR scan.');
      setIsScanningQr(false);
    }
  };

  const simulateQrScanSuccess = async (token) => {
    stopCamera();
    setIsScanningQr(false);
    try {
      const res = await api.verifyCustomerPassportQr(token || data?.passport?.qr_code_token);
      setScannedResult(res);
    } catch (err) {
      setQrScanError(err.message || 'Invalid or unverified QR code token.');
    }
  };

  // Appointment Submission
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) {
      alert('Please select both a date and an available time slot.');
      return;
    }
    setBookingLoading(true);
    setBookingSuccessMsg('');
    try {
      const res = await api.bookCustomerAppointment({
        appointment_type: aptType,
        scheduled_date: selectedDate,
        time_slot: selectedSlot,
        customer_notes: aptNotes,
        order_id: data?.active_project?.order_id
      });
      setBookingSuccessMsg(`Appointment #${res.appointment_number} confirmed for ${selectedDate} (${selectedSlot})!`);
      await handleRefresh();
      setTimeout(() => {
        setActiveModal(null);
        setBookingSuccessMsg('');
      }, 1800);
    } catch (err) {
      alert(err.message || 'Failed to schedule appointment.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Reschedule Appointment
  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleSlot) {
      alert('Please select new preferred date and time slot.');
      return;
    }
    try {
      await api.rescheduleCustomerAppointment(selectedAppointment.id, {
        new_date: rescheduleDate,
        new_time_slot: rescheduleSlot,
        reason: 'Customer updated preferred timing'
      });
      alert('Appointment successfully rescheduled.');
      setActiveModal(null);
      await handleRefresh();
    } catch (err) {
      alert(err.message || 'Failed to reschedule.');
    }
  };

  // Cancel Appointment
  const handleCancelApt = async () => {
    if (!confirm('Are you sure you want to cancel this scheduled appointment?')) return;
    try {
      await api.cancelCustomerAppointment(selectedAppointment.id, {
        cancellation_reason: cancelReason
      });
      alert('Appointment has been cancelled.');
      setActiveModal(null);
      await handleRefresh();
    } catch (err) {
      alert(err.message || 'Failed to cancel.');
    }
  };

  // Service Request Submission with Camera Evidence Upload
  const handleCreateServiceRequest = async (e) => {
    e.preventDefault();
    if (complaintDesc.trim().length < 5) {
      alert('Please provide at least 5 characters describing the issue.');
      return;
    }
    setServiceSubmitting(true);
    setServiceSuccessMsg('');
    try {
      const ticketRes = await api.createCustomerServiceTicket({
        issue_category: complaintCategory,
        description: complaintDesc,
        component_id: complaintComponentId ? parseInt(complaintComponentId) : undefined,
        serial_number: complaintSerial || undefined,
        passport_id: data?.passport?.id,
        order_id: data?.active_project?.order_id
      });

      // If photo was captured, upload evidence persistently to backend
      if (complaintPhotoFile && ticketRes.ticket_id) {
        const formData = new FormData();
        formData.append('file', complaintPhotoFile);
        formData.append('description', `Customer photo: ${complaintCategory}`);
        await api.uploadComplaintEvidence(ticketRes.ticket_id, formData);
      }

      setServiceSuccessMsg(`Service ticket #${ticketRes.ticket_number} created! A solar technician is reviewing your case.`);
      await handleRefresh();
      setTimeout(() => {
        setActiveModal(null);
        setServiceSuccessMsg('');
        setComplaintDesc('');
        setComplaintPhotoFile(null);
        setComplaintPhotoPreview(null);
      }, 2000);
    } catch (err) {
      alert(err.message || 'Failed to register service request.');
    } finally {
      setServiceSubmitting(false);
    }
  };

  // Passport Electronic Acknowledgement
  const handleAcknowledgePassport = async () => {
    if (!data?.passport?.id) return;
    try {
      await api.acknowledgeCustomerPassport({
        passport_id: data.passport.id,
        customer_notes: 'Verified solar hardware operational and commissioning accepted.'
      });
      alert('Passport handover acknowledged! Your 25-year warranty is active.');
      setActiveModal(null);
      await handleRefresh();
    } catch (err) {
      alert(err.message || 'Failed to acknowledge passport.');
    }
  };

  // Feedback Submission
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setFeedbackSubmitting(true);
    setFeedbackSuccessMsg('');
    try {
      await api.submitCustomerFeedback({
        feedback_type: feedbackType,
        rating: feedbackRating,
        category_ratings: categoryRatings,
        comments: feedbackComments,
        order_id: data?.active_project?.order_id
      });
      setFeedbackSuccessMsg('Thank you for rating your SunPower solar experience!');
      await handleRefresh();
      setTimeout(() => {
        setActiveModal(null);
        setFeedbackSuccessMsg('');
        setFeedbackComments('');
      }, 1600);
    } catch (err) {
      alert(err.message || 'Failed to submit review.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSubmitting(true);
    try {
      await api.updateCustomerProfile({
        phone: profilePhone,
        email: profileEmail,
        installation_address: profileAddress,
        contact_preferences: contactPrefs
      });
      alert('Profile updated successfully.');
      setActiveModal(null);
      await handleRefresh();
    } catch (err) {
      alert(err.message || 'Failed to update profile.');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Notification actions
  const handleMarkNotificationRead = async (id) => {
    try {
      await api.markCustomerNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.warn(err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllCustomerNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn(err);
    }
  };

  const activeProj = data?.active_project || {};
  const milestones = data?.milestones || [];
  const hardwareItems = data?.hardware_items || [];
  const coordinator = data?.coordinator || {};
  const passport = data?.passport;
  const recentActivities = data?.recent_activity || [];

  return (
    <div className="bg-[#f4faf5] font-sans text-[#121e17] antialiased min-h-screen pb-20 selection:bg-[#006c36]/20">
      
      {/* =========================================================================
          1. Collapsible Vertical Navigation Sidebar (Matching Customer_UI Spec)
          ========================================================================= */}
      <aside
        id="main-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white/95 backdrop-blur-md border-r border-[#ddece0] flex flex-col transition-all duration-300 ${
          isSidebarExpanded ? 'w-60 shadow-xl' : 'w-16'
        }`}
      >
        {/* Top Header with Hamburger Toggle */}
        <div className="h-16 px-3 flex items-center border-b border-[#e3f2e6] shrink-0">
          <div className="flex items-center gap-2.5 w-full">
            <button
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              aria-label="Toggle Sidebar"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[#121e17] hover:bg-[#e8f7eb] active:scale-95 transition-all shrink-0"
              type="button"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            {isSidebarExpanded && (
              <div className="flex items-center gap-1.5 overflow-hidden transition-opacity duration-200">
                <Sun className="w-4 h-4 text-[#006c36]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#006c36] bg-[#006c36]/10 px-2 py-0.5 rounded">
                  SunPower
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: 'dashboard' },
            { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
            { id: 'timeline', label: 'Timeline', icon: 'linear_scale' },
            { id: 'billing', label: 'Hardware & BOM', icon: 'inventory_2' },
            { id: 'passport', label: 'Digital Passport', icon: 'qr_code_scanner' },
            { id: 'warranties', label: 'Warranties', icon: 'verified_user' },
            { id: 'appointments', label: 'Appointments', icon: 'calendar_month' },
            { id: 'support', label: 'Service & Support', icon: 'support_agent' },
            { id: 'feedback', label: 'Feedback', icon: 'rate_review' },
            { id: 'profile', label: 'My Profile', icon: 'person' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                if (isSidebarExpanded) setIsSidebarExpanded(false);
                const el = document.getElementById(item.id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className={`w-full group flex items-center gap-3 px-2.5 py-2.5 rounded-xl font-medium text-xs transition-all active:scale-95 text-left ${
                activeSection === item.id
                  ? 'text-[#006c36] bg-[#e3f2e6] border border-[#006c36]/30 font-semibold'
                  : 'text-[#56615a] hover:text-[#121e17] hover:bg-[#e8f7eb] border border-transparent'
              }`}
            >
              <span className={`material-symbols-outlined text-xl shrink-0 ${activeSection === item.id ? 'text-[#006c36]' : 'group-hover:text-[#006c36]'}`}>
                {item.icon}
              </span>
              {isSidebarExpanded && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User Card at bottom of Sidebar */}
        <div className="p-2 border-t border-[#e3f2e6] flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#006c36] text-white font-bold flex items-center justify-center text-xs shrink-0 mx-auto">
            {data?.customer?.name ? data.customer.name.charAt(0) : 'R'}
          </div>
          {isSidebarExpanded && (
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#121e17] truncate leading-tight">
                {data?.customer?.name || 'Customer'}
              </p>
              <p className="text-[9px] text-[#56615a] truncate">SP-1024</p>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          2. Top Header Bar (Fixed / Sticky)
          ========================================================================= */}
      <div className={`transition-all duration-300 ${isSidebarExpanded ? 'ml-60' : 'ml-16'}`}>
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#ddece0] px-3.5 py-2.5 flex items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#121e17] leading-tight">Customer Portal</h1>
              <span className="text-[9px] uppercase font-bold tracking-wider text-[#006c36] bg-[#006c36]/10 px-1.5 py-0.5 rounded">
                Live System
              </span>
            </div>
            <p className="text-[10px] text-[#56615a] font-medium leading-none mt-0.5">
              {activeProj.system_capacity_kw || 5.0} kWp Rooftop Installation · {data?.customer?.city || 'Pune'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Milestone Badge */}
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200/80 px-2 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-[10px] font-bold">{activeProj.current_stage_label || 'Stage 13/13'}</span>
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setActiveModal('notifications')}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#56615a] hover:bg-[#e8f7eb] active:scale-95 transition-all"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-[#006c36] hover:bg-[#e8f7eb] active:scale-95 transition-all ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              title="Refresh Telemetry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* =========================================================================
            3. Main Feed / Scrollable Modules
            ========================================================================= */}
        <main className="p-3.5 space-y-3.5 max-w-xl mx-auto w-full">

          {/* -------------------------------------------------------------
              Module 1: Overview (#overview)
              ------------------------------------------------------------- */}
          <section
            id="overview"
            className="scroll-mt-20 bg-gradient-to-br from-white via-[#f4faf5] to-[#e8f7eb]/50 rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-[#e3f2e6] text-[#006c36]">
                    Overview
                  </span>
                  <span className="text-[#56615a] text-xs">·</span>
                  <span className="text-[10px] text-[#56615a]">
                    Sync {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#121e17] tracking-tight">
                  Good morning, {data?.customer?.name || 'Customer'}
                </h2>
                <p className="text-xs text-[#56615a] mt-0.5 leading-snug">
                  {activeProj.system_capacity_kw || 5.0} kW Rooftop Solar System ({activeProj.grid_type || 'ON_GRID'})
                </p>
              </div>

              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-1 rounded-xl shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold">Active</span>
              </div>
            </div>

            {/* Critical Notice Banner */}
            <div className="mt-3 flex items-start gap-2.5 bg-[#FFF3D6] text-[#92400E] p-3 rounded-xl text-xs border border-amber-200/60">
              <span className="material-symbols-outlined text-base shrink-0 mt-0.5">verified</span>
              <div className="flex-1 leading-relaxed text-[11px]">
                <span className="font-bold">{activeProj.current_milestone_title || 'System Operational'}: </span>
                {activeProj.current_milestone_message || 'Your rooftop solar installation is generating clean electricity with active 25-year warranty.'}
              </div>
            </div>

            {/* Quick Action Pills */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => {
                  fetchAvailability('SITE_SURVEY');
                  setActiveModal('book_apt');
                }}
                className="h-9 rounded-xl bg-[#006c36] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Book Visit</span>
              </button>
              <button
                onClick={() => setActiveModal('service_request')}
                className="h-9 rounded-xl bg-white text-[#006c36] border border-[#006c36]/30 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Request Service</span>
              </button>
            </div>
          </section>

          {/* -------------------------------------------------------------
              Module 2: Analytics & System Specs (#analytics)
              ------------------------------------------------------------- */}
          <section
            id="analytics"
            className="scroll-mt-20 bg-white rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#e3f2e6]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c36] text-lg">monitoring</span>
                <h3 className="text-xs uppercase font-bold tracking-wider text-[#121e17]">
                  System Specs & Progress
                </h3>
              </div>
              <span className="text-[10px] font-bold text-[#006c36] bg-[#006c36]/10 px-2 py-0.5 rounded">
                {activeProj.momentum_pct || 100}% Done
              </span>
            </div>

            {/* 2-Column Specs Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#f4faf5] p-3 rounded-xl border border-[#ddece0]">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[#56615a] block">
                  Rated Capacity
                </span>
                <span className="text-sm font-bold text-[#121e17]">{activeProj.system_capacity_kw || 5.0} kWp</span>
                <span className="text-[10px] text-[#56615a] block mt-0.5">Tier-1 Bifacial Cells</span>
              </div>
              <div className="bg-[#f4faf5] p-3 rounded-xl border border-[#ddece0]">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[#56615a] block">
                  Target PTO / Handover
                </span>
                <span className="text-sm font-bold text-[#006c36]">{activeProj.target_pto || 'Commissioned'}</span>
                <span className="text-[10px] text-[#56615a] block mt-0.5">Grid Synchronized</span>
              </div>
            </div>

            {/* Milestone Momentum Progress Bar */}
            <div className="mt-3 bg-[#e8f7eb]/40 p-3 rounded-xl border border-[#ddece0]">
              <div className="flex justify-between items-center text-xs mb-1 font-medium">
                <span className="text-[#56615a] text-[11px]">Milestone Momentum</span>
                <span className="text-[#006c36] font-bold text-[11px]">{activeProj.momentum_pct || 100}% Completed</span>
              </div>
              <div className="w-full bg-[#ddece0] rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#006c36] h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${activeProj.momentum_pct || 100}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => setActiveModal('specs')}
                className="h-9 rounded-xl bg-[#006c36] text-white font-semibold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-transform"
              >
                <span>Technical Specs</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (passport) {
                    window.open(passport.public_url || `/passport/public/${passport.qr_code_token}`, '_blank');
                  } else {
                    alert('Digital Passport available upon commissioning.');
                  }
                }}
                className="h-9 rounded-xl bg-[#e8f7eb] text-[#006c36] font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Verify Token</span>
              </button>
            </div>
          </section>

          {/* -------------------------------------------------------------
              Module 3: 13-Stage Project Timeline (#timeline)
              ------------------------------------------------------------- */}
          <section
            id="timeline"
            className="scroll-mt-20 bg-white rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-600 text-lg">linear_scale</span>
                <div>
                  <h3 className="text-xs uppercase font-bold tracking-wider text-[#56615a] leading-none">
                    Project Milestones
                  </h3>
                  <p className="text-xs font-bold text-[#121e17] mt-0.5">
                    {activeProj.current_stage_label || 'Stage 13/13'}: {activeProj.current_milestone_title || 'Warranty Activated'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-[#56615a] bg-[#f4faf5] px-2 py-0.5 rounded border border-[#ddece0]">
                Updated Today
              </span>
            </div>

            {/* Horizontal Timeline Ribbon with all 13 customer-friendly milestones */}
            <div className="relative overflow-x-auto no-scrollbar py-2.5 px-1 flex items-start gap-1 w-full">
              {milestones.map((m, idx) => (
                <React.Fragment key={m.step}>
                  <div className="flex flex-col items-center text-center shrink-0 w-20">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm text-xs font-bold ${
                        m.is_completed
                          ? 'bg-[#006c36] text-white'
                          : m.is_active
                          ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400'
                          : 'bg-[#e3f2e6] text-[#56615a]'
                      }`}
                    >
                      {m.is_completed ? <Check className="w-3.5 h-3.5" /> : m.step}
                    </div>
                    <span className="text-[10px] font-semibold text-[#121e17] mt-1 truncate max-w-[76px]">
                      {m.title}
                    </span>
                    <span className={`text-[8.5px] mt-0.5 font-medium ${
                      m.is_completed ? 'text-[#006c36]' : m.is_active ? 'text-amber-700 bg-amber-50 px-1 rounded' : 'text-[#56615a]'
                    }`}>
                      {m.is_completed ? 'Done' : m.is_active ? 'In Progress' : 'Pending'}
                    </span>
                  </div>

                  {idx < milestones.length - 1 && (
                    <div
                      className={`w-3.5 h-0.5 mt-3.5 -mx-1 shrink-0 ${
                        m.is_completed ? 'bg-[#006c36]' : 'bg-[#ddece0]'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Detailed Active Step Explanation (Customer Safe) */}
            <div className="mt-2.5 p-3 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#121e17]">
                  {activeProj.current_milestone_title || 'Completed'}
                </span>
                <span className="text-[10px] text-[#006c36] font-semibold bg-[#006c36]/10 px-1.5 py-0.2 rounded">
                  Verified
                </span>
              </div>
              <p className="text-[#56615a] leading-relaxed text-[11px]">
                {activeProj.current_milestone_message || 'All structural, electrical, and grid synchronization testing completed.'}
              </p>
            </div>
          </section>

          {/* -------------------------------------------------------------
              Module 4: Billing, Materials & Hardware Readiness (#billing)
              ------------------------------------------------------------- */}
          <section
            id="billing"
            className="scroll-mt-20 bg-white rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[#e3f2e6]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#e3f2e6] flex items-center justify-center text-[#006c36]">
                  <span className="material-symbols-outlined text-lg">precision_manufacturing</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#121e17]">Materials & Hardware</h3>
                  <span className="text-[11px] text-[#56615a] font-medium">BOM Components</span>
                </div>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-[#e8f7eb] text-[#006c36] px-2 py-0.5 rounded">
                {data?.ready_hardware_count || 4} of {data?.total_hardware_count || 4} Ready
              </span>
            </div>

            <ul className="py-2.5 space-y-2 text-xs">
              {hardwareItems.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-[#f4faf5] border border-[#ddece0]"
                >
                  <div className="flex items-center gap-2 font-medium text-[#121e17] text-[11px]">
                    <CheckCircle2 className="w-4 h-4 text-[#006c36] shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    item.status === 'Installed' || item.status === 'Ready' || item.status === 'Allocated'
                      ? 'text-[#006c36] bg-[#006c36]/10'
                      : 'text-amber-800 bg-amber-100'
                  }`}>
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => alert(`Central Warehouse Depot Dispatched: Consignment #DSP-2026-001 with vehicle MH-12-SP-2026. Driver: Kishore Gaikwad (+91 98220 77112).`)}
              className="w-full h-10 rounded-xl bg-[#e8f7eb] hover:bg-[#e3f2e6] text-[#006c36] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-base">local_shipping</span>
              <span>Track Depot Logistics Consignment</span>
            </button>
          </section>

          {/* -------------------------------------------------------------
              Module 5: Digital Solar Passport & QR Scanner (#passport)
              ------------------------------------------------------------- */}
          <section
            id="passport"
            className="scroll-mt-20 bg-gradient-to-br from-[#064e3b] via-[#006c36] to-[#022c22] text-white rounded-2xl p-4 shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="bg-white/20 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Official Token
                  </span>
                  <span className="text-white/60 text-xs">·</span>
                  <span className="text-white/80 text-[10px]">
                    {passport?.commissioning_date || 'Active'}
                  </span>
                </div>
                <h3 className="text-base font-bold tracking-tight">Digital Solar Passport</h3>
                <p className="text-xs text-white/80 mt-0.5">
                  Cert #{passport?.passport_number || 'DSP-MH-2026-0081'}
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <Shield className="w-5 h-5 text-emerald-300" />
              </div>
            </div>

            {/* Passport QR Code Display */}
            <div className="mt-4 bg-white text-[#121e17] p-3 rounded-xl flex items-center gap-3.5">
              <div
                className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden"
                dangerouslySetInnerHTML={{
                  __html: passport?.qr_code_svg || `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#006c36"/><text x="50" y="55" font-size="12" fill="#fff" text-anchor="middle">QR CODE</text></svg>`
                }}
              />
              <div className="flex-1 min-w-0 text-xs">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[#56615a] block">
                  Encrypted Asset Key
                </span>
                <span className="font-mono text-[11px] font-bold text-[#006c36] truncate block mt-0.5">
                  {passport?.qr_code_token || 'token_dsp_rajesh_sharma_5kw_pune_2026'}
                </span>
                <p className="text-[10px] text-[#56615a] mt-1 leading-snug">
                  Scan this token with any device camera to verify official capacity, component serials, and warranty registration.
                </p>
              </div>
            </div>

            {/* Passport Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="bg-white/10 rounded-xl p-2">
                <span className="text-[9px] text-white/70 block uppercase font-medium">Health</span>
                <span className="text-sm font-bold text-emerald-300">
                  {passport?.system_health_score || 98}%
                </span>
              </div>
              <div className="bg-white/10 rounded-xl p-2">
                <span className="text-[9px] text-white/70 block uppercase font-medium">Yield</span>
                <span className="text-sm font-bold text-white">
                  {passport?.lifetime_mwh || 187.5} MWh
                </span>
              </div>
              <div className="bg-white/10 rounded-xl p-2">
                <span className="text-[9px] text-white/70 block uppercase font-medium">CO₂ Saved</span>
                <span className="text-sm font-bold text-white">
                  {passport?.co2_tonnes || 153.8} T
                </span>
              </div>
            </div>

            {/* QR Scanner and Sign-off Actions */}
            <div className="grid grid-cols-2 gap-2 mt-3.5">
              <button
                onClick={() => {
                  setActiveModal('qr_scanner');
                  startQrScanner();
                }}
                className="h-9 rounded-xl bg-white text-[#006c36] font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan QR Code</span>
              </button>
              <button
                onClick={() => setActiveModal('passport_ack')}
                className="h-9 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Acknowledge Handover</span>
              </button>
            </div>
          </section>

          {/* -------------------------------------------------------------
              Module 6: Warranty Management (#warranties)
              ------------------------------------------------------------- */}
          <section
            id="warranties"
            className="scroll-mt-20 bg-white rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#e3f2e6]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c36] text-lg">verified_user</span>
                <h3 className="text-xs uppercase font-bold tracking-wider text-[#121e17]">
                  Equipment Warranties
                </h3>
              </div>
              <span className="text-[10px] font-bold text-[#006c36] bg-[#006c36]/10 px-2 py-0.5 rounded">
                Verified Active
              </span>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  title: 'Waaree 550W Bifacial PV Modules',
                  serial: 'WRE-550-2026V-001',
                  type: 'Linear Power & Product Warranty',
                  duration: '25 Years',
                  expiry: '2051-10-31',
                  days: '9,120 Days Remaining',
                  status: 'ACTIVE'
                },
                {
                  title: 'Sungrow / Growatt 5kW String Inverter',
                  serial: 'SNG-5K-2026-V9921',
                  type: 'Product Replacement Warranty',
                  duration: '10 Years',
                  expiry: '2036-10-31',
                  days: '3,650 Days Remaining',
                  status: 'ACTIVE'
                },
                {
                  title: 'Elevated HDG Structure & Workmanship',
                  serial: 'SP-EPC-WRK-2026',
                  type: 'EPC Workmanship & Torquing',
                  duration: '5 Years',
                  expiry: '2031-10-31',
                  days: '1,825 Days Remaining',
                  status: 'ACTIVE'
                }
              ].map((w, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-xs space-y-1.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-[#121e17]">{w.title}</h4>
                      <p className="text-[10px] text-[#56615a] font-mono mt-0.5">SN: {w.serial}</p>
                    </div>
                    <span className="text-[9px] font-bold text-[#006c36] bg-[#006c36]/10 px-1.5 py-0.5 rounded">
                      {w.duration}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#ddece0] text-[#56615a]">
                    <span>{w.type}</span>
                    <span className="font-semibold text-[#006c36]">{w.days}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* -------------------------------------------------------------
              Module 7: Appointments & Visit Scheduling (#appointments)
              ------------------------------------------------------------- */}
          <section
            id="appointments"
            className="scroll-mt-20 bg-white rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#e3f2e6]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c36] text-lg">calendar_month</span>
                <h3 className="text-xs uppercase font-bold tracking-wider text-[#121e17]">
                  Field Appointments
                </h3>
              </div>
              <button
                onClick={() => {
                  fetchAvailability('SITE_SURVEY');
                  setActiveModal('book_apt');
                }}
                className="text-[10px] font-bold text-white bg-[#006c36] px-2 py-1 rounded-lg flex items-center gap-1 active:scale-95"
              >
                <span>+ Request Slot</span>
              </button>
            </div>

            {appointmentsList.length === 0 ? (
              <div className="p-4 text-center text-[#56615a] text-xs bg-[#f4faf5] rounded-xl border border-[#ddece0]">
                <Calendar className="w-6 h-6 mx-auto mb-1 text-[#006c36]/60" />
                <p>No active field appointments currently scheduled.</p>
                <button
                  onClick={() => {
                    fetchAvailability('SITE_SURVEY');
                    setActiveModal('book_apt');
                  }}
                  className="mt-2 text-[11px] font-bold text-[#006c36] underline"
                >
                  Schedule Site Inspection Visit
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {appointmentsList.map(apt => (
                  <div
                    key={apt.id}
                    className="p-3 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#121e17]">{apt.appointment_type.replace('_', ' ')}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          apt.status === 'CONFIRMED'
                            ? 'text-emerald-800 bg-emerald-100'
                            : apt.status === 'REQUESTED'
                            ? 'text-amber-800 bg-amber-100'
                            : apt.status === 'RESCHEDULED'
                            ? 'text-blue-800 bg-blue-100'
                            : 'text-slate-600 bg-slate-100'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#56615a] mt-0.5">
                        {apt.scheduled_date} · {apt.time_slot}
                      </p>
                      <p className="text-[10px] text-[#56615a]">Engineer: {apt.technician_name}</p>
                    </div>

                    {apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setRescheduleDate(apt.scheduled_date);
                            setRescheduleSlot(apt.time_slot);
                            setActiveModal('reschedule_apt');
                          }}
                          className="px-2 py-1 text-[10px] font-semibold bg-white border border-[#ddece0] rounded-lg text-[#121e17] hover:bg-slate-50"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setActiveModal('cancel_apt');
                          }}
                          className="px-2 py-1 text-[10px] font-semibold bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* -------------------------------------------------------------
              Module 8: Support & Assigned Coordinator (#support)
              ------------------------------------------------------------- */}
          <section
            id="support"
            className="scroll-mt-20 bg-white rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-[#006c36]">
                <span className="material-symbols-outlined text-lg">support_agent</span>
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Assigned Project Coordinator
                </span>
              </div>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Online
              </span>
            </div>

            <div className="flex items-center gap-3 bg-[#f4faf5] p-3 rounded-xl border border-[#ddece0]">
              <div className="w-10 h-10 rounded-full bg-[#006c36] text-white flex items-center justify-center font-bold text-sm shrink-0">
                {coordinator.name ? coordinator.name.charAt(0) : 'V'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[#121e17] truncate">{coordinator.name || 'Vikram Rao'}</h4>
                <p className="text-[11px] text-[#56615a] truncate">{coordinator.title || 'Solar Project Lead'}</p>
                <a
                  className="text-[11px] font-semibold text-[#006c36] inline-flex items-center gap-1 mt-0.5"
                  href={`tel:${coordinator.phone || '+914067892200'}`}
                >
                  <Phone className="w-3 h-3" />
                  <span>{coordinator.phone || '+91 40 6789 2200'}</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <a
                className="h-9 rounded-xl bg-[#e8f7eb] hover:bg-[#e3f2e6] text-[#006c36] font-semibold text-xs flex items-center justify-center gap-1 active:scale-95 transition-transform"
                href={`tel:${coordinator.phone || '+914067892200'}`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Coordinator</span>
              </a>
              <button
                onClick={() => setActiveModal('service_request')}
                className="h-9 rounded-xl bg-[#006c36] text-white font-semibold text-xs flex items-center justify-center gap-1 active:scale-95 transition-transform"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Log Service Snag</span>
              </button>
            </div>

            {/* Open Service Complaints List */}
            {serviceTickets.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#e3f2e6]">
                <h4 className="text-[11px] font-bold text-[#121e17] mb-2">Active Service Requests</h4>
                <div className="space-y-2">
                  {serviceTickets.map(tck => (
                    <div
                      key={tck.id}
                      className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#121e17]">#{tck.ticket_number}</span>
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          {tck.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#56615a] mt-1">{tck.description}</p>
                      {tck.resolution_notes && (
                        <p className="text-[10px] text-emerald-700 bg-emerald-50 p-1.5 rounded mt-1.5 font-medium">
                          Resolution: {tck.resolution_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* -------------------------------------------------------------
              Module 9: Customer Feedback (#feedback)
              ------------------------------------------------------------- */}
          <section
            id="feedback"
            className="scroll-mt-20 bg-white rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#e3f2e6]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c36] text-lg">rate_review</span>
                <h3 className="text-xs uppercase font-bold tracking-wider text-[#121e17]">
                  Customer Satisfaction
                </h3>
              </div>
              <button
                onClick={() => setActiveModal('feedback')}
                className="text-[10px] font-bold text-[#006c36] bg-[#006c36]/10 px-2 py-0.5 rounded active:scale-95"
              >
                + Leave Review
              </button>
            </div>

            {feedbackList.length === 0 ? (
              <div className="p-4 text-center text-[#56615a] text-xs bg-[#f4faf5] rounded-xl border border-[#ddece0]">
                <Star className="w-6 h-6 mx-auto mb-1 text-amber-400" />
                <p>No verified feedback recorded yet.</p>
                <button
                  onClick={() => setActiveModal('feedback')}
                  className="mt-2 text-[11px] font-bold text-[#006c36] underline"
                >
                  Rate Your Solar Installation Experience
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {feedbackList.map(fb => (
                  <div
                    key={fb.id}
                    className="p-3 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map(st => (
                          <Star
                            key={st}
                            className={`w-3.5 h-3.5 ${st <= fb.rating ? 'fill-amber-400' : 'text-slate-300'}`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-[#56615a]">{fb.created_at}</span>
                    </div>
                    {fb.comments && (
                      <p className="text-[11px] text-[#121e17] mt-1.5 italic">"{fb.comments}"</p>
                    )}
                    <span className="text-[9px] text-[#006c36] font-semibold block mt-1">
                      Verified Audit Submission
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* -------------------------------------------------------------
              Module 10: Verified Activity Log (#activity)
              ------------------------------------------------------------- */}
          <section
            id="activity"
            className="bg-white rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h3 className="text-xs font-bold text-[#121e17]">Recent Activity</h3>
                <p className="text-[10px] text-[#56615a]">Verified project approval log</p>
              </div>
              <span className="text-[10px] font-semibold text-[#56615a] bg-[#f4faf5] px-2 py-0.5 rounded border border-[#ddece0]">
                Live Feed
              </span>
            </div>

            <div className="space-y-2.5 pl-2 border-l-2 border-[#e3f2e6] text-xs">
              {recentActivities.map((act, idx) => (
                <div key={idx} className="relative pl-3">
                  <div className={`absolute -left-[13px] top-1.5 w-2 h-2 rounded-full ${
                    act.is_highlight ? 'bg-[#006c36] ring-2 ring-emerald-200' : 'bg-[#56615a]'
                  }`}></div>
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
          </section>

          {/* -------------------------------------------------------------
              Module 11: Customer Profile & Account (#profile)
              ------------------------------------------------------------- */}
          <section
            id="profile"
            className="scroll-mt-20 bg-white rounded-2xl p-4 shadow-sm border border-[#ddece0]"
          >
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#e3f2e6]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c36] text-lg">person</span>
                <h3 className="text-xs uppercase font-bold tracking-wider text-[#121e17]">
                  Customer Account & Profile
                </h3>
              </div>
              <button
                onClick={() => setActiveModal('edit_profile')}
                className="text-[10px] font-bold text-[#006c36] underline"
              >
                Edit Details
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0]">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[#56615a] block">Full Name</span>
                <span className="font-bold text-[#121e17]">{data?.customer?.name || 'Rajesh Sharma'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0]">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[#56615a] block">Phone Number</span>
                <span className="font-bold text-[#121e17]">{profilePhone || '+91 98230 11223'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0]">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[#56615a] block">Consumer No.</span>
                <span className="font-bold text-[#121e17]">{data?.customer?.consumer_number || 'MSEDCL-PUN-849201'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0]">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[#56615a] block">Sanctioned Load</span>
                <span className="font-bold text-[#121e17]">6.0 kW</span>
              </div>
            </div>

            <div className="mt-2.5 p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] text-xs">
              <span className="text-[9px] uppercase font-bold tracking-wider text-[#56615a] block">Installation Site</span>
              <span className="font-medium text-[#121e17]">{profileAddress || 'Baner Road, Pune'}</span>
            </div>

            {/* Logout Button */}
            <div className="mt-3.5 pt-2.5 border-t border-[#e3f2e6] flex items-center justify-between">
              <span className="text-[10px] text-[#56615a]">Signed in as Customer ({user?.username})</span>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-xs flex items-center gap-1 active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </section>

        </main>
      </div>

      {/* =========================================================================
          MODALS & OVERLAYS
          ========================================================================= */}

      {/* Modal: Book Appointment */}
      {activeModal === 'book_apt' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-[#ddece0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#006c36]" />
                Book Field Appointment
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            {bookingSuccessMsg ? (
              <div className="p-4 my-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#006c36]" />
                <p className="font-bold">{bookingSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleBookAppointment} className="space-y-3 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Visit Type</label>
                  <select
                    value={aptType}
                    onChange={(e) => {
                      setAptType(e.target.value);
                      fetchAvailability(e.target.value);
                    }}
                    className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17] focus:outline-none focus:ring-2 focus:ring-[#006c36]"
                  >
                    <option value="SITE_SURVEY">Site Survey & Roof Audit</option>
                    <option value="INSTALLATION">Installation & Commissioning</option>
                    <option value="SERVICE">Service & Maintenance Inspection</option>
                    <option value="CONSULTATION">Engineering Consultation</option>
                  </select>
                </div>

                {/* Available Date Picker */}
                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Preferred Date</label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
                  >
                    {availSchedule.map(s => (
                      <option key={s.date} value={s.date}>
                        {s.date} ({s.day_name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slot Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Available Time Slot</label>
                  <div className="grid grid-cols-2 gap-2">
                    {availSchedule.find(s => s.date === selectedDate)?.slots.map(sl => (
                      <button
                        key={sl.time_slot}
                        type="button"
                        disabled={!sl.available}
                        onClick={() => setSelectedSlot(sl.time_slot)}
                        className={`p-2 rounded-xl border text-center text-xs transition-all ${
                          selectedSlot === sl.time_slot
                            ? 'bg-[#006c36] text-white border-[#006c36] font-bold'
                            : sl.available
                            ? 'bg-[#f4faf5] border-[#ddece0] text-[#121e17] hover:bg-[#e8f7eb]'
                            : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <div>{sl.time_slot}</div>
                        <span className="text-[9px] block opacity-80">{sl.reason}</span>
                      </button>
                    )) || (
                      <p className="col-span-2 text-slate-400">Loading open slots from central scheduler...</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Notes for Technician</label>
                  <textarea
                    rows={2}
                    value={aptNotes}
                    onChange={(e) => setAptNotes(e.target.value)}
                    placeholder="e.g. Parapet roof access available from side staircase."
                    className="w-full rounded-xl border border-[#ddece0] bg-[#f4faf5] p-2 text-xs text-[#121e17]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="w-full h-10 rounded-xl bg-[#006c36] text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
                  >
                    {bookingLoading ? 'Registering with Central Scheduler...' : 'Confirm Appointment Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Service Request with Live Device Camera Photo Capture */}
      {activeModal === 'service_request' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-[#ddece0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#006c36]" />
                Log After-Sales Service Request
              </h3>
              <button
                onClick={() => {
                  stopCamera();
                  setActiveModal(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            {serviceSuccessMsg ? (
              <div className="p-4 my-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#006c36]" />
                <p className="font-bold">{serviceSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleCreateServiceRequest} className="space-y-3 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Complaint Category</label>
                  <select
                    value={complaintCategory}
                    onChange={(e) => setComplaintCategory(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
                  >
                    <option value="GENERAL_QUERY">General Operational Query / Monitoring</option>
                    <option value="INVERTER_FAULT">Inverter Fault / LED Error Code</option>
                    <option value="PANEL_DAMAGE">Solar Panel Damage / Physical Defect</option>
                    <option value="GRID_TRIP">Grid Synchronization / MCB Tripping</option>
                    <option value="GENERATION_DROP">Generation Drop / Low Solar Yield</option>
                    <option value="WIRING_ISSUE">DC/AC Cabling or Conduit Looseness</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Issue Description</label>
                  <textarea
                    rows={3}
                    value={complaintDesc}
                    onChange={(e) => setComplaintDesc(e.target.value)}
                    placeholder="Describe symptoms observed (e.g. Inverter red light flashing at noon)."
                    required
                    className="w-full rounded-xl border border-[#ddece0] bg-[#f4faf5] p-2 text-xs text-[#121e17]"
                  />
                </div>

                {/* Device Camera Integration for Photo Evidence */}
                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">
                    Photograph Evidence (Camera Capture)
                  </label>

                  {isCameraActive ? (
                    <div className="space-y-2">
                      <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="flex-1 h-9 rounded-xl bg-[#006c36] text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Capture Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 h-9 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : complaintPhotoPreview ? (
                    <div className="space-y-2">
                      <div className="relative rounded-xl overflow-hidden aspect-video border border-[#ddece0]">
                        <img src={complaintPhotoPreview} alt="Evidence" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="flex-1 h-8 rounded-xl bg-[#e8f7eb] text-[#006c36] font-semibold text-xs flex items-center justify-center gap-1"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Retake Camera Snapshot</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setComplaintPhotoFile(null);
                            setComplaintPhotoPreview(null);
                          }}
                          className="px-2.5 h-8 rounded-xl bg-red-50 text-red-700 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="h-10 rounded-xl bg-[#e8f7eb] hover:bg-[#e3f2e6] text-[#006c36] font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Launch Camera</span>
                      </button>
                      <label className="h-10 rounded-xl bg-[#f4faf5] border border-[#ddece0] hover:bg-slate-100 text-[#56615a] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
                        <Upload className="w-4 h-4" />
                        <span>Upload File</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={serviceSubmitting}
                    className="w-full h-10 rounded-xl bg-[#006c36] text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
                  >
                    {serviceSubmitting ? 'Registering Service Ticket...' : 'Submit Service Complaint'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: QR Code Scanner */}
      {activeModal === 'qr_scanner' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-[#ddece0]">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-[#006c36]" />
                Scan Digital Passport QR
              </h3>
              <button
                onClick={() => {
                  stopCamera();
                  setActiveModal(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                <div className="absolute inset-8 border-2 border-dashed border-[#006c36] rounded-xl pointer-events-none animate-pulse"></div>
              </div>

              {scannedResult ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl">
                  <p className="font-bold">Verified SunPower Passport!</p>
                  <p className="text-[11px] mt-0.5">Cert #{scannedResult.passport_number}</p>
                  <p className="text-[10px] text-emerald-700">Capacity: {scannedResult.system_capacity_kw} kWp</p>
                </div>
              ) : (
                <p className="text-[#56615a] text-center text-[11px]">
                  Align device camera with the pure SVG QR code on your site inverter box.
                </p>
              )}

              {/* Demo Scan Trigger */}
              <button
                type="button"
                onClick={() => simulateQrScanSuccess(data?.passport?.qr_code_token)}
                className="w-full h-9 rounded-xl bg-[#006c36] text-white font-bold text-xs"
              >
                Simulate Verified Camera Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Passport Acknowledgement */}
      {activeModal === 'passport_ack' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-[#ddece0] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#006c36]" />
                Electronic Customer Sign-off
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <p className="text-[#56615a] leading-relaxed">
                I, <span className="font-bold text-[#121e17]">{data?.customer?.name}</span>, acknowledge that the
                solar photovoltaic installation (#{passport?.passport_number || 'DSP-2026-0001'}) has been handed over in operational condition following successful grid synchronization.
              </p>

              <div className="p-3 bg-[#f4faf5] rounded-xl border border-[#ddece0]">
                <div className="flex justify-between text-[11px] font-semibold text-[#121e17]">
                  <span>System Capacity</span>
                  <span>{passport?.system_capacity_kw || 5.0} kWp</span>
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-[#121e17] mt-1">
                  <span>Earthing Test</span>
                  <span className="text-[#006c36]">Passed (&lt;5Ω)</span>
                </div>
              </div>

              <button
                onClick={handleAcknowledgePassport}
                className="w-full h-10 rounded-xl bg-[#006c36] text-white font-bold text-xs active:scale-95"
              >
                Confirm Electronic Sign-Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Customer Feedback / Review */}
      {activeModal === 'feedback' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-[#ddece0] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                Rate Solar Installation & Service
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            {feedbackSuccessMsg ? (
              <div className="p-4 my-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#006c36]" />
                <p className="font-bold">{feedbackSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-3 mt-3">
                {/* 5-Star Interactive Rating */}
                <div className="text-center py-2 bg-[#f4faf5] rounded-xl border border-[#ddece0]">
                  <span className="text-[11px] font-bold text-[#56615a] block mb-1">Overall Satisfaction</span>
                  <div className="flex items-center justify-center gap-1.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map(st => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFeedbackRating(st)}
                        className="p-1 text-xl hover:scale-110 transition-transform"
                      >
                        <Star className={`w-6 h-6 ${st <= feedbackRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#006c36] font-bold mt-1 block">
                    {feedbackRating === 5 ? 'Exceptional Workmanship' : `${feedbackRating} Star Rating`}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#121e17] mb-1">Comments & Experience</label>
                  <textarea
                    rows={3}
                    value={feedbackComments}
                    onChange={(e) => setFeedbackComments(e.target.value)}
                    placeholder="Share your thoughts on the crew, punctuality, and solar generation."
                    required
                    className="w-full rounded-xl border border-[#ddece0] bg-[#f4faf5] p-2 text-xs text-[#121e17]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={feedbackSubmitting}
                  className="w-full h-10 rounded-xl bg-[#006c36] text-white font-bold text-xs active:scale-95"
                >
                  {feedbackSubmitting ? 'Recording Audit Review...' : 'Submit Verified Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: In-App Notifications Drawer */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-[#ddece0] text-xs max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <div className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#006c36]" />
                <h3 className="text-sm font-bold text-[#121e17]">In-App Notifications</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllNotificationsRead}
                  className="text-[10px] text-[#006c36] font-bold underline"
                >
                  Mark All Read
                </button>
                <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X className="w-4 h-4 text-[#56615a]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
              {notifications.length === 0 ? (
                <p className="text-center text-slate-400 py-6">No notifications received.</p>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleMarkNotificationRead(n.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      n.is_read
                        ? 'bg-[#f4faf5] border-[#ddece0] opacity-80'
                        : 'bg-emerald-50/70 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-[#121e17]">{n.title}</span>
                      <span className="text-[9px] text-[#56615a]">{n.created_at}</span>
                    </div>
                    <p className="text-[11px] text-[#56615a] mt-0.5">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Customer Profile */}
      {activeModal === 'edit_profile' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-[#ddece0] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17]">Edit Contact & Preferences</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3 mt-3">
              <div>
                <label className="block text-[11px] font-bold text-[#121e17] mb-1">Phone Number</label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#121e17] mb-1">Email Address</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#ddece0] bg-[#f4faf5] px-2.5 text-xs text-[#121e17]"
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

              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] space-y-2">
                <span className="text-[10px] font-bold text-[#121e17] block">Communication Channel</span>
                <div className="flex gap-4">
                  {['WHATSAPP', 'SMS', 'EMAIL'].map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="channel"
                        checked={contactPrefs.preferred_channel === ch}
                        onChange={() => setContactPrefs(p => ({ ...p, preferred_channel: ch }))}
                        className="text-[#006c36]"
                      />
                      <span className="text-[11px]">{ch}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={profileSubmitting}
                className="w-full h-10 rounded-xl bg-[#006c36] text-white font-bold text-xs active:scale-95"
              >
                {profileSubmitting ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Full Technical Specs */}
      {activeModal === 'specs' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-[#ddece0] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#e3f2e6]">
              <h3 className="text-sm font-bold text-[#121e17] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#006c36]" />
                Technical Engineering Specifications
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-[#56615a]" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] flex justify-between">
                <span className="text-[#56615a]">System Capacity:</span>
                <span className="font-bold text-[#121e17]">{activeProj.system_capacity_kw || 5.0} kWp</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] flex justify-between">
                <span className="text-[#56615a]">Grid Architecture:</span>
                <span className="font-bold text-[#121e17]">{activeProj.grid_type || 'ON_GRID'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] flex justify-between">
                <span className="text-[#56615a]">Modules:</span>
                <span className="font-bold text-[#121e17]">10x Waaree 550W Bifacial Dual Glass</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] flex justify-between">
                <span className="text-[#56615a]">Inverter:</span>
                <span className="font-bold text-[#121e17]">Sungrow / Growatt 5000TL (1 unit)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] flex justify-between">
                <span className="text-[#56615a]">Rooftop Azimuth / Tilt:</span>
                <span className="font-bold text-[#121e17]">180° South / 15° Angle</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f4faf5] border border-[#ddece0] flex justify-between">
                <span className="text-[#56615a]">Earthing Resistance:</span>
                <span className="font-bold text-[#006c36]">1.85 Ω (Cleared &lt;5Ω Standard)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Bottom Navigation Bar (Prompt Section 2.E: Home, Projects, Bookings, Passport, Profile)
          ========================================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#ddece0] px-4 py-1.5 flex items-center justify-around shadow-lg md:max-w-md md:mx-auto">
        {[
          { id: 'overview', label: 'Home', icon: 'home' },
          { id: 'timeline', label: 'Projects', icon: 'solar_power' },
          { id: 'appointments', label: 'Bookings', icon: 'calendar_month' },
          { id: 'passport', label: 'Passport', icon: 'qr_code_scanner' },
          { id: 'profile', label: 'Profile', icon: 'person' },
        ].map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                const el = document.getElementById(item.id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all active:scale-95 ${
                isActive
                  ? 'text-[#006c36] font-bold'
                  : 'text-[#56615a] hover:text-[#121e17]'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${isActive ? 'text-[#006c36]' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[10px] tracking-tight">{item.label}</span>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#006c36] -mt-0.5" />}
            </button>
          );
        })}
      </nav>

    </div>
  );
}
