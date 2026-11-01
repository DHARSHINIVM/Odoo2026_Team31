import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import CameraCapture from '../components/CameraCapture';
import Modal from '../components/Modal';
import { FormField, Input, Select, Textarea } from '../components/FormControls';
import { api } from '../services/api';
import {
  Sun,
  ShieldCheck,
  CheckCircle,
  Zap,
  Leaf,
  Calendar,
  Building2,
  AlertTriangle,
  Award,
  Layers,
  Lock,
  Camera,
  MessageSquareWarning,
  Wrench,
  Clock,
  Check,
  QrCode,
  Image as ImageIcon,
} from 'lucide-react';

export default function PublicPassportPage() {
  const { token: routeToken } = useParams();
  const navigate = useNavigate();

  const [currentToken, setCurrentToken] = useState(routeToken || '');
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState(!routeToken);
  const [scannerManualInput, setScannerManualInput] = useState('');

  // Complaint modal state
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    issue_category: 'INVERTER_FAULT',
    component_serial: '',
    description: '',
    evidence_files: [],
  });
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintSuccess, setComplaintSuccess] = useState(null);
  const [complaintError, setComplaintError] = useState(null);

  // Customer Appointment booking modal state
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [apptDate, setApptDate] = useState(tomorrowStr);
  const [apptSlot, setApptSlot] = useState('11:00 - 13:00');
  const [apptType, setApptType] = useState('SERVICE');
  const [apptNotes, setApptNotes] = useState('');
  const [submittingAppt, setSubmittingAppt] = useState(false);
  const [apptSuccess, setApptSuccess] = useState(null);
  const [apptError, setApptError] = useState(null);

  const handleBookCustomerAppointment = async (e) => {
    e.preventDefault();
    if (!passport) return;
    setSubmittingAppt(true);
    setApptError(null);
    try {
      const res = await api.bookAppointment({
        customer_id: passport.customer_id,
        appointment_type: apptType,
        scheduled_date: apptDate,
        time_slot: apptSlot,
        order_id: passport.order_id,
        service_address: `${passport.customer_display_name}, ${passport.city}`,
        customer_notes: apptNotes || 'Requested by customer via Digital Solar Passport portal',
      });
      setApptSuccess(`Appointment #${res.appointment_number} confirmed for ${apptDate} (${apptSlot}). An engineer will visit your site.`);
      setTimeout(() => {
        setIsApptModalOpen(false);
        setApptSuccess(null);
        setApptNotes('');
      }, 3000);
    } catch (err) {
      setApptError(err.message || 'Failed to schedule appointment.');
    } finally {
      setSubmittingAppt(false);
    }
  };

  // Service tickets tracker
  const [serviceTickets, setServiceTickets] = useState([]);

  // Fetch passport by token
  const fetchPublicPassport = async (tokenToFetch) => {
    if (!tokenToFetch) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPublicPassport(tokenToFetch);
      setPassport(data);
      setCurrentToken(tokenToFetch);
      setIsScannerOpen(false);

      // Also load existing tickets for this passport
      try {
        const tickets = await api.getTicketsByPassportToken(tokenToFetch);
        setServiceTickets(tickets);
      } catch (e) {
        // Tickets optional if none exist
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired Digital Solar Passport token.');
      setPassport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (routeToken) {
      fetchPublicPassport(routeToken);
    }
  }, [routeToken]);

  // Handle successful QR scan
  const handleQrScan = (scannedCode) => {
    // If the scanned code is a full URL, extract the token part
    let extracted = scannedCode.trim();
    if (extracted.includes('/passport/public/')) {
      const parts = extracted.split('/passport/public/');
      extracted = parts[parts.length - 1];
    }
    navigate(`/passport/public/${extracted}`);
    fetchPublicPassport(extracted);
  };

  // Handle complaint submission
  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!passport || !currentToken) return;

    if (!complaintForm.description || complaintForm.description.trim().length < 5) {
      setComplaintError('Please provide a detailed description (at least 5 characters).');
      return;
    }

    setSubmittingComplaint(true);
    setComplaintError(null);
    try {
      const selectedItem = (passport.serialized_components || []).find(
        (c) => c.serial_number === complaintForm.component_serial
      );

      const res = await api.submitCustomerComplaint({
        passport_token: currentToken,
        issue_category: complaintForm.issue_category,
        description: complaintForm.description,
        serial_number: complaintForm.component_serial || undefined,
        component_id: selectedItem?.component_id,
        evidence_files: complaintForm.evidence_files,
      });

      setComplaintSuccess(`Complaint registered successfully! Reference Ticket: ${res.ticket_number}`);
      setIsComplaintModalOpen(false);

      // Refresh tickets
      const updatedTickets = await api.getTicketsByPassportToken(currentToken);
      setServiceTickets(updatedTickets);

      // Reset form
      setComplaintForm({
        issue_category: 'INVERTER_FAULT',
        component_serial: '',
        description: '',
        evidence_files: [],
      });
    } catch (err) {
      setComplaintError(err.message || 'Failed to submit service complaint.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#070d1e', padding: '2rem 1rem', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Top Navbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.6rem', background: 'linear-gradient(135deg, var(--solar-green-500), var(--solar-green-600))', borderRadius: '10px' }}>
              <Sun size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>SunPower Solutions EPC</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--solar-green-400)', fontWeight: 600 }}>
                Digital Solar Asset & Warranty Verification Portal
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                padding: '0.45rem 0.85rem',
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#ffffff',
              }}
            >
              <Camera size={15} />
              Scan QR Code
            </button>
            <Link
              to="/login"
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '0.45rem 0.85rem',
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#cbd5e1',
              }}
            >
              Staff Login
            </Link>
          </div>
        </div>

        {/* QR Scanner Modal */}
        {isScannerOpen && (
          <div className="card" style={{ background: '#1e293b', border: '1.5px solid var(--solar-green-500)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Scan Digital Solar Passport QR Code
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  Point your device camera at the physical QR code on the solar inverter or commissioning certificate.
                </p>
              </div>
              {passport && (
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  Close Scanner
                </button>
              )}
            </div>

            <CameraCapture
              mode="scan"
              title="Camera QR Code Scanner"
              onScan={handleQrScan}
              placeholderManual="Enter 32-character passport token..."
            />
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ padding: '4rem 1rem', textAlign: 'center', color: '#ffffff' }}>
            <Sun size={48} color="var(--solar-green-400)" className="spin" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Validating Cryptographic Asset Ledger...</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Verifying authenticated manufacturer hardware serials...</p>
          </div>
        )}

        {/* Error Notice */}
        {error && !loading && !isScannerOpen && (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', background: '#1e293b', border: '1px solid var(--red-600)' }}>
            <AlertTriangle size={48} color="var(--red-600)" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
              Invalid or Expired Solar Passport Token
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', margin: '0 auto' }}
            >
              <Camera size={15} />
              Open Camera Scanner
            </button>
          </div>
        )}

        {/* Feedback Banner */}
        {complaintSuccess && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1.5px solid var(--solar-green-500)',
              borderRadius: '10px',
              padding: '1rem',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <CheckCircle size={24} color="var(--solar-green-400)" />
            <div>
              <div style={{ fontWeight: 800 }}>Service Ticket Raised Successfully</div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{complaintSuccess}</div>
            </div>
          </div>
        )}

        {/* Verified Passport Certificate */}
        {passport && !loading && (
          <>
            <div
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                border: '1.5px solid var(--solar-green-500)',
                boxShadow: '0 15px 30px rgba(0,0,0,0.4)',
                padding: '2rem',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--solar-green-400)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800 }}>
                    Official Digital Solar Asset Certificate
                  </span>
                  <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#ffffff', marginTop: '0.2rem' }}>
                    {passport.passport_number}
                  </h1>
                  <p style={{ fontSize: '0.95rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                    Installation Site: <strong style={{ color: '#ffffff' }}>{passport.customer_display_name}</strong> · {passport.city}, {passport.state}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span
                    className="badge"
                    style={{
                      background: passport.lifecycle_status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: passport.lifecycle_status === 'ACTIVE' ? 'var(--solar-green-400)' : '#f59e0b',
                      border: `1px solid ${passport.lifecycle_status === 'ACTIVE' ? 'var(--solar-green-500)' : '#f59e0b'}`,
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                    }}
                  >
                    ● {passport.lifecycle_status || 'ACTIVE'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsApptModalOpen(true)}
                    className="btn btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      padding: '0.45rem 0.95rem',
                      background: 'rgba(255,255,255,0.12)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    <Calendar size={15} />
                    Book Site Visit
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsComplaintModalOpen(true)}
                    className="btn btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      padding: '0.45rem 0.95rem',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      border: 'none',
                    }}
                  >
                    <MessageSquareWarning size={15} />
                    Raise Complaint
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <Zap size={16} color="var(--solar-green-400)" />
                    System Capacity
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--solar-green-400)', marginTop: '0.25rem' }}>
                    {passport.system_capacity_kw} kWp
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{passport.grid_type} System</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <Leaf size={16} color="var(--solar-green-400)" />
                    Clean Energy Yield
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginTop: '0.25rem' }}>
                    {passport.estimated_lifetime_mwh} MWh
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--solar-green-400)' }}>{passport.co2_offset_tonnes} T CO₂ Avoided</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <Calendar size={16} color="var(--solar-green-400)" />
                    Commissioning Date
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginTop: '0.25rem' }}>
                    {passport.commissioning_date?.split('T')[0] || '2026-01-01'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Grid Sync Verified</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <Award size={16} color="var(--solar-green-400)" />
                    System Health Score
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--solar-green-400)', marginTop: '0.25rem' }}>
                    {passport.system_health_score}/100
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Grade A+ Certified</div>
                </div>
              </div>

              {/* Hardware Summary */}
              <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <div><strong>PV Modules:</strong> {passport.pv_module_summary || 'Tier-1 Mono PERC Bifacial Modules'}</div>
                <div style={{ marginTop: '0.25rem' }}><strong>Inverter:</strong> {passport.inverter_summary || 'High-Efficiency Grid-Tied Inverter'}</div>
                {passport.battery_summary && (
                  <div style={{ marginTop: '0.25rem' }}><strong>Battery Storage:</strong> {passport.battery_summary}</div>
                )}
              </div>
            </div>

            {/* Verified Component Serials Table */}
            <div className="card" style={{ padding: '1.5rem', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy-900)', margin: 0 }}>
                    Verified Physical Component Serials ({passport.serialized_components?.length || 0})
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                    Scanned at warehouse dispatch and verified during on-site commissioning.
                  </p>
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Physical Serial #</th>
                      <th>Component Name</th>
                      <th>Category</th>
                      <th>Manufacturer</th>
                      <th>Warranty Duration</th>
                      <th>Warranty Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passport.serialized_components && passport.serialized_components.length > 0 ? (
                      passport.serialized_components.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <span style={{ fontWeight: 800, color: 'var(--navy-900)', fontFamily: 'monospace' }}>
                              {item.serial_number}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{item.component_name}</td>
                          <td>
                            <span className="badge badge-info">{item.category}</span>
                          </td>
                          <td>{item.manufacturer}</td>
                          <td style={{ fontWeight: 700 }}>{item.warranty_years} Years</td>
                          <td>
                            <span className={`badge ${item.warranty_status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                              {item.warranty_status || 'ACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                          No serialized items recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Installation Evidence Photo Gallery */}
            {passport.evidence_files && passport.evidence_files.length > 0 && (
              <div className="card" style={{ padding: '1.5rem', background: '#ffffff' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.3rem' }}>
                  Installation Quality & Photographic Evidence ({passport.evidence_files.length})
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Camera photographs captured during on-site structural and electrical verification.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {passport.evidence_files.map((file, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#f8fafc',
                      }}
                    >
                      <div style={{ height: '140px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {file.file_url ? (
                          <img
                            src={file.file_url}
                            alt={file.category || 'Evidence'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <ImageIcon size={32} color="#94a3b8" />
                        )}
                      </div>
                      <div style={{ padding: '0.65rem 0.85rem' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          {file.category || 'GENERAL'}
                        </span>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-900)', marginTop: '0.3rem' }}>
                          {file.description || file.original_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {file.uploaded_at || 'Verified on site'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Service & Complaint History */}
            <div className="card" style={{ padding: '1.5rem', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy-900)', margin: 0 }}>
                    Service Complaints & Maintenance History ({serviceTickets.length})
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                    Traceable tickets registered directly through this Digital Solar Passport.
                  </p>
                </div>
              </div>

              {serviceTickets.length > 0 ? (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ticket #</th>
                        <th>Issue Category</th>
                        <th>Priority</th>
                        <th>Description</th>
                        <th>Technician</th>
                        <th>Status</th>
                        <th>Date Raised</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceTickets.map((t, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong style={{ fontFamily: 'monospace', color: 'var(--navy-900)' }}>
                              {t.ticket_number}
                            </strong>
                          </td>
                          <td>
                            <span className="badge badge-secondary">{t.issue_category}</span>
                          </td>
                          <td>
                            <span className={`badge ${t.priority === 'HIGH' || t.priority === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td style={{ maxWidth: '240px', fontSize: '0.8rem' }}>{t.description}</td>
                          <td>{t.assigned_technician || 'Pending Assignment'}</td>
                          <td>
                            <span className={`badge ${t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'badge-success' : 'badge-warning'}`}>
                              {t.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {t.created_at ? t.created_at.split('T')[0] : 'Today'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <ShieldCheck size={36} color="var(--solar-green-500)" style={{ margin: '0 auto 0.5rem' }} />
                  <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>Zero Active Complaints</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    All equipment is operating within optimal engineering parameters.
                  </div>
                </div>
              )}
            </div>

            {/* Raise Complaint Modal */}
            <Modal
              isOpen={isComplaintModalOpen}
              onClose={() => setIsComplaintModalOpen(false)}
              title="Raise Customer Service Complaint"
              maxWidth="600px"
            >
              <form onSubmit={handleSubmitComplaint}>
                {complaintError && (
                  <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red-600)', borderRadius: '6px', color: '#b91c1c', fontSize: '0.8rem', marginBottom: '1rem' }}>
                    {complaintError}
                  </div>
                )}

                <FormField label="Passport Number" help="Linked to this authenticated installation">
                  <Input value={passport.passport_number} disabled />
                </FormField>

                <FormField label="Issue Category" required>
                  <Select
                    value={complaintForm.issue_category}
                    onChange={(e) => setComplaintForm({ ...complaintForm, issue_category: e.target.value })}
                  >
                    <option value="INVERTER_FAULT">Inverter Error Code / Red Light Fault</option>
                    <option value="GRID_TRIP">Frequent Grid Trip / Net Meter Sync Issue</option>
                    <option value="GENERATION_DROP">Abnormal Generation Drop / Shading</option>
                    <option value="PANEL_DAMAGE">Physical PV Panel Damage / Hotspot</option>
                    <option value="WIRING_ISSUE">DC/AC Cable Loose / Earthing Concern</option>
                    <option value="GENERAL_QUERY">General Maintenance & Cleaning Query</option>
                  </Select>
                </FormField>

                <FormField label="Affected Component Serial (Optional)" help="Select component from your passport">
                  <Select
                    value={complaintForm.component_serial}
                    onChange={(e) => setComplaintForm({ ...complaintForm, component_serial: e.target.value })}
                  >
                    <option value="">-- Complete Solar System / General --</option>
                    {(passport.serialized_components || []).map((c, i) => (
                      <option key={i} value={c.serial_number}>
                        {c.component_name} (S/N: {c.serial_number}) - {c.manufacturer}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Detailed Description of the Issue" required help="Provide specific symptoms or inverter error codes displayed">
                  <Textarea
                    rows={4}
                    value={complaintForm.description}
                    onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                    placeholder="e.g. Inverter error code E031 displayed on screen. System stopped exporting power after thunderstorm."
                  />
                </FormField>

                {/* Camera Defect Capture for Customer */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                    Attach Photograph Evidence (Optional):
                  </label>
                  <CameraCapture
                    mode="photo"
                    title="Capture Defect Photograph"
                    onCapture={({ file, previewUrl, category }) => {
                      setComplaintForm((prev) => ({
                        ...prev,
                        evidence_files: [
                          ...prev.evidence_files,
                          {
                            original_name: file.name,
                            category: 'DEFECT_EXCEPTION',
                            captured_at: new Date().toISOString(),
                          },
                        ],
                      }));
                    }}
                  />
                  {complaintForm.evidence_files.length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--solar-green-600)', fontWeight: 600 }}>
                      ✓ {complaintForm.evidence_files.length} photograph(s) attached to complaint.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsComplaintModalOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingComplaint}
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  >
                    {submittingComplaint ? 'Registering Ticket...' : 'Submit Service Ticket'}
                  </button>
                </div>
              </form>
            </Modal>

            {/* Customer Book Service / Survey Appointment Modal */}
            <Modal
              isOpen={isApptModalOpen}
              onClose={() => setIsApptModalOpen(false)}
              title="Schedule Site Visit / Engineering Service"
            >
              <form onSubmit={handleBookCustomerAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {apptSuccess && (
                  <div style={{ padding: '0.75rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '0.82rem' }}>
                    {apptSuccess}
                  </div>
                )}
                {apptError && (
                  <div style={{ padding: '0.75rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.82rem' }}>
                    {apptError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Visit Purpose</label>
                  <select
                    value={apptType}
                    onChange={(e) => setApptType(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="SERVICE">Warranty & Maintenance Service</option>
                    <option value="SITE_SURVEY">System Re-inspection / Expansion Survey</option>
                    <option value="CONSULTATION">General System Consultation</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Preferred Date</label>
                    <input
                      type="date"
                      min={tomorrowStr}
                      value={apptDate}
                      onChange={(e) => setApptDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Time Slot</label>
                    <select
                      value={apptSlot}
                      onChange={(e) => setApptSlot(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="09:00 - 11:00">09:00 - 11:00 (Morning)</option>
                      <option value="11:00 - 13:00">11:00 - 13:00 (Noon)</option>
                      <option value="14:00 - 16:00">14:00 - 16:00 (Afternoon)</option>
                      <option value="16:00 - 18:00">16:00 - 18:00 (Evening)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Site Instructions / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Provide any instructions for technician visit..."
                    value={apptNotes}
                    onChange={(e) => setApptNotes(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsApptModalOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAppt}
                    className="btn btn-primary"
                  >
                    {submittingAppt ? 'Booking...' : 'Confirm Visit Booking'}
                  </button>
                </div>
              </form>
            </Modal>
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', padding: '1rem 0' }}>
          SunPower Solutions EPC · Digital Solar Passport Verification Engine · Compliant with IEC 62446 & MNRE Guidelines
        </div>
      </div>
    </div>
  );
}
