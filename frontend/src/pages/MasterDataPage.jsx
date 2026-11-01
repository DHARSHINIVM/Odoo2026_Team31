import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
import {
  Boxes, Cpu, FileText, CheckSquare, ShieldCheck,
  DollarSign, Settings, Plus, RefreshCw, Edit2, Search,
  Sliders, AlertCircle, Award, Wrench, Layers, CheckCircle2
} from 'lucide-react';

export default function MasterDataPage({ refreshTrigger }) {
  const [activeTab, setActiveTab] = useState('packages');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [overview, setOverview] = useState(null);
  const [packages, setPackages] = useState([]);
  const [components, setComponents] = useState([]);
  const [bomTemplates, setBomTemplates] = useState({ templates: [] });
  const [pricingTax, setPricingTax] = useState({});
  const [checklists, setChecklists] = useState({});
  const [commissioningTests, setCommissioningTests] = useState({});
  const [warrantyTerms, setWarrantyTerms] = useState({ standard_terms: [], manufacturer_policies: [] });
  const [systemConfig, setSystemConfig] = useState({});

  // Filters
  const [pkgFilter, setPkgFilter] = useState('ALL');
  const [compCategoryFilter, setCompCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Package Modal
  const [showCreatePkgModal, setShowCreatePkgModal] = useState(false);
  const [newPkgData, setNewPkgData] = useState({
    code: '',
    name: '',
    capacity_kw: 3.0,
    description: '',
    total_price_inr: 185000,
  });
  const [creatingPkg, setCreatingPkg] = useState(false);

  const loadAllMasterData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        ovRes, pkgsRes, compsRes, bomRes, pricingRes, chkRes, commRes, warRes, cfgRes
      ] = await Promise.allSettled([
        api.getMasterDataOverview(),
        api.getMasterPackages(),
        api.getMasterComponents(),
        api.getBomTemplates(),
        api.getPricingTaxConfig(),
        api.getTechnicalChecklists(),
        api.getCommissioningTests(),
        api.getWarrantyTerms(),
        api.getSystemConfig(),
      ]);

      if (ovRes.status === 'fulfilled') setOverview(ovRes.value);
      if (pkgsRes.status === 'fulfilled') setPackages(pkgsRes.value);
      if (compsRes.status === 'fulfilled') setComponents(compsRes.value);
      if (bomRes.status === 'fulfilled') setBomTemplates(bomRes.value);
      if (pricingRes.status === 'fulfilled') setPricingTax(pricingRes.value);
      if (chkRes.status === 'fulfilled') setChecklists(chkRes.value);
      if (commRes.status === 'fulfilled') setCommissioningTests(commRes.value);
      if (warRes.status === 'fulfilled') setWarrantyTerms(warRes.value);
      if (cfgRes.status === 'fulfilled') setSystemConfig(cfgRes.value);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMasterData();
  }, [refreshTrigger]);

  const handleCreatePackage = async (e) => {
    e.preventDefault();
    setCreatingPkg(true);
    try {
      await api.createMasterPackage({
        code: newPkgData.code,
        name: newPkgData.name,
        capacity_kw: parseFloat(newPkgData.capacity_kw),
        description: newPkgData.description,
        total_price_paise: Math.round(parseFloat(newPkgData.total_price_inr) * 100),
      });
      alert('Solar Package created successfully!');
      setShowCreatePkgModal(false);
      setNewPkgData({ code: '', name: '', capacity_kw: 3.0, description: '', total_price_inr: 185000 });
      loadAllMasterData();
    } catch (err) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setCreatingPkg(false);
    }
  };

  // Filtered packages
  const filteredPackages = packages.filter((p) => {
    if (pkgFilter === 'ON_GRID' && p.system_type !== 'ON_GRID') return false;
    if (pkgFilter === 'OFF_GRID' && p.system_type !== 'OFF_GRID') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filtered components
  const filteredComponents = components.filter((c) => {
    if (compCategoryFilter !== 'ALL' && c.category !== compCategoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.sku.toLowerCase().includes(q) ||
        c.manufacturer.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Engineering Master Data & System Configuration"
        subtitle="Standardized solar packages (1–5 kW), component catalogues, BOM recipes, pricing rules, and technical test templates"
        action={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {activeTab === 'packages' && (
              <button className="btn btn-primary" onClick={() => setShowCreatePkgModal(true)}>
                <Plus size={16} />
                <span>Add Package</span>
              </button>
            )}
            <button className="btn btn-secondary" onClick={loadAllMasterData}>
              <RefreshCw size={15} className={loading ? 'loading-spinner' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Top Asset Summary Cards */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.15rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Standard Packages</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
              {overview.packages?.total || 0}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 500 }}>
              {overview.packages?.on_grid || 0} On-Grid · {overview.packages?.off_grid || 0} Off-Grid
            </span>
          </div>

          <div className="card" style={{ padding: '1.15rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Master Components</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
              {overview.components?.total || 0}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 500 }}>
              {overview.components?.panels || 0} PV Panels · {overview.components?.inverters || 0} Inverters
            </span>
          </div>

          <div className="card" style={{ padding: '1.15rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Capacity Range</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
              1 kW – 5 kW
            </div>
            <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 500 }}>
              PM Surya Ghar Compliant
            </span>
          </div>

          <div className="card" style={{ padding: '1.15rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Active Warranty Policies</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
              {overview.warranty_policies_count || 0} Policies
            </div>
            <span style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 500 }}>
              Up to 25 Years Coverage
            </span>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="card" style={{ padding: '0.5rem 0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
          {[
            { id: 'packages', label: 'Solar Packages (1–5 kW)', icon: Boxes },
            { id: 'components', label: 'Component Catalogue', icon: Cpu },
            { id: 'bom_templates', label: 'BOM Recipes', icon: Layers },
            { id: 'pricing_tax', label: 'Pricing & GST', icon: DollarSign },
            { id: 'checklists', label: 'Technical Checklists', icon: CheckSquare },
            { id: 'commissioning', label: 'Electrical Test Templates', icon: Wrench },
            { id: 'warranties', label: 'Warranty Terms', icon: ShieldCheck },
            { id: 'settings', label: 'System Settings & SLAs', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Tab 1: Solar Packages (1-5 kW On-Grid & Off-Grid)             */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'packages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>FILTER:</span>
              {['ALL', 'ON_GRID', 'OFF_GRID'].map((t) => (
                <button
                  key={t}
                  onClick={() => setPkgFilter(t)}
                  className={`btn btn-sm ${pkgFilter === t ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem' }}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search packages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '0.45rem 0.6rem 0.45rem 2rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '200px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {filteredPackages.map((pkg) => (
              <div key={pkg.id} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span className={`badge ${pkg.system_type === 'ON_GRID' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: '0.68rem', marginBottom: '4px' }}>
                        {pkg.system_type.replace('_', ' ')}
                      </span>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '2px 0 0', color: '#0f172a' }}>
                        {pkg.name}
                      </h4>
                      <code style={{ fontSize: '0.72rem', color: '#64748b' }}>{pkg.code}</code>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>
                        ₹{pkg.total_price_inr.toLocaleString()}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{pkg.capacity_kw} kW System</span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.5rem 0 0.75rem', lineHeight: 1.4 }}>
                    {pkg.description || 'Pre-engineered solar kit including PV modules, string inverter, and mounting kit.'}
                  </p>

                  {pkg.items && pkg.items.length > 0 && (
                    <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Included Components:
                      </span>
                      <ul style={{ margin: '4px 0 0', paddingLeft: '1.1rem', fontSize: '0.75rem', color: '#334155' }}>
                        {pkg.items.slice(0, 4).map((it, idx) => (
                          <li key={idx}>
                            <strong>{it.quantity}x</strong> {it.component_name} ({it.category})
                          </li>
                        ))}
                        {pkg.items.length > 4 && (
                          <li style={{ color: '#64748b', fontStyle: 'italic' }}>
                            +{pkg.items.length - 4} more accessories...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                    PM Surya Ghar Eligible
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                    Active Template
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Tab 2: Master Components Catalogue                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'components' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>CATEGORY:</span>
              {['ALL', 'PANEL', 'INVERTER', 'BATTERY', 'STRUCTURE', 'CABLE', 'METER'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCompCategoryFilter(c)}
                  className={`btn btn-sm ${compCategoryFilter === c ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem' }}
                >
                  {c}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '0.45rem 0.6rem 0.45rem 2rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '200px' }}
              />
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Component Name / SKU</th>
                    <th>Category</th>
                    <th>Manufacturer & Model</th>
                    <th>Rated Power</th>
                    <th>Unit Cost</th>
                    <th>Selling Price</th>
                    <th>Warranty</th>
                    <th>Credibility Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComponents.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{c.name}</strong>
                        <code style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{c.sku}</code>
                      </td>
                      <td>
                        <span className="badge badge-secondary">{c.category}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, color: '#334155' }}>{c.manufacturer}</span>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{c.model_number}</span>
                      </td>
                      <td>
                        {c.rated_power_w ? `${c.rated_power_w} W` : '—'}
                      </td>
                      <td>₹{c.unit_cost_inr.toLocaleString()}</td>
                      <td>
                        <strong style={{ color: '#059669' }}>₹{c.unit_price_inr.toLocaleString()}</strong>
                      </td>
                      <td>{c.warranty_years} Years</td>
                      <td>
                        <span className="badge badge-primary">{c.credibility_score} / 100</span>
                      </td>
                      <td>
                        <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Tab 3: BOM Recipes (1-5 kW Templates)                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'bom_templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {(bomTemplates.templates || []).map((tmpl, idx) => (
            <div key={idx} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    {tmpl.name}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {tmpl.capacity_kw} kW {tmpl.type.replace('_', ' ')} Standard Recipe
                  </span>
                </div>
                <span className="badge badge-primary">{tmpl.capacity_kw} kW</span>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '4px' }}>Category</th>
                      <th style={{ padding: '4px' }}>Item Specification</th>
                      <th style={{ padding: '4px', textAlign: 'right' }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tmpl.items.map((it, itIdx) => (
                      <tr key={itIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 4px', fontWeight: 600, color: '#475569' }}>{it.category}</td>
                        <td style={{ padding: '5px 4px', color: '#1e293b' }}>{it.name}</td>
                        <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 700 }}>
                          {it.qty} {it.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Tab 4: Pricing & GST Configuration                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'pricing_tax' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* GST Splits */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={16} color="#059669" />
              <span>National Solar GST Rate Schedule</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Solar PV Modules Rate</span>
                <strong>{pricingTax.gst_rates?.solar_pv_modules_pct || 5}% GST</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Inverters & BOS Hardware</span>
                <strong>{pricingTax.gst_rates?.inverters_and_bos_pct || 12}% GST</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Installation & EPC Services</span>
                <strong>{pricingTax.gst_rates?.installation_and_epc_services_pct || 18}% GST</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.75rem', background: '#ecfdf5', borderRadius: '6px' }}>
                <span style={{ fontWeight: 600, color: '#065f46' }}>Effective Composite EPC Rate</span>
                <strong style={{ color: '#047857' }}>{pricingTax.gst_rates?.effective_composite_rate_pct || 8.9}%</strong>
              </div>
            </div>
          </div>

          {/* Benchmark Pricing per kW */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={16} color="#2563eb" />
              <span>Benchmark EPC Pricing per kW</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Residential Rooftop (1–3 kW)</span>
                <strong>₹{(pricingTax.benchmark_prices_inr_per_kw?.residential_rooftop_1_3kw || 58000).toLocaleString()} / kW</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Residential Rooftop (4–10 kW)</span>
                <strong>₹{(pricingTax.benchmark_prices_inr_per_kw?.residential_rooftop_4_10kw || 52000).toLocaleString()} / kW</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Commercial & Industrial</span>
                <strong>₹{(pricingTax.benchmark_prices_inr_per_kw?.commercial_industrial || 45000).toLocaleString()} / kW</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Off-Grid Storage Hybrid</span>
                <strong>₹{(pricingTax.benchmark_prices_inr_per_kw?.offgrid_hybrid_battery || 85000).toLocaleString()} / kW</strong>
              </div>
            </div>
          </div>

          {/* PM Surya Ghar Subsidy Slabs */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="#f59e0b" />
              <span>PM Surya Ghar Subsidy Parameters</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Tier 1 (Up to 2 kW)</span>
                <strong>₹{(pricingTax.pm_surya_ghar_subsidy?.tier1_up_to_2kw_per_kw_inr || 30000).toLocaleString()} / kW</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Tier 2 (3rd kW Addition)</span>
                <strong>₹{(pricingTax.pm_surya_ghar_subsidy?.tier2_3kw_additional_inr || 18000).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.75rem', background: '#fef3c7', borderRadius: '6px' }}>
                <span style={{ fontWeight: 600, color: '#92400e' }}>Maximum Central Subsidy</span>
                <strong style={{ color: '#b45309' }}>₹{(pricingTax.pm_surya_ghar_subsidy?.max_total_subsidy_inr || 78000).toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Tab 5: Technical Checklists                                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'checklists' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {/* Survey Checklist */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              Mandatory Site Survey Checklist
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {(checklists.survey_checklist || []).map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={15} color="#059669" />
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>{item.label}</span>
                  </div>
                  <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                    {item.category}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Installation Checklist */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              Field Installation & Mechanical Checklist
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {(checklists.installation_checklist || []).map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={15} color="#2563eb" />
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>{item.label}</span>
                  </div>
                  <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                    {item.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Tab 6: Commissioning & Electrical Test Templates             */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'commissioning' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
            Mandatory Plant Commissioning Electrical Tests
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Measurement Unit</th>
                  <th>Acceptable Engineering Tolerance</th>
                  <th>Mandatory Sign-off</th>
                </tr>
              </thead>
              <tbody>
                {(commissioningTests.electrical_tests || []).map((t, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{t.test_name}</strong>
                    </td>
                    <td><code>{t.unit}</code></td>
                    <td style={{ color: '#334155' }}>{t.tolerance}</td>
                    <td>
                      <span className="badge badge-success">Mandatory</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Tab 7: Warranty Terms & Policies                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'warranties' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {(warrantyTerms.standard_terms || []).map((w, idx) => (
            <div key={idx} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span className="badge badge-primary">{w.category}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669' }}>
                  {w.standard_years} Years Replacement
                </span>
              </div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.25rem 0', color: '#0f172a' }}>
                {w.category === 'PANEL' ? 'PV Modules Linear Power Warranty' : w.category === 'INVERTER' ? 'Inverter Warranty' : `${w.category} Warranty`}
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.5rem 0 0.75rem', lineHeight: 1.4 }}>
                {w.terms}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                <span>Performance: <strong>{w.performance_years} Yrs</strong></span>
                <span>SLA Response: <strong>{w.sla_days} Days</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Tab 8: System Configuration & SLAs                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {/* Company Profile */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              Company & Statutory Profile
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Company Name</span>
                <strong>{systemConfig.company_name || 'SunPower Solutions EPC Pvt Ltd'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>GSTIN</span>
                <code>{systemConfig.gstin || '27AAACS1234F1Z5'}</code>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Registered Office</span>
                <span style={{ color: '#334155' }}>{systemConfig.registered_office || 'Pune, Maharashtra'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Support Helpline & Email</span>
                <span style={{ color: '#334155' }}>{systemConfig.helpline_phone || '+91 20 6700 8900'} · {systemConfig.support_email}</span>
              </div>
            </div>
          </div>

          {/* Operational SLAs */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              Operational Service Level Agreements (SLAs)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Site Survey Assignment</span>
                <strong>{systemConfig.slas?.survey_assignment_hours || 24} Hours</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Site Survey Completion</span>
                <strong>{systemConfig.slas?.survey_completion_hours || 48} Hours</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Quotation Preparation</span>
                <strong>{systemConfig.slas?.quotation_preparation_hours || 24} Hours</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>BOM Inventory Allocation</span>
                <strong>{systemConfig.slas?.bom_allocation_hours || 48} Hours</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Installation Execution</span>
                <strong>{systemConfig.slas?.installation_execution_days || 7} Days</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Critical Service Ticket Resolution</span>
                <strong style={{ color: '#dc2626' }}>{systemConfig.slas?.critical_service_ticket_hours || 24} Hours</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal: Create Package                                         */}
      {/* ------------------------------------------------------------- */}
      {showCreatePkgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              Create New Solar Package
            </h3>

            <form onSubmit={handleCreatePackage} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Package Code (Unique)
                </label>
                <input
                  type="text"
                  value={newPkgData.code}
                  onChange={(e) => setNewPkgData({ ...newPkgData, code: e.target.value })}
                  placeholder="e.g. PKG-3.5KW-ONGRID"
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Package Name
                </label>
                <input
                  type="text"
                  value={newPkgData.name}
                  onChange={(e) => setNewPkgData({ ...newPkgData, name: e.target.value })}
                  placeholder="e.g. 3.5 kW Premium Dual Glass On-Grid"
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    System Capacity (kW)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newPkgData.capacity_kw}
                    onChange={(e) => setNewPkgData({ ...newPkgData, capacity_kw: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Total Price (₹)
                  </label>
                  <input
                    type="number"
                    value={newPkgData.total_price_inr}
                    onChange={(e) => setNewPkgData({ ...newPkgData, total_price_inr: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Description & Scope of Supply
                </label>
                <textarea
                  value={newPkgData.description}
                  onChange={(e) => setNewPkgData({ ...newPkgData, description: e.target.value })}
                  rows={3}
                  placeholder="Includes bifacial solar panels, string inverter, AC/DC DB, and mounting hardware."
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreatePkgModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creatingPkg}
                >
                  {creatingPkg ? 'Creating...' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

