import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import DocumentManager from '../components/DocumentManager';
import { api } from '../services/api';
import {
  QrCode,
  ShieldCheck,
  Zap,
  Leaf,
  Calendar,
  Building2,
  CheckCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Award,
  Layers,
  FileCheck,
  AlertCircle,
  Search,
  ArrowRight,
  ArrowLeft,
  Wrench,
  Headphones,
  FileText,
  Clock,
  Eye,
} from 'lucide-react';

export default function SolarPassportPage({ refreshTrigger }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedOrderIdParam = searchParams.get('orderId');
  const selectedPassportIdParam = searchParams.get('id');

  // View state: 'list' | 'detail'
  const [activeView, setActiveView] = useState(
    selectedOrderIdParam || selectedPassportIdParam ? 'detail' : 'list'
  );

  // Passport Directory State
  const [passportsList, setPassportsList] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Single Passport Detail State
  const [selectedIdentifier, setSelectedIdentifier] = useState(
    selectedPassportIdParam || selectedOrderIdParam || null
  );
  const [passportData, setPassportData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Detail Sub-Tab: 'overview' | 'serials' | 'warranties' | 'service' | 'evidence'
  const [detailTab, setDetailTab] = useState('overview');

  // 1. Load Passport Directory
  const loadPassportsDirectory = async (query = '') => {
    setDirectoryLoading(true);
    try {
      const data = await api.getPassports(query);
      setPassportsList(data || []);
      // If we don't have a selected identifier yet and list has items, default to first for quick preview
      if (!selectedIdentifier && data.length > 0 && activeView === 'detail') {
        setSelectedIdentifier(data[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load passports directory:', err);
    } finally {
      setDirectoryLoading(false);
    }
  };

  // 2. Load Single Passport Details
  const loadPassportDetails = async (identifier) => {
    if (!identifier) return;
    setDetailLoading(true);
    setError(null);
    try {
      const data = await api.getPassportById(identifier);
      setPassportData(data);
    } catch (err) {
      setError(err.message || 'Unable to retrieve Digital Solar Passport record.');
      setPassportData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadPassportsDirectory(searchQuery);
  }, [refreshTrigger]);

  useEffect(() => {
    if (selectedIdentifier) {
      loadPassportDetails(selectedIdentifier);
    }
  }, [selectedIdentifier]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadPassportsDirectory(searchQuery);
  };

  const openPassportDetail = (identifier) => {
    setSelectedIdentifier(identifier.toString());
    setActiveView('detail');
    setSearchParams({ id: identifier.toString() });
  };

  const handleBackToList = () => {
    setActiveView('list');
    setSearchParams({});
  };

  const handleCopyLink = () => {
    if (!passportData?.public_lookup_url) return;
    const fullUrl = `${window.location.origin}${passportData.public_lookup_url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div>
      <PageHeader
        title="Digital Solar Passport Ledger"
        description="Tamper-proof digital asset ledger, QR-verifiable certificate, actual physical serial numbers, equipment warranties, and post-commissioning service history."
        action={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {activeView === 'detail' && (
              <button className="btn btn-secondary" onClick={handleBackToList}>
                <ArrowLeft size={15} /> All Passports Directory
              </button>
            )}
            {activeView === 'detail' && passportData && (
              <button className="btn btn-secondary" onClick={handleCopyLink}>
                {copied ? <Check size={15} color="var(--solar-green-600)" /> : <Copy size={15} />}
                <span>{copied ? 'Link Copied!' : 'Copy Public URL'}</span>
              </button>
            )}
            {activeView === 'detail' && passportData?.public_lookup_url && (
              <button
                className="btn btn-primary"
                onClick={() => window.open(passportData.public_lookup_url, '_blank')}
              >
                <ExternalLink size={15} /> Public QR Certificate
              </button>
            )}
          </div>
        }
      />

      {/* Top View Toggle Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${activeView === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleBackToList}
          >
            <Layers size={14} /> Passport Directory ({passportsList.length})
          </button>
          <button
            className={`btn btn-sm ${activeView === 'detail' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              if (selectedIdentifier) setActiveView('detail');
              else if (passportsList.length > 0) openPassportDetail(passportsList[0].id);
            }}
            disabled={!selectedIdentifier && passportsList.length === 0}
          >
            <QrCode size={14} /> Passport Details View
          </button>
        </div>

        {activeView === 'list' && (
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.4rem', flex: '1', maxWidth: '450px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                className="input"
                placeholder="Search Passport #, Customer, Installation, or Serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '2rem', fontSize: '0.82rem' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm">
              Search
            </button>
            {searchQuery && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  loadPassportsDirectory('');
                }}
              >
                Reset
              </button>
            )}
          </form>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. PASSPORT DIRECTORY VIEW                                                */}
      {/* ========================================================================= */}
      {activeView === 'list' && (
        <div>
          {directoryLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
              <p>Loading Digital Solar Passports...</p>
            </div>
          ) : passportsList.length === 0 ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <QrCode size={48} style={{ color: '#94a3b8', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                No Digital Solar Passports Found
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '480px', margin: '0.5rem auto 1.5rem' }}>
                {searchQuery
                  ? `No commissioned solar installations matched "${searchQuery}". Try a different keyword.`
                  : 'Digital Solar Passports are automatically generated when an installation is fully commissioned with 8/8 checklist items.'}
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/installations')}>
                Go to Installations & Commissioning <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Passport ID</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Customer & Site</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Order & Installation</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>System Capacity</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Commissioned Date</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Installed Serials</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Warranties</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Health Score</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passportsList.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ fontWeight: 800, color: 'var(--navy-900)', fontFamily: 'monospace' }}>
                            {p.passport_number}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.customer_name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.customer_city} · {p.customer_phone || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600 }}>{p.order_number}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.installation_number}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: 'var(--solar-green-600)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Zap size={13} /> {p.system_capacity_kw} kW ({p.grid_type.replace('_', ' ')})
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#475569' }}>
                          {p.commissioning_date || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                            {p.serial_count} Serials
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                            {p.warranty_count} Policies
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: 'var(--solar-green-600)' }}>
                            {p.system_health_score}/100
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => openPassportDetail(p.id)}
                              title="Inspect Full Passport Details"
                            >
                              <Eye size={13} /> Inspect
                            </button>
                            {p.public_lookup_url && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => window.open(p.public_lookup_url, '_blank')}
                                title="Open Public QR Certificate"
                              >
                                <ExternalLink size={13} /> QR
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DETAILED PASSPORT VIEW                                                 */}
      {/* ========================================================================= */}
      {activeView === 'detail' && (
        <div>
          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
              <p>Retrieving cryptographically verified Digital Solar Passport...</p>
            </div>
          ) : error ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <AlertCircle size={48} style={{ color: 'var(--amber-600)', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.5rem' }}>
                Passport Record Unavailable
              </h3>
              <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto 1.5rem', fontSize: '0.85rem' }}>
                {error}
              </p>
              <button className="btn btn-secondary" onClick={handleBackToList}>
                ← Back to Passport Directory
              </button>
            </div>
          ) : passportData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Certificate Master Header Card */}
              <div
                className="card"
                style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, #070d1e 0%, #0f172a 100%)',
                  color: '#ffffff',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span className="badge badge-success" style={{ fontWeight: 800 }}>
                        OFFICIAL ASSET PASSPORT
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Standard IEC 62446 Grid Interconnection
                      </span>
                    </div>

                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.35rem', color: '#ffffff' }}>
                      {passportData.passport_number}
                    </h1>

                    <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                      Certified Owner:{' '}
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>{passportData.customer_name}</span> ({passportData.customer_city}) · Order: <strong>{passportData.order_number}</strong>
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>System Sizing</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--solar-green-400)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Zap size={16} /> {passportData.system_capacity_kw} kW
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Architecture</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                          {passportData.grid_type.replace(/_/g, ' ')}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Commissioned Date</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                          {passportData.commissioning_date?.split('T')[0] || 'Verified'}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>System Health Score</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--solar-green-400)' }}>
                          {passportData.system_health_score} / 100 Grade A+
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* QR Code Container */}
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '1rem',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                      maxWidth: '180px',
                    }}
                  >
                    <div
                      style={{ width: '130px', height: '130px' }}
                      dangerouslySetInnerHTML={{ __html: passportData.qr_code_svg }}
                    />
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--navy-900)', marginTop: '0.4rem', textAlign: 'center' }}>
                      SCAN TO VERIFY ASSET
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {passportData.qr_code_token?.substring(0, 12)}...
                    </span>
                  </div>
                </div>
              </div>

              {/* Environmental & Yield Projection Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '10px', color: 'var(--solar-green-600)' }}>
                    <Zap size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated 25-Yr Lifetime Yield</span>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                      {passportData.estimated_lifetime_mwh} MWh
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '10px', color: 'var(--solar-green-600)' }}>
                    <Leaf size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lifetime Carbon Offset</span>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
                      {passportData.co2_offset_tonnes} Tonnes CO₂
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '10px', color: 'var(--navy-800)' }}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Warranties</span>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                      {passportData.warranties?.length || 0} Certificates
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <button
                  className={`btn btn-sm ${detailTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDetailTab('overview')}
                >
                  <Building2 size={13} /> Site & Telemetry
                </button>
                <button
                  className={`btn btn-sm ${detailTab === 'serials' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDetailTab('serials')}
                >
                  <Layers size={13} /> Installed Components ({passportData.serialized_components?.length || 0})
                </button>
                <button
                  className={`btn btn-sm ${detailTab === 'warranties' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDetailTab('warranties')}
                >
                  <ShieldCheck size={13} /> Warranties ({passportData.warranties?.length || 0})
                </button>
                <button
                  className={`btn btn-sm ${detailTab === 'service' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDetailTab('service')}
                >
                  <Headphones size={13} /> Service History ({passportData.service_history?.length || 0})
                </button>
                <button
                  className={`btn btn-sm ${detailTab === 'evidence' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDetailTab('evidence')}
                >
                  <FileText size={13} /> Documents & Photos ({passportData.evidence_files?.length || 0})
                </button>
              </div>

              {/* SUBTAB 1: Overview & Site Info */}
              {detailTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                  <div className="card" style={{ padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Building2 size={16} color="var(--solar-green-600)" /> Customer & Installation Site
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.84rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                        <span style={{ color: '#64748b' }}>Customer Name:</span>
                        <strong style={{ color: '#0f172a' }}>{passportData.customer_name}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                        <span style={{ color: '#64748b' }}>City:</span>
                        <span>{passportData.customer_city}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                        <span style={{ color: '#64748b' }}>Order Number:</span>
                        <strong style={{ color: 'var(--navy-900)' }}>{passportData.order_number}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                        <span style={{ color: '#64748b' }}>Grid Architecture:</span>
                        <span>{passportData.grid_type}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.35rem' }}>
                        <span style={{ color: '#64748b' }}>Commissioned Date:</span>
                        <span>{passportData.commissioning_date?.split('T')[0] || 'Verified'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Zap size={16} color="var(--solar-green-600)" /> Generation & Module Specs
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.84rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                        <span style={{ color: '#64748b' }}>PV Module Setup:</span>
                        <strong>{passportData.pv_module_summary || 'Tier-1 Mono PERC Bifacial'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                        <span style={{ color: '#64748b' }}>Inverter Spec:</span>
                        <strong>{passportData.inverter_summary || 'Grid-Tied String Inverter'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                        <span style={{ color: '#64748b' }}>Expected Annual Gen:</span>
                        <span>{(passportData.system_capacity_kw * 1450).toLocaleString()} kWh/yr</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.35rem' }}>
                        <span style={{ color: '#64748b' }}>Total Lifetime Yield:</span>
                        <strong style={{ color: 'var(--solar-green-600)' }}>{passportData.estimated_lifetime_mwh} MWh</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 2: Installed Components & Barcodes */}
              {detailTab === 'serials' && (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.4rem' }}>
                    Physical Serial Numbers & Installed Hardware
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
                    Tamper-proof association of serialized solar modules and inverters deployed at this installation site.
                  </p>

                  <div className="table-responsive">
                    <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Physical Serial Number</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Equipment Name</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Category</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Manufacturer</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Warranty Period</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Expiry Date</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {passportData.serialized_components && passportData.serialized_components.length > 0 ? (
                          passportData.serialized_components.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.65rem 0.75rem' }}>
                                <span style={{ fontWeight: 800, color: 'var(--navy-900)', fontFamily: 'monospace' }}>
                                  {item.serial_number}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{item.component_name}</td>
                              <td style={{ padding: '0.65rem 0.75rem' }}>
                                <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                                  {item.category}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem' }}>{item.manufacturer}</td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>{item.duration_years} Years</td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', color: '#64748b' }}>{item.end_date}</td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                                <StatusBadge status={item.status} />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                              No physical serialized items recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBTAB 3: Warranties */}
              {detailTab === 'warranties' && (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.75rem' }}>
                    Active Warranty Schedules & Protection
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {passportData.warranties && passportData.warranties.length > 0 ? (
                      passportData.warranties.map((w) => (
                        <div
                          key={w.id}
                          style={{
                            padding: '1rem',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            borderLeft: '4px solid var(--solar-green-500)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                              {w.warranty_type.replace(/_/g, ' ')}
                            </span>
                            <StatusBadge status={w.status} />
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy-900)', marginTop: '0.2rem' }}>
                            {w.duration_years} Years Guarantee
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', marginTop: '0.15rem' }}>
                            {w.manufacturer} · {w.serial_number || 'Plant Level'}
                          </div>
                          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                            {w.terms_summary || 'Standard manufacturer defect coverage and power performance warranty.'}
                          </p>
                          <div style={{ marginTop: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                            <span>Valid from: {w.start_date?.split('T')[0]}</span>
                            <span style={{ fontWeight: 600, color: 'var(--solar-green-600)' }}>Expires: {w.end_date?.split('T')[0]}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No warranty records attached to this passport.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUBTAB 4: Service & Maintenance Tickets History */}
              {detailTab === 'service' && (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                        Service & Repair History
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Historical breakdown of reported complaints, inverter fault diagnostics, and post-installation O&M visits.
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/service?customerId=${passportData.customer_id}`)}
                    >
                      <Headphones size={13} /> Open Service Portal
                    </button>
                  </div>

                  <div className="table-responsive">
                    <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Ticket #</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Issue Category</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Description</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Technician</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Created Date</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {passportData.service_history && passportData.service_history.length > 0 ? (
                          passportData.service_history.map((t, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                                {t.ticket_number}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem' }}>
                                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                                  {t.issue_category}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', color: '#334155' }}>{t.description}</td>
                              <td style={{ padding: '0.65rem 0.75rem', color: '#475569' }}>
                                {t.assigned_technician || 'Unassigned'}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', color: '#64748b' }}>{t.created_at}</td>
                              <td style={{ padding: '0.65rem 0.75rem' }}>
                                <StatusBadge status={t.status} />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                              No service tickets or maintenance issues reported for this installation. System running smoothly.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBTAB 5: Evidence & Photographs */}
              {detailTab === 'evidence' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <DocumentManager
                    entityType="PASSPORT"
                    entityId={passportData.id}
                    entityIdentifier={passportData.passport_number}
                    title="Digital Solar Passport Documents & Commissioning Evidence"
                  />

                  {passportData.evidence_files && passportData.evidence_files.length > 0 && (
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.75rem' }}>
                        Archived Legacy Field Attachments
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        {passportData.evidence_files.map((file, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '0.85rem',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--navy-900)' }}>
                              <FileText size={16} color="var(--solar-green-600)" />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.original_name || file.filename}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{file.description}</span>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Uploaded: {file.uploaded_at}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
