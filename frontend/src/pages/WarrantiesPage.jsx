import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { api } from '../services/api';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  QrCode,
  Layers,
  ArrowRightLeft,
  ExternalLink,
  Sliders,
  Check,
  HelpCircle,
} from 'lucide-react';

const CATEGORIES = ['ALL', 'PANEL', 'INVERTER', 'STRUCTURE', 'BATTERY', 'CABLE'];
const STATUSES = ['ALL', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'REPLACED', 'VOID'];
const THRESHOLDS = [
  { label: '30 Days', value: 30 },
  { label: '60 Days', value: 60 },
  { label: '90 Days (Default)', value: 90 },
  { label: '180 Days (Half Year)', value: 180 },
];

export default function WarrantiesPage({ refreshTrigger }) {
  const navigate = useNavigate();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expiringThreshold, setExpiringThreshold] = useState(90);

  // Quick Verification Tool
  const [verifySerial, setVerifySerial] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState(null);

  // Replace Component Modal
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [replaceFormData, setReplaceFormData] = useState({
    original_serial_number: '',
    replacement_serial_number: '',
    reason: 'Defective internal bypass diode replaced during O&M service',
    service_ticket_id: '',
  });
  const [replacing, setReplacing] = useState(false);

  // Inspect Modal
  const [inspectWarranty, setInspectWarranty] = useState(null);

  const loadWarranties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAllWarranties({
        status: statusFilter,
        category: categoryFilter,
        search: searchQuery || undefined,
        expiring_days_threshold: expiringThreshold,
      });
      setWarranties(data || []);
    } catch (err) {
      setError(err.message || 'Unable to load warranty records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarranties();
  }, [statusFilter, categoryFilter, expiringThreshold, refreshTrigger]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadWarranties();
  };

  const handleVerifySerial = async (e) => {
    if (e) e.preventDefault();
    if (!verifySerial.trim()) return;
    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const res = await api.checkWarranty(verifySerial.trim());
      setVerifyResult(res);
    } catch (err) {
      setVerifyError(err.message || 'Verification lookup failed.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleOpenReplace = (serial) => {
    setReplaceFormData({
      original_serial_number: serial || '',
      replacement_serial_number: '',
      reason: 'Defective component replaced under warranty service',
      service_ticket_id: '',
    });
    setIsReplaceModalOpen(true);
  };

  const handleReplaceSubmit = async (e) => {
    e.preventDefault();
    if (!replaceFormData.original_serial_number || !replaceFormData.replacement_serial_number) {
      alert('Please provide both original and replacement serial numbers.');
      return;
    }
    setReplacing(true);
    try {
      await api.replaceWarrantyComponent(replaceFormData);
      alert('Component replacement registered successfully. Original warranty updated to REPLACED.');
      setIsReplaceModalOpen(false);
      await loadWarranties();
    } catch (err) {
      alert(`Replacement failed: ${err.message}`);
    } finally {
      setReplacing(false);
    }
  };

  // Metrics
  const totalCount = warranties.length;
  const activeCount = warranties.filter((w) => w.status === 'ACTIVE').length;
  const expiringCount = warranties.filter((w) => w.status === 'EXPIRING_SOON').length;
  const expiredCount = warranties.filter((w) => w.status === 'EXPIRED').length;

  return (
    <div>
      <PageHeader
        title="Equipment Warranty Management"
        description="Component-level warranty tracking, dynamic expiration thresholds, replacement traceability, and service eligibility verification."
        action={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={loadWarranties}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="btn btn-primary" onClick={() => handleOpenReplace('')}>
              <ArrowRightLeft size={15} /> Replace Component
            </button>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="metrics-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span>Total Warranties</span>
            <div className="metric-icon-box blue">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="metric-value">{totalCount}</div>
          <div className="metric-footer">Across all installed solar systems</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Active Protection</span>
            <div className="metric-icon-box green">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--solar-green-600)' }}>
            {activeCount}
          </div>
          <div className="metric-footer">Fully covered under manufacturer terms</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Expiring Soon</span>
            <div className="metric-icon-box amber">
              <Clock size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--amber-600)' }}>
            {expiringCount}
          </div>
          <div className="metric-footer">Within {expiringThreshold} days threshold</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Expired Policies</span>
            <div className="metric-icon-box red">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: '#dc2626' }}>
            {expiredCount}
          </div>
          <div className="metric-footer">Repairs default to chargeable O&M</div>
        </div>
      </div>

      {/* Quick Warranty Verification Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Search size={16} color="var(--solar-green-600)" />
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              Quick Serial Diagnostic Eligibility Lookup
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Tests warranty active window and service eligibility for after-sales repairs
          </span>
        </div>

        <form onSubmit={handleVerifySerial} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input"
            placeholder="Enter equipment serial number (e.g. SNG-5K-2026-90412 or WAA-550-2026-001)..."
            value={verifySerial}
            onChange={(e) => setVerifySerial(e.target.value)}
            style={{ flex: 1, minWidth: '320px', fontSize: '0.84rem' }}
          />
          <button type="submit" className="btn btn-primary" disabled={verifyLoading}>
            {verifyLoading ? 'Checking...' : 'Check Warranty'}
          </button>
        </form>

        {/* Verification Result Drawer */}
        {verifyResult && (
          <div style={{ marginTop: '0.75rem', padding: '0.85rem', background: verifyResult.is_warranty_valid ? '#ecfdf5' : '#fef2f2', borderRadius: '6px', border: `1px solid ${verifyResult.is_warranty_valid ? '#a7f3d0' : '#fecaca'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {verifyResult.is_warranty_valid ? (
                    <CheckCircle2 size={16} color="#059669" />
                  ) : (
                    <XCircle size={16} color="#dc2626" />
                  )}
                  <strong style={{ fontSize: '0.88rem', color: verifyResult.is_warranty_valid ? '#065f46' : '#991b1b' }}>
                    {verifyResult.is_warranty_valid ? 'WARRANTY VALID & ACTIVE' : `WARRANTY STATUS: ${verifyResult.warranty_status}`}
                  </strong>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '0.2rem' }}>
                  Serial: <strong style={{ fontFamily: 'monospace' }}>{verifyResult.serial_number}</strong> · {verifyResult.component_name || 'Component'} ({verifyResult.manufacturer || 'Manufacturer'})
                  {verifyResult.days_remaining != null && ` · ${verifyResult.days_remaining} days remaining until expiry`}
                </div>
                {verifyResult.coverage_disclaimer && (
                  <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0', lineHeight: 1.3 }}>
                    ℹ️ {verifyResult.coverage_disclaimer}
                  </p>
                )}
              </div>

              {verifyResult.passport_id && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/solar-passport?id=${verifyResult.passport_id}`)}
                >
                  <QrCode size={13} /> View Solar Passport
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Config Bar */}
      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Search */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.4rem', flex: 1, minWidth: '280px', maxWidth: '400px' }}>
            <input
              type="text"
              className="input"
              placeholder="Filter by serial, component, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.82rem' }}
            />
            <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
          </form>

          {/* Threshold Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Sliders size={13} /> Expiry Threshold:
            </span>
            <select
              className="input"
              value={expiringThreshold}
              onChange={(e) => setExpiringThreshold(parseInt(e.target.value))}
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
            >
              {THRESHOLDS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Category:</span>
            <select
              className="input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Status:</span>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Warranties Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
            <p>Loading equipment warranties...</p>
          </div>
        ) : warranties.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <ShieldCheck size={42} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem' }} />
            <h4 style={{ color: 'var(--navy-900)', fontWeight: 700 }}>No Warranties Found</h4>
            <p style={{ fontSize: '0.85rem' }}>No equipment warranties match the selected criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Serial Number</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Equipment & SKU</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Manufacturer</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Duration</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Validity Window</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Days Left</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Customer / Site</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {warranties.map((w) => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--navy-900)', fontFamily: 'monospace' }}>
                        {w.serial_number || 'Plant Level'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{w.component_name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{w.sku}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                        {w.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{w.manufacturer}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700 }}>
                      {w.duration_years} Yrs
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#475569', fontSize: '0.76rem' }}>
                      {w.start_date} → {w.end_date}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span style={{
                        fontWeight: 700,
                        color: w.status === 'EXPIRED' ? '#dc2626' : (w.days_remaining <= expiringThreshold ? '#d97706' : '#059669'),
                      }}>
                        {w.days_remaining}d
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <StatusBadge status={w.status} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{w.customer_name || 'N/A'}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{w.customer_city} · {w.passport_number}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setInspectWarranty(w)}
                          title="Inspect Policy Terms"
                        >
                          Terms
                        </button>
                        {w.serial_number && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenReplace(w.serial_number)}
                            title="Register Replacement"
                          >
                            <ArrowRightLeft size={12} /> Replace
                          </button>
                        )}
                        {w.passport_id && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate(`/solar-passport?id=${w.passport_id}`)}
                            title="View Solar Passport"
                          >
                            <QrCode size={12} />
                          </button>
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

      {/* Inspect Policy Terms Modal */}
      {inspectWarranty && (
        <Modal
          isOpen={true}
          onClose={() => setInspectWarranty(null)}
          title={`Warranty Policy Terms · ${inspectWarranty.serial_number}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <span style={{ color: '#64748b' }}>Equipment:</span>
              <strong>{inspectWarranty.component_name} ({inspectWarranty.category})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <span style={{ color: '#64748b' }}>Manufacturer:</span>
              <span>{inspectWarranty.manufacturer}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <span style={{ color: '#64748b' }}>Warranty Scope:</span>
              <span>{inspectWarranty.warranty_type.replace(/_/g, ' ')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <span style={{ color: '#64748b' }}>Duration:</span>
              <strong>{inspectWarranty.duration_years} Years ({inspectWarranty.start_date} to {inspectWarranty.end_date})</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>Terms & Coverage Conditions:</span>
              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem', lineHeight: 1.4 }}>
                {inspectWarranty.terms_summary || 'Standard manufacturer equipment warranty covering defects in material and workmanship.'}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setInspectWarranty(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Replacement Modal */}
      {isReplaceModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsReplaceModalOpen(false)}
          title="Record Physical Component Replacement"
        >
          <form onSubmit={handleReplaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
              Preserves warranty audit history by updating the original component to <code>REPLACED</code> and transferring remaining validity to the newly deployed serial barcode.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy-900)', marginBottom: '0.25rem' }}>
                Original (Defective) Serial Number *
              </label>
              <input
                type="text"
                className="input"
                required
                value={replaceFormData.original_serial_number}
                onChange={(e) => setReplaceFormData({ ...replaceFormData, original_serial_number: e.target.value })}
                placeholder="e.g. SNG-5K-2026-90412"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy-900)', marginBottom: '0.25rem' }}>
                New Replacement Serial Number *
              </label>
              <input
                type="text"
                className="input"
                required
                value={replaceFormData.replacement_serial_number}
                onChange={(e) => setReplaceFormData({ ...replaceFormData, replacement_serial_number: e.target.value })}
                placeholder="e.g. SNG-5K-2026-99101"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy-900)', marginBottom: '0.25rem' }}>
                Replacement Reason & Service Notes
              </label>
              <textarea
                className="input"
                rows={3}
                value={replaceFormData.reason}
                onChange={(e) => setReplaceFormData({ ...replaceFormData, reason: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsReplaceModalOpen(false)}
                disabled={replacing}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={replacing}
              >
                {replacing ? 'Processing...' : 'Register Replacement'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

