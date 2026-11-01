import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
import {
  Award, Search, Filter, CheckCircle2, Clock, XCircle,
  FileText, ShieldCheck, ArrowRight, IndianRupee, RefreshCw
} from 'lucide-react';

export default function SubsidiesPage({ refreshTrigger }) {
  const [subsidies, setSubsidies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Status Update Modal
  const [activeSub, setActiveSub] = useState(null);
  const [newStatus, setNewStatus] = useState('APPROVED');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [disbursementRef, setDisbursementRef] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadSubsidies = async () => {
    setLoading(true);
    try {
      const res = await api.getSubsidies(statusFilter);
      setSubsidies(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubsidies();
  }, [statusFilter, refreshTrigger]);

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!activeSub) return;
    setUpdating(true);
    try {
      await api.updateSubsidyStatus(activeSub.id, {
        status: newStatus,
        reviewer_notes: reviewerNotes,
        disbursement_reference: disbursementRef || null,
      });
      alert(`Subsidy application ${activeSub.application_number} updated to ${newStatus}!`);
      setActiveSub(null);
      await loadSubsidies();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="PM Surya Ghar: Muft Bijli Yojana — Subsidy Management"
        subtitle="Central Government & State DISCOM Rooftop Solar Subsidies (Module 9)"
        action={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className="badge badge-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              Standard Subsidy: ₹78,000 / Installation
            </span>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['ALL', 'DRAFT', 'SUBMITTED', 'INSPECTION_CLEARED', 'APPROVED', 'DISBURSED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.78rem' }}
            >
              {st}
            </button>
          ))}
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadSubsidies}>
          <RefreshCw size={14} className={loading ? 'loading-spinner' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Subsidies Table */}
      <div className="card" style={{ padding: '1.5rem' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            Loading subsidy applications...
          </div>
        ) : error ? (
          <div style={{ padding: '1.5rem', color: '#dc2626', background: '#fef2f2', borderRadius: '8px' }}>
            {error}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Application #</th>
                  <th>Customer</th>
                  <th>DISCOM / Consumer</th>
                  <th>Capacity</th>
                  <th>Eligible Subsidy</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {subsidies.map((sub) => (
                  <tr key={sub.id}>
                    <td><strong>{sub.application_number}</strong></td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{sub.customer_name}</span>
                    </td>
                    <td>
                      <div>
                        <strong>{sub.discom_name}</strong>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{sub.consumer_number}</span>
                      </div>
                    </td>
                    <td>{sub.system_capacity_kw} kW</td>
                    <td>
                      <strong>₹{((sub.eligible_subsidy_paise || 0) / 100).toLocaleString()}</strong>
                    </td>
                    <td>
                      <span className={`badge ${
                        sub.status === 'APPROVED' || sub.status === 'DISBURSED' ? 'badge-success' :
                        sub.status === 'INSPECTION_CLEARED' ? 'badge-primary' :
                        sub.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220, fontSize: '0.75rem', color: '#64748b' }}>
                      {sub.reviewer_notes || 'Pending portal review'}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setActiveSub(sub);
                          setNewStatus(sub.status === 'SUBMITTED' ? 'INSPECTION_CLEARED' : sub.status === 'INSPECTION_CLEARED' ? 'APPROVED' : 'DISBURSED');
                          setReviewerNotes(sub.reviewer_notes || '');
                        }}
                      >
                        Update Stage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Update Subsidy Modal */}
      {activeSub && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '1.75rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#0f172a' }}>
              Update Subsidy Stage: {activeSub.application_number}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem' }}>
              Customer: <strong>{activeSub.customer_name}</strong> ({activeSub.consumer_number})
            </p>

            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Next Milestone Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="SUBMITTED">SUBMITTED (Uploaded to MNRE portal)</option>
                  <option value="INSPECTION_CLEARED">INSPECTION_CLEARED (DISCOM Inspector passed)</option>
                  <option value="APPROVED">APPROVED (Subsidy sanctioned by ministry)</option>
                  <option value="DISBURSED">DISBURSED (Transferred to consumer account)</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              {newStatus === 'DISBURSED' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Disbursement Reference / Transaction ID
                  </label>
                  <input
                    type="text"
                    value={disbursementRef}
                    onChange={(e) => setDisbursementRef(e.target.value)}
                    placeholder="e.g. DBT-SBIN-99201948"
                    required
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Reviewer Notes / Observations
                </label>
                <textarea
                  rows={3}
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveSub(null)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updating}
                >
                  {updating ? 'Saving...' : 'Update Subsidy Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

