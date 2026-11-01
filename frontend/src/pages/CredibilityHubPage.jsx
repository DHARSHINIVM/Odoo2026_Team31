import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { FormField, Input, Select, Textarea } from '../components/FormControls';
import { LoadingState, ErrorState, EmptyState } from '../components/StateBoxes';
import { api } from '../services/api';
import {
  ShieldCheck,
  Award,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  XCircle,
  Info,
  HelpCircle,
  FileCheck,
  TrendingDown,
  Layers,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Cpu,
  Edit3,
  Truck,
  Check,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'ALL', label: 'All Equipment' },
  { value: 'PANEL', label: 'Solar PV Panels' },
  { value: 'INVERTER', label: 'Inverters' },
  { value: 'STRUCTURE', label: 'Structures' },
  { value: 'CABLE', label: 'Cables & BOS' },
  { value: 'BATTERY', label: 'Storage Batteries' },
  { value: 'PROTECTION', label: 'Protection & SPDs' },
  { value: 'ACCESSORIES', label: 'Accessories' },
];

export default function CredibilityHubPage({ refreshTrigger }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [inspectComponent, setInspectComponent] = useState(null);

  // Edit Quality Telemetry Modal State
  const [editComponent, setEditComponent] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState(null);
  const [editError, setEditError] = useState(null);
  const [editForm, setEditForm] = useState({
    manufacturer: '',
    supplier_name: '',
    supplier_rating: 4.5,
    tier_grade: 'TIER_1',
    failure_rate_pct: 0.5,
    certification_status: '',
    documentation_status: 'Verified',
  });

  // Heuristic Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simTier, setSimTier] = useState('TIER_1');
  const [simFailureRate, setSimFailureRate] = useState('0.40');
  const [simDocStatus, setSimDocStatus] = useState('Verified');
  const [simWeightTier, setSimWeightTier] = useState(40);
  const [simWeightFailure, setSimWeightFailure] = useState(35);
  const [simWeightDocs, setSimWeightDocs] = useState(25);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCredibilityEvaluations(selectedCategory);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, refreshTrigger]);

  const handleSimulate = async () => {
    setSimLoading(true);
    try {
      const payload = {
        tier_grade: simTier,
        failure_rate_pct: parseFloat(simFailureRate) || 0.5,
        documentation_status: simDocStatus,
        weights: {
          tier: simWeightTier / 100,
          failure: simWeightFailure / 100,
          docs: simWeightDocs / 100,
        },
      };
      const res = await api.simulateCredibility(payload);
      setSimResult(res);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimLoading(false);
    }
  };

  // Run initial simulation when simulator is opened
  useEffect(() => {
    if (showSimulator && !simResult) {
      handleSimulate();
    }
  }, [showSimulator]);

  const openEditModal = (comp) => {
    setEditComponent(comp);
    setEditError(null);
    setEditSuccess(null);
    setEditForm({
      manufacturer: comp.manufacturer || '',
      supplier_name: comp.supplier_name || comp.manufacturer || '',
      supplier_rating: comp.supplier_rating != null ? comp.supplier_rating : 4.5,
      tier_grade: comp.tier_grade || 'TIER_1',
      failure_rate_pct: comp.failure_rate_pct != null ? comp.failure_rate_pct : 0.5,
      certification_status: comp.certification_status || '',
      documentation_status: comp.documentation_status || 'Verified',
    });
  };

  const handleUpdateQualitySubmit = async (e) => {
    e.preventDefault();
    if (!editComponent) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const payload = {
        manufacturer: editForm.manufacturer,
        supplier_name: editForm.supplier_name,
        supplier_rating: parseFloat(editForm.supplier_rating) || null,
        tier_grade: editForm.tier_grade,
        failure_rate_pct: parseFloat(editForm.failure_rate_pct),
        certification_status: editForm.certification_status,
        documentation_status: editForm.documentation_status,
        updated_by_name: 'Procurement Specialist',
      };
      const res = await api.updateComponentQuality(editComponent.component_id, payload);
      setEditSuccess('Component quality telemetry and credibility score updated successfully!');
      setTimeout(() => {
        setEditComponent(null);
        loadData();
      }, 900);
    } catch (err) {
      setEditError(err.message || 'Failed to update component telemetry.');
    } finally {
      setEditLoading(false);
    }
  };

  const getScoreBadgeClass = (score) => {
    if (score >= 85) return 'badge-success';
    if (score >= 70) return 'badge-info';
    if (score >= 50) return 'badge-warning';
    return 'badge-danger';
  };

  const getScoreLabel = (score) => {
    if (score >= 85) return 'High';
    if (score >= 70) return 'Moderate';
    if (score >= 50) return 'Low';
    return 'High Risk';
  };

  const tableColumns = [
    {
      header: 'Component & SKU',
      accessor: 'name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            SKU: {row.sku} • Model: {row.model_number || 'N/A'}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
            <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
              {row.category}
            </span>
            {row.incomplete_data_warning && (
              <span className="badge badge-warning" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <AlertTriangle size={10} /> Data Alert
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Supplier & Tier',
      accessor: 'manufacturer',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.manufacturer}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Supplier: {row.supplier_name || 'Direct OEM'} {row.supplier_rating ? `(★ ${row.supplier_rating})` : ''}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600, marginTop: '0.15rem' }}>
            {row.tier_grade === 'TIER_1' ? 'Tier 1 (40 pts)' : row.tier_grade === 'TIER_2' ? 'Tier 2 (30 pts)' : 'Tier 3 (20 pts)'}
          </div>
        </div>
      ),
    },
    {
      header: 'Failure Rate (35%)',
      accessor: 'failure_rate_pct',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: row.failure_rate_pct > 2 ? 'var(--red-600)' : 'var(--navy-900)' }}>
            {row.failure_rate_pct != null ? `${row.failure_rate_pct}% defect` : 'N/A Missing'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Score: {row.failure_score} pts • <strong style={{ color: 'var(--navy-800)' }}>+{row.failure_contribution} pts</strong>
          </div>
        </div>
      ),
    },
    {
      header: 'Compliance (25%)',
      accessor: 'documentation_status',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: row.documentation_status === 'Verified' ? 'var(--solar-green-600)' : 'var(--amber-600)' }}>
            {row.documentation_status || 'Unverified'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Score: {row.documentation_score} pts • <strong style={{ color: 'var(--navy-800)' }}>+{row.documentation_contribution} pts</strong>
          </div>
        </div>
      ),
    },
    {
      header: 'Credibility Score',
      accessor: 'final_score',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-900)' }}>
            {row.final_score}
          </div>
          <span className={`badge ${getScoreBadgeClass(row.final_score)}`}>
            {getScoreLabel(row.final_score)}
          </span>
        </div>
      ),
    },
    {
      header: 'Completeness & Status',
      accessor: 'data_completeness',
      render: (row) => (
        <div>
          <span
            className={`badge ${
              row.data_completeness === 'COMPLETE' ? 'badge-success' : row.data_completeness === 'PARTIAL' ? 'badge-warning' : 'badge-danger'
            }`}
            style={{ fontSize: '0.7rem' }}
          >
            {row.data_completeness}
          </span>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 600 }}>
            {row.inventory_recommendation_label || row.inventory_recommendation}
          </div>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setInspectComponent(row)}
            title="Explain Score Breakdown"
          >
            <Info size={13} /> Explain
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openEditModal(row)}
            title="Edit Quality Telemetry & Supplier Data"
          >
            <Edit3 size={13} /> Edit
          </button>
        </div>
      ),
    },
  ];

  const distribution = data?.distribution || { high: 0, moderate: 0, low: 0, high_risk: 0 };
  const incompleteCount = (data?.components || []).filter((c) => c.data_completeness !== 'COMPLETE').length;

  return (
    <div>
      <PageHeader
        title="Component Credibility Hub"
        description="Explainable 0–100 equipment reliability evaluation matrix based on manufacturer bankability, field failure telemetry, and statutory certifications."
        action={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={loadData}
            >
              <RefreshCw size={15} style={{ marginRight: '0.4rem' }} /> Refresh Matrix
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowSimulator(!showSimulator)}
            >
              <Sliders size={16} style={{ marginRight: '0.4rem' }} />
              {showSimulator ? 'Hide Heuristic Simulator' : 'Interactive Heuristic Simulator'}
            </button>
          </div>
        }
      />

      {/* Prominent Heuristic Disclaimer Banner */}
      <div
        className="card"
        style={{
          backgroundColor: '#f8fafc',
          borderLeft: '4px solid var(--blue-600)',
          marginBottom: '1.25rem',
          padding: '1rem 1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <Info size={20} color="var(--blue-600)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--navy-900)', fontSize: '0.875rem', marginBottom: '0.2rem' }}>
              Statutory Heuristic Transparency Notice
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              The Component Credibility Score is an <strong>illustrative configurable heuristic</strong> calculated as:
              <br />
              <code style={{ background: '#e2e8f0', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                Score = (0.40 × Tier Score) + (0.35 × Failure Score) + (0.25 × Documentation Score)
              </code>
              <br />
              This heuristic synthesizes manufacturer Tier ratings (Tier 1 = 100, Tier 2 = 75, Tier 3 = 50), historical defect rates (max(0, 100 - defect% × 10)), and BIS/IEC certification status. It is designed for internal procurement risk triage and is not a validated industry laboratory certification. Missing supplier fields are <strong>strictly highlighted with warnings</strong> rather than assumed to be 100%.
            </div>
          </div>
        </div>
      </div>

      {/* Incomplete Data Alert Banner */}
      {incompleteCount > 0 && (
        <div
          className="card"
          style={{
            background: '#fffbeb',
            borderLeft: '4px solid #f59e0b',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: '#92400e' }}>
              <strong>Notice:</strong> {incompleteCount} component(s) have incomplete supplier telemetry or unverified documentation. Scores reflect real submitted data and are flagged for quality review.
            </div>
          </div>
        </div>
      )}

      {/* Interactive Heuristic Simulator Drawer */}
      {showSimulator && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            backgroundColor: '#ffffff',
            border: '2px solid var(--solar-green-500)',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Sliders size={18} color="var(--solar-green-600)" />
              Component Credibility Formula Simulator
            </h3>
            <span className="badge badge-success">Live Mathematical Sandbox</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <FormField label="Manufacturer Tier Grade (Weight: 40%)">
              <Select
                value={simTier}
                onChange={(e) => {
                  setSimTier(e.target.value);
                  setTimeout(handleSimulate, 50);
                }}
              >
                <option value="TIER_1">Tier 1 (Bankable / Bloomberg NEF) - 100 pts</option>
                <option value="TIER_2">Tier 2 (Regional Standard) - 75 pts</option>
                <option value="TIER_3">Tier 3 (Economy / Unrated) - 50 pts</option>
              </Select>
            </FormField>

            <FormField label="Field Defect Rate % (Weight: 35%)">
              <Input
                type="number"
                step="0.05"
                min="0"
                max="10"
                value={simFailureRate}
                onChange={(e) => {
                  setSimFailureRate(e.target.value);
                  setTimeout(handleSimulate, 50);
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Formula: max(0, min(100, 100 - failure% × 10))
              </span>
            </FormField>

            <FormField label="Compliance & Certification (Weight: 25%)">
              <Select
                value={simDocStatus}
                onChange={(e) => {
                  setSimDocStatus(e.target.value);
                  setTimeout(handleSimulate, 50);
                }}
              >
                <option value="Verified">Verified (BIS / IEC / ALMM Certified) - 100 pts</option>
                <option value="Partial">Partial (Provisional / In Progress) - 50 pts</option>
                <option value="Missing">Missing (No Documentation) - 0 pts</option>
              </Select>
            </FormField>
          </div>

          {/* Simulation Output Card */}
          {simResult && (
            <div
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                padding: '1rem',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Calculated Heuristic Score
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                    {simResult.final_score} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ 100</span>
                  </div>
                  <span className={`badge ${getScoreBadgeClass(simResult.final_score)}`} style={{ fontSize: '0.85rem' }}>
                    {simResult.rating_label} Credibility
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Point Contributions:
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--navy-800)' }}>
                  Tier: <strong>{simResult.tier_contribution} pts</strong> (40%) • Defect: <strong>{simResult.failure_contribution} pts</strong> (35%) • Docs: <strong>{simResult.documentation_contribution} pts</strong> (25%)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {simResult.explanation}
                </div>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={handleSimulate}>
                <RefreshCw size={14} style={{ marginRight: '0.25rem' }} /> Recalculate
              </button>
            </div>
          )}
        </div>
      )}

      {/* Credibility Distribution KPI Cards */}
      <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span>Evaluated Components</span>
            <div className="metric-icon-box blue">
              <Cpu size={18} />
            </div>
          </div>
          <div className="metric-value">{data?.total_evaluated || 0}</div>
          <div className="metric-footer">Active equipment in catalog</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Average Score</span>
            <div className="metric-icon-box green">
              <Award size={18} />
            </div>
          </div>
          <div className="metric-value">{data?.average_score || 0}</div>
          <div className="metric-footer">Catalog-wide weighted average</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>High Credibility (85–100)</span>
            <div className="metric-icon-box green">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--solar-green-600)' }}>
            {distribution.high}
          </div>
          <div className="metric-footer">Primary Tier 1 procurement tier</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Moderate (70–84)</span>
            <div className="metric-icon-box blue">
              <BarChart3 size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--blue-600)' }}>
            {distribution.moderate}
          </div>
          <div className="metric-footer">Standard commercial grade</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Low (50–69)</span>
            <div className="metric-icon-box amber">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--amber-600)' }}>
            {distribution.low}
          </div>
          <div className="metric-footer">Secondary backup sourcing</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>High Risk (&lt; 50)</span>
            <div className="metric-icon-box red">
              <XCircle size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--red-600)' }}>
            {distribution.high_risk}
          </div>
          <div className="metric-footer">Restricted from default BOMs</div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            className={`btn btn-sm ${selectedCategory === cat.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Credibility Matrix Table */}
      {loading ? (
        <LoadingState message="Evaluating component credibility matrix..." />
      ) : error ? (
        <ErrorState title="Failed to load credibility matrix" message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={tableColumns}
          data={data?.components || []}
          keyField="component_id"
          emptyMessage="No components found matching this category filter."
        />
      )}

      {/* ========================================================================= */}
      {/* 1. SCORE AUDIT & EXPLAIN MODAL                                            */}
      {/* ========================================================================= */}
      {inspectComponent && (
        <Modal
          title={`Credibility Audit: ${inspectComponent.name}`}
          isOpen={!!inspectComponent}
          onClose={() => setInspectComponent(null)}
          maxWidth="700px"
        >
          <div>
            {/* Top Score Banner */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                padding: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <span className="badge badge-neutral" style={{ marginBottom: '0.3rem' }}>
                  {inspectComponent.category} • SKU: {inspectComponent.sku}
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                  {inspectComponent.manufacturer}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Model: {inspectComponent.model_number || 'N/A'} • Supplier: {inspectComponent.supplier_name || inspectComponent.manufacturer}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--navy-900)', lineHeight: 1 }}>
                  {inspectComponent.final_score}
                </div>
                <span className={`badge ${getScoreBadgeClass(inspectComponent.final_score)}`} style={{ marginTop: '0.4rem' }}>
                  {inspectComponent.rating_label} Credibility
                </span>
              </div>
            </div>

            {/* Incomplete Data Warning in Modal */}
            {inspectComponent.incomplete_data_warning && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#92400e', fontSize: '0.82rem' }}>
                <AlertTriangle size={16} />
                <span>{inspectComponent.incomplete_data_warning}</span>
              </div>
            )}

            {/* Mathematical Scoring Contributions */}
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.75rem' }}>
              Formula Contribution Breakdown
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  1. Tier Score (40%)
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy-900)', marginTop: '0.2rem' }}>
                  +{inspectComponent.tier_contribution} pts
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {inspectComponent.tier_score} pts raw (Grade: {inspectComponent.tier_grade})
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  2. Defect Score (35%)
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy-900)', marginTop: '0.2rem' }}>
                  +{inspectComponent.failure_contribution} pts
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {inspectComponent.failure_score} pts raw ({inspectComponent.failure_rate_pct}% defect rate)
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  3. Docs Score (25%)
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy-900)', marginTop: '0.2rem' }}>
                  +{inspectComponent.documentation_contribution} pts
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {inspectComponent.documentation_score} pts raw ({inspectComponent.documentation_status})
                </div>
              </div>
            </div>

            {/* Explanation Narrative */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.4rem' }}>
                Heuristic Calculation Narrative
              </h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', background: '#fff', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '6px', lineHeight: '1.5' }}>
                {inspectComponent.explanation}
              </p>
            </div>

            {/* Compliance Records & Procurement Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.4rem' }}>
                  Compliance & Certifications
                </h4>
                <div style={{ fontSize: '0.825rem', color: 'var(--navy-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} color="var(--solar-green-600)" />
                  <span>{inspectComponent.certification_status || 'Provisional self-certification'}</span>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.4rem' }}>
                  Procurement Recommendation
                </h4>
                <div style={{ fontSize: '0.825rem', color: 'var(--navy-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={16} color="var(--blue-600)" />
                  <span style={{ fontWeight: 700 }}>{inspectComponent.inventory_recommendation_label}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const comp = inspectComponent;
                  setInspectComponent(null);
                  openEditModal(comp);
                }}
              >
                <Edit3 size={13} style={{ marginRight: '0.3rem' }} /> Edit Component Quality Telemetry
              </button>
              <button className="btn btn-secondary" onClick={() => setInspectComponent(null)}>
                Close Audit View
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT QUALITY TELEMETRY MODAL                                           */}
      {/* ========================================================================= */}
      {editComponent && (
        <Modal
          title={`Edit Quality Telemetry: ${editComponent.name}`}
          isOpen={!!editComponent}
          onClose={() => setEditComponent(null)}
          maxWidth="600px"
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setEditComponent(null)}
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpdateQualitySubmit}
                disabled={editLoading}
              >
                {editLoading ? 'Recalculating...' : 'Save & Recalculate Score'}
              </button>
            </>
          }
        >
          <form onSubmit={handleUpdateQualitySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {editError && (
              <div style={{ padding: '0.75rem', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px', color: '#dc2626', fontSize: '0.85rem' }}>
                {editError}
              </div>
            )}
            {editSuccess && (
              <div style={{ padding: '0.75rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '6px', color: '#059669', fontSize: '0.85rem' }}>
                {editSuccess}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormField label="Manufacturer" required>
                <Input
                  value={editForm.manufacturer}
                  onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                  required
                />
              </FormField>

              <FormField label="Supplier / Distributor Name">
                <Input
                  value={editForm.supplier_name}
                  onChange={(e) => setEditForm({ ...editForm, supplier_name: e.target.value })}
                  placeholder="e.g. Waaree Tech Corp"
                />
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormField label="Manufacturer Tier Grade" required>
                <Select
                  value={editForm.tier_grade}
                  onChange={(e) => setEditForm({ ...editForm, tier_grade: e.target.value })}
                >
                  <option value="TIER_1">Tier 1 (Bloomberg NEF Bankable - 100 pts)</option>
                  <option value="TIER_2">Tier 2 (Regional Standard - 75 pts)</option>
                  <option value="TIER_3">Tier 3 (Economy / Unrated - 50 pts)</option>
                </Select>
              </FormField>

              <FormField label="Supplier Rating (1.0 - 5.0)">
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={editForm.supplier_rating}
                  onChange={(e) => setEditForm({ ...editForm, supplier_rating: e.target.value })}
                />
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormField label="Field Defect Rate (%)" required>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={editForm.failure_rate_pct}
                  onChange={(e) => setEditForm({ ...editForm, failure_rate_pct: e.target.value })}
                  required
                />
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Heuristic: max(0, min(100, 100 - defect% × 10))
                </span>
              </FormField>

              <FormField label="Documentation & Compliance Status" required>
                <Select
                  value={editForm.documentation_status}
                  onChange={(e) => setEditForm({ ...editForm, documentation_status: e.target.value })}
                >
                  <option value="Verified">Verified (BIS / IEC Certified - 100 pts)</option>
                  <option value="Partial">Partial (Provisional / In-Progress - 50 pts)</option>
                  <option value="Missing">Missing (No Documentation - 0 pts)</option>
                </Select>
              </FormField>
            </div>

            <FormField label="Statutory Certifications & Standards">
              <Input
                value={editForm.certification_status}
                onChange={(e) => setEditForm({ ...editForm, certification_status: e.target.value })}
                placeholder="e.g. BIS IS 14286, ALMM Listed, IEC 61215, IEC 61730"
              />
            </FormField>

            <div style={{ padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569' }}>
              Saving this telemetry automatically records an immutable Audit Log entry and recalculates the Component Credibility Score across all engineering BOM recommendations.
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
