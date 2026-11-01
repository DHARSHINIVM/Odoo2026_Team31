import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, Clock, CheckCircle2, AlertCircle, XCircle,
  Plus, User, Phone, MapPin, RefreshCw, ChevronRight, X
} from 'lucide-react';

const APPOINTMENT_TYPES = [
  { id: 'SITE_SURVEY', label: 'Site Survey', desc: 'Rooftop measurement & electrical assessment' },
  { id: 'INSTALLATION', label: 'Solar Installation', desc: 'PV module mounting & inverter setup' },
  { id: 'SERVICE', label: 'Warranty & Maintenance', desc: 'System inspection, testing & repairs' },
  { id: 'CONSULTATION', label: 'Energy Consultation', desc: 'Initial solar ROI & PM Surya Ghar guidance' },
];

const STANDARD_SLOTS = [
  '09:00 - 11:00',
  '11:00 - 13:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
];

export default function AppointmentsPage({ refreshTrigger }) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Book Appointment Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Form State
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [bookForm, setBookForm] = useState({
    customer_id: '',
    appointment_type: 'SITE_SURVEY',
    scheduled_date: tomorrow,
    time_slot: '09:00 - 11:00',
    assigned_tech_id: '',
    service_address: '',
    contact_phone: '',
    customer_notes: '',
  });

  // Reschedule Modal
  const [rescheduleApt, setRescheduleApt] = useState(null);
  const [newDate, setNewDate] = useState(tomorrow);
  const [newSlot, setNewSlot] = useState('11:00 - 13:00');
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Cancel Modal
  const [cancelApt, setCancelApt] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getAppointments({
        status: statusFilter,
        appointment_type: typeFilter,
      });
      setAppointments(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter, refreshTrigger]);

  useEffect(() => {
    Promise.all([
      api.getCustomers().catch(() => []),
      api.getTeamByRole('FIELD_TECHNICIAN').catch(() => []),
    ]).then(([custs, techs]) => {
      setCustomers(custs);
      setTechnicians(techs);
      if (custs.length > 0 && !bookForm.customer_id) {
        setBookForm((prev) => ({
          ...prev,
          customer_id: custs[0].id,
          service_address: custs[0].address || '',
          contact_phone: custs[0].phone || '',
        }));
      }
    });
  }, []);

  // Fetch slot availability whenever appointment type, target date, or technician changes
  useEffect(() => {
    if (isBookModalOpen && bookForm.scheduled_date) {
      setLoadingSlots(true);
      api.getAppointmentAvailability({
        target_date: bookForm.scheduled_date,
        appointment_type: bookForm.appointment_type,
        technician_id: bookForm.assigned_tech_id || undefined,
        days_ahead: 1,
      })
        .then((res) => {
          if (res.schedule && res.schedule[0]) {
            setAvailability(res.schedule[0].slots || []);
          }
        })
        .catch(() => setAvailability([]))
        .finally(() => setLoadingSlots(false));
    }
  }, [isBookModalOpen, bookForm.scheduled_date, bookForm.appointment_type, bookForm.assigned_tech_id]);

  const handleCustomerChange = (custId) => {
    const cust = customers.find((c) => c.id === parseInt(custId, 10));
    setBookForm((prev) => ({
      ...prev,
      customer_id: custId,
      service_address: cust ? `${cust.address}, ${cust.city}` : '',
      contact_phone: cust ? cust.phone : '',
    }));
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    if (!bookForm.customer_id) {
      alert('Please select a customer for this appointment.');
      return;
    }
    try {
      await api.bookAppointment({
        ...bookForm,
        customer_id: parseInt(bookForm.customer_id, 10),
        assigned_tech_id: bookForm.assigned_tech_id ? parseInt(bookForm.assigned_tech_id, 10) : null,
      });
      alert('Appointment scheduled successfully!');
      setIsBookModalOpen(false);
      loadData();
    } catch (err) {
      alert(`Booking Failed: ${err.message}`);
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleApt) return;
    try {
      await api.rescheduleAppointment(rescheduleApt.id, {
        new_date: newDate,
        new_time_slot: newSlot,
        reason: rescheduleReason,
      });
      alert('Appointment successfully rescheduled.');
      setRescheduleApt(null);
      loadData();
    } catch (err) {
      alert(`Reschedule Failed: ${err.message}`);
    }
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelApt) return;
    try {
      await api.cancelAppointment(cancelApt.id, {
        cancellation_reason: cancelReason || 'Customer requested cancellation',
      });
      alert('Appointment cancelled.');
      setCancelApt(null);
      loadData();
    } catch (err) {
      alert(`Cancellation Failed: ${err.message}`);
    }
  };

  const getStatusBadge = (s) => {
    const map = {
      CONFIRMED: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
      ASSIGNED: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
      REQUESTED: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
      RESCHEDULED: { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
      COMPLETED: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
      CANCELLED: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    };
    const c = map[s] || { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
        {s}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <PageHeader
        title="Customer Appointments & Field Dispatch Scheduling"
        subtitle="Manage site survey visits, rooftop solar installation crews, and warranty maintenance service bookings"
        action={
          <button
            className="btn btn-primary"
            onClick={() => setIsBookModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            <span>Book Appointment</span>
          </button>
        }
      />

      {/* Filter Tabs & Controls */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Status:</span>
          {['ALL', 'REQUESTED', 'CONFIRMED', 'ASSIGNED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            <option value="ALL">All Appointment Types</option>
            {APPOINTMENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            style={{ padding: '0.35rem 0.6rem' }}
            title="Refresh Appointments"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Appointments Data Table */}
      <div className="card" style={{ padding: '1.25rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            Loading appointments and engineer schedules...
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <Calendar size={48} style={{ strokeWidth: 1.5, margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#475569' }}>No appointments booked</div>
            <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Click 'Book Appointment' to schedule customer site visits.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Booking #</th>
                  <th>Customer & Contact</th>
                  <th>Appointment Type</th>
                  <th>Scheduled Date & Slot</th>
                  <th>Assigned Field Tech</th>
                  <th>Service Address</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                        {apt.appointment_number}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{apt.customer_name || 'Customer'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{apt.contact_phone || 'No Phone'}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', padding: '2px 6px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontWeight: 600 }}>
                        {apt.appointment_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.82rem' }}>
                          {new Date(apt.scheduled_date).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{apt.time_slot}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                        <User size={13} style={{ color: '#64748b' }} />
                        <span style={{ color: apt.assigned_tech_name ? '#0f172a' : '#94a3b8', fontWeight: apt.assigned_tech_name ? 600 : 400 }}>
                          {apt.assigned_tech_name || 'Unassigned'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {apt.service_address || 'Site Address'}
                      </div>
                    </td>
                    <td>{getStatusBadge(apt.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        {apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED' && (
                          <>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setRescheduleApt(apt);
                                setNewDate(apt.scheduled_date.split('T')[0]);
                                setNewSlot(apt.time_slot);
                              }}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                            >
                              Reschedule
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setCancelApt(apt)}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#dc2626' }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      {isBookModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', padding: '1.75rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              Schedule Customer Site Appointment
            </h3>
            <form onSubmit={handleBookSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Customer</label>
                  <select
                    value={bookForm.customer_id}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Appointment Type</label>
                  <select
                    value={bookForm.appointment_type}
                    onChange={(e) => setBookForm({ ...bookForm, appointment_type: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    {APPOINTMENT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Appointment Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookForm.scheduled_date}
                    onChange={(e) => setBookForm({ ...bookForm, scheduled_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Assigned Field Tech</label>
                  <select
                    value={bookForm.assigned_tech_id}
                    onChange={(e) => setBookForm({ ...bookForm, assigned_tech_id: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Auto-Assign Qualified Tech</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name} ({t.designation || 'Engineer'})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time Slot Selector with Real Availability Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Available Time Slots ({loadingSlots ? 'Checking capacity...' : 'Verified'})
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {STANDARD_SLOTS.map((slot) => {
                    const slotInfo = availability.find((s) => s.time_slot === slot);
                    const isAvail = slotInfo ? slotInfo.available : true;
                    const isSelected = bookForm.time_slot === slot;
                    return (
                      <div
                        key={slot}
                        onClick={() => isAvail && setBookForm({ ...bookForm, time_slot: slot })}
                        style={{
                          padding: '0.65rem 0.75rem',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid #2563eb' : isAvail ? '1px solid #cbd5e1' : '1px dashed #f87171',
                          background: isSelected ? '#eff6ff' : isAvail ? '#ffffff' : '#fef2f2',
                          cursor: isAvail ? 'pointer' : 'not-allowed',
                          opacity: isAvail ? 1 : 0.6,
                        }}
                      >
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? '#1d4ed8' : '#1e293b' }}>
                          {slot}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: isAvail ? '#059669' : '#dc2626' }}>
                          {isAvail ? (slotInfo?.reason || 'Open') : 'Slot Full'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Service Address</label>
                  <input
                    type="text"
                    value={bookForm.service_address}
                    onChange={(e) => setBookForm({ ...bookForm, service_address: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Customer Contact Phone</label>
                  <input
                    type="text"
                    value={bookForm.contact_phone}
                    onChange={(e) => setBookForm({ ...bookForm, contact_phone: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Customer Notes & Site Directions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Ring bell on 2nd floor, meter room accessible on ground floor"
                  value={bookForm.customer_notes}
                  onChange={(e) => setBookForm({ ...bookForm, customer_notes: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsBookModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleApt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#0f172a' }}>
              Reschedule Appointment #{rescheduleApt.appointment_number}
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }}>
              Select a new date and open time slot for {rescheduleApt.customer_name}.
            </p>
            <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>New Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>New Time Slot</label>
                <select
                  value={newSlot}
                  onChange={(e) => setNewSlot(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  {STANDARD_SLOTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Rescheduling Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Customer requested morning instead of afternoon"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRescheduleApt(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelApt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#dc2626' }}>
              Cancel Appointment #{cancelApt.appointment_number}
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }}>
              Are you sure you want to cancel this booking for {cancelApt.customer_name}?
            </p>
            <form onSubmit={handleCancelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Reason for Cancellation</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Customer out of town, will re-book next month"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCancelApt(null)}
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                >
                  Cancel Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

