import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { FormField, Input, Select, Textarea } from '../components/FormControls';
import { ErrorState, EmptyState } from '../components/StateBoxes';
import { api } from '../services/api';
import {
  Layers,
  Box,
  Cpu,
  ShieldCheck,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  ArrowRight,
  Eye,
  Edit,
  CheckCircle,
  AlertTriangle,
  Zap,
  IndianRupee,
  Package as PackageIcon,
  Search,
} from 'lucide-react';

const CATEGORIES = [
  'ALL',
  'SOLAR_PANEL',
  'INVERTER',
  'MOUNTING_STRUCTURE',
  'BATTERY',
  'CABLES',
  'PROTECTION',
  'ACCESSORIES',
];

const TIER_GRADES = ['ALL', 'TIER_1', 'TIER_2', 'TIER_3'];

export default function BomPage({ refreshTrigger }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active Tab: 'catalogue', 'packages', 'orders-bom'
  const activeTab = searchParams.get('tab') || 'catalogue';
  const initialOrderId = searchParams.get('orderId');

  const setTab = (tabName) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabName);
      return next;
    });
  };

  // State: Catalogue
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productCategory, setProductCategory] = useState('ALL');
  const [productTier, setProductTier] = useState('ALL');
  const [productSearch, setProductSearch] = useState('');

  // State: Packages
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // State: Orders & BOM
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId ? parseInt(initialOrderId) : null);
  const [selectedOrderBom, setSelectedOrderBom] = useState(null);
  const [loadingBom, setLoadingBom] = useState(false);
  const [generatingBom, setGeneratingBom] = useState(false);

  // State: Errors & Feedback
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // State: Modals
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productFormData, setProductFormData] = useState({
    sku: '',
    name: '',
    manufacturer: '',
    model_number: '',
    category: 'SOLAR_PANEL',
    rating_capacity: '',
    unit_cost_inr: '',
    unit_price_inr: '',
    tier_grade: 'TIER_1',
    failure_rate_pct: '0.2',
    credibility_score: '95',
    certification_status: 'BIS / IEC 61215 Certified',
    documentation_status: 'Datasheet & Warranty Verified',
    warranty_years: '25',
    description: '',
  });

  const [isAddPackageModalOpen, setIsAddPackageModalOpen] = useState(false);
  const [packageFormData, setPackageFormData] = useState({
    code: '',
    name: '',
    capacity_kw: '5.0',
    grid_type: 'ON_GRID',
    base_price_inr: '295000',
    description: '',
  });

  // 1. Fetch Catalogue Products
  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await api.getProducts({
        category: productCategory !== 'ALL' ? productCategory : undefined,
        tier: productTier !== 'ALL' ? productTier : undefined,
        search: productSearch || undefined,
      });
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  // 2. Fetch Solar Packages
  const loadPackages = async () => {
    setLoadingPackages(true);
    try {
      const data = await api.getPackages();
      setPackages(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPackages(false);
    }
  };

  // 3. Fetch Orders for BOM compilation
  const loadOrders = async () => {
    try {
      const ords = await api.getOrders();
      setOrders(ords);
      if (!selectedOrderId && ords.length > 0) {
        setSelectedOrderId(ords[0].id);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    }
  };

  // 4. Fetch BOM for selected Order
  const loadBomForOrder = async (orderId) => {
    if (!orderId) {
      setSelectedOrderBom(null);
      return;
    }
    setLoadingBom(true);
    setError(null);
    try {
      const bomData = await api.getOrderBom(orderId);
      setSelectedOrderBom(bomData);
    } catch (err) {
      // 404 means BOM not yet generated
      setSelectedOrderBom(null);
    } finally {
      setLoadingBom(false);
    }
  };

  useEffect(() => {
    loadProducts();
    loadPackages();
    loadOrders();
  }, [refreshTrigger]);

  useEffect(() => {
    loadProducts();
  }, [productCategory, productTier, productSearch]);

  useEffect(() => {
    if (selectedOrderId) {
      loadBomForOrder(selectedOrderId);
    }
  }, [selectedOrderId]);

  // Handler: Generate BOM
  const handleGenerateBom = async () => {
    if (!selectedOrderId) return;
    setGeneratingBom(true);
    setError(null);
    try {
      const res = await api.generateOrderBom(selectedOrderId);
      setActionSuccess(res.message);
      await loadBomForOrder(selectedOrderId);
      await loadOrders(); // refresh order stages
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingBom(false);
    }
  };

  // Handler: Add Component Form Submit
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        sku: productFormData.sku,
        name: productFormData.name,
        manufacturer: productFormData.manufacturer,
        model_number: productFormData.model_number,
        category: productFormData.category,
        rating_capacity: productFormData.rating_capacity,
        unit_cost_paise: Math.round(parseFloat(productFormData.unit_cost_inr || '0') * 100),
        unit_price_paise: Math.round(parseFloat(productFormData.unit_price_inr || productFormData.unit_cost_inr || '0') * 100),
        tier_grade: productFormData.tier_grade,
        failure_rate_pct: parseFloat(productFormData.failure_rate_pct || '0.2'),
        credibility_score: parseInt(productFormData.credibility_score || '90'),
        certification_status: productFormData.certification_status,
        documentation_status: productFormData.documentation_status,
        warranty_years: parseInt(productFormData.warranty_years || '5'),
        description: productFormData.description,
      };

      if (isEditProductModalOpen && selectedProduct) {
        await api.updateProduct(selectedProduct.id, payload);
        setActionSuccess(`Component ${selectedProduct.sku} updated successfully.`);
      } else {
        await api.createProduct(payload);
        setActionSuccess(`New component ${payload.sku} catalogued successfully.`);
      }

      setIsAddProductModalOpen(false);
      setIsEditProductModalOpen(false);
      setSelectedProduct(null);
      await loadProducts();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const openEditProductModal = (prod) => {
    setSelectedProduct(prod);
    setProductFormData({
      sku: prod.sku,
      name: prod.name,
      manufacturer: prod.manufacturer,
      model_number: prod.model_number,
      category: prod.category,
      rating_capacity: prod.rating_capacity || '',
      unit_cost_inr: (prod.unit_cost_paise / 100).toString(),
      unit_price_inr: (prod.unit_price_paise / 100).toString(),
      tier_grade: prod.tier_grade || 'TIER_1',
      failure_rate_pct: (prod.failure_rate_pct || 0.2).toString(),
      credibility_score: (prod.credibility_score || 90).toString(),
      certification_status: prod.certification_status || '',
      documentation_status: prod.documentation_status || '',
      warranty_years: (prod.warranty_years || 5).toString(),
      description: prod.description || '',
    });
    setIsEditProductModalOpen(true);
  };

  // Handler: Add Solar Package Form Submit
  const handlePackageSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        code: packageFormData.code,
        name: packageFormData.name,
        capacity_kw: parseFloat(packageFormData.capacity_kw),
        grid_type: packageFormData.grid_type,
        base_price_paise: Math.round(parseFloat(packageFormData.base_price_inr) * 100),
        description: packageFormData.description,
        items: [],
      };
      await api.createPackage(payload);
      setActionSuccess(`New solar package ${payload.name} created.`);
      setIsAddPackageModalOpen(false);
      await loadPackages();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Catalogue Table Columns
  const catalogueColumns = [
    {
      header: 'Component SKU',
      accessor: 'sku',
      render: (p) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{p.sku}</span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.model_number}</div>
        </div>
      ),
    },
    {
      header: 'Product Name',
      accessor: 'name',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600 }}>{p.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Mfr: <span style={{ fontWeight: 500 }}>{p.manufacturer}</span> · {p.rating_capacity}
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (p) => <span className="badge badge-neutral">{p.category.replace(/_/g, ' ')}</span>,
    },
    {
      header: 'Unit Cost',
      accessor: 'unit_cost_paise',
      render: (p) => (
        <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>
          ₹{(p.unit_cost_paise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Tier',
      accessor: 'tier_grade',
      render: (p) => <StatusBadge status={p.tier_grade} />,
    },
    {
      header: 'Credibility Score',
      accessor: 'credibility_score',
      render: (p) => {
        const score = p.credibility_score || 85;
        const color = score >= 90 ? 'var(--solar-green-600)' : score >= 80 ? 'var(--amber-600)' : 'var(--red-600)';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: score >= 90 ? '#ecfdf5' : '#fffbeb',
                border: `1.5px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.75rem',
                color: color,
              }}
            >
              {score}
            </div>
            <div style={{ fontSize: '0.72rem' }}>
              <div style={{ fontWeight: 600, color }}>{score >= 90 ? 'Grade A+' : 'Standard'}</div>
              <div style={{ color: 'var(--text-muted)' }}>Fail: {p.failure_rate_pct}%</div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Certifications',
      accessor: 'certification_status',
      render: (p) => (
        <div style={{ maxWidth: '200px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--solar-green-600)', fontWeight: 600 }}>● {p.certification_status || 'Standard BIS'}</span>
          <div>{p.documentation_status || 'Documentation on file'}</div>
        </div>
      ),
    },
    {
      header: 'Action',
      accessor: 'actions',
      align: 'right',
      render: (p) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => openEditProductModal(p)}
          title="Edit Component Details"
        >
          <Edit size={13} /> Edit
        </button>
      ),
    },
  ];

  // Catalogue Stats Calculations
  const totalComponentsCount = products.length;
  const tier1Count = products.filter((p) => p.tier_grade === 'TIER_1').length;
  const avgCredibility = totalComponentsCount
    ? Math.round(products.reduce((acc, p) => acc + (p.credibility_score || 90), 0) / totalComponentsCount)
    : 0;

  return (
    <div>
      <PageHeader
        title="Products, Packages & BOM Compilation"
        description="Engineering bill of materials derivation, component catalogue with credibility evaluation, and standard turnkey solar packages."
        action={
          activeTab === 'catalogue' ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setProductFormData({
                  sku: `SP-SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                  name: '',
                  manufacturer: '',
                  model_number: '',
                  category: 'SOLAR_PANEL',
                  rating_capacity: '',
                  unit_cost_inr: '',
                  unit_price_inr: '',
                  tier_grade: 'TIER_1',
                  failure_rate_pct: '0.2',
                  credibility_score: '95',
                  certification_status: 'BIS / IEC 61215 Certified',
                  documentation_status: 'Datasheet & Warranty Verified',
                  warranty_years: '25',
                  description: '',
                });
                setIsAddProductModalOpen(true);
              }}
            >
              <Plus size={16} /> Add Component
            </button>
          ) : activeTab === 'packages' ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setPackageFormData({
                  code: `PKG-${Math.floor(100 + Math.random() * 900)}`,
                  name: '',
                  capacity_kw: '5.0',
                  grid_type: 'ON_GRID',
                  base_price_inr: '295000',
                  description: '',
                });
                setIsAddPackageModalOpen(true);
              }}
            >
              <Plus size={16} /> New Solar Package
            </button>
          ) : null
        }
      />

      {/* Global Alerts */}
      {actionSuccess && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem', background: '#ecfdf5', border: '1px solid var(--solar-green-400)', borderRadius: '8px', color: 'var(--solar-green-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem', background: '#fee2e2', border: '1px solid var(--red-600)', borderRadius: '8px', color: 'var(--red-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red-600)', fontWeight: 700 }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem', paddingBottom: '0.25rem' }}>
        <button
          className={`btn ${activeTab === 'catalogue' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setTab('catalogue')}
        >
          <Cpu size={16} />
          <span>Component Catalogue & Credibility</span>
          <span className="badge badge-neutral" style={{ marginLeft: '0.25rem' }}>{products.length}</span>
        </button>

        <button
          className={`btn ${activeTab === 'packages' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setTab('packages')}
        >
          <PackageIcon size={16} />
          <span>Standard Solar Packages</span>
          <span className="badge badge-neutral" style={{ marginLeft: '0.25rem' }}>{packages.length}</span>
        </button>

        <button
          className={`btn ${activeTab === 'orders-bom' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setTab('orders-bom')}
        >
          <FileSpreadsheet size={16} />
          <span>Order BOM Compilation</span>
          <span className="badge badge-info" style={{ marginLeft: '0.25rem' }}>
            {orders.filter((o) => o.stage === 'CONFIRMED' || o.stage === 'BOM_GENERATED').length} Pending
          </span>
        </button>
      </div>

      {/* ==================== TAB 1: COMPONENT CATALOGUE ==================== */}
      {activeTab === 'catalogue' && (
        <div>
          {/* Quick Stats Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.6rem', background: '#ecfdf5', borderRadius: '8px', color: 'var(--solar-green-600)' }}>
                <Box size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Catalogue Items</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{totalComponentsCount} SKUs</div>
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.6rem', background: '#ecfdf5', borderRadius: '8px', color: 'var(--solar-green-600)' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tier 1 Certified</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
                  {tier1Count} / {totalComponentsCount}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.6rem', background: '#fffbeb', borderRadius: '8px', color: 'var(--amber-600)' }}>
                <Zap size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Credibility Index</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                  {avgCredibility} / 100
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', color: 'var(--navy-700)' }}>
                <Layers size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Categories</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>7 Disciplines</div>
              </div>
            </div>
          </div>

          {/* Filtering Controls */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>
              Category:
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`btn btn-sm ${productCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setProductCategory(cat)}
              >
                {cat.replace(/_/g, ' ')}
              </button>
            ))}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Tier:</span>
              <select
                className="input"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
                value={productTier}
                onChange={(e) => setProductTier(e.target.value)}
              >
                {TIER_GRADES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DataTable
            columns={catalogueColumns}
            data={products}
            searchPlaceholder="Search component by SKU, model, manufacturer, name..."
            searchKey="name"
            isLoading={loadingProducts}
            emptyMessage="No components found in this category. Click 'Add Component' to catalogue new equipment."
          />
        </div>
      )}

      {/* ==================== TAB 2: SOLAR PACKAGES ==================== */}
      {activeTab === 'packages' && (
        <div>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Turnkey system configurations tailored for quick estimation, quotation, and automated Bill of Materials generation.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={loadPackages}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: `4px solid ${pkg.grid_type === 'ON_GRID' ? 'var(--solar-green-500)' : 'var(--amber-500)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{pkg.code}</span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--navy-900)' }}>
                      {pkg.name}
                    </h3>
                  </div>
                  <span className={`badge ${pkg.grid_type === 'ON_GRID' ? 'badge-success' : 'badge-warning'}`}>
                    {pkg.grid_type.replace(/_/g, ' ')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                    ₹{(pkg.base_price_paise / 100).toLocaleString('en-IN')}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>turnkey base</span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', flex: 1 }}>
                  {pkg.description || `Standard ${pkg.capacity_kw} kW solar installation package complete with Tier-1 modules, inverter, structure and AC/DC protection.`}
                </p>

                {/* Component Breakdown Mini Table */}
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Included Bill of Materials</span>
                    <span>{pkg.items?.length || 0} Line Items</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {pkg.items && pkg.items.length > 0 ? (
                      pkg.items.slice(0, 5).map((it) => (
                        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--navy-700)' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {it.component_name || `Component #${it.component_id}`}
                          </span>
                          <span style={{ fontWeight: 600 }}>× {it.quantity}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Predefined standard components</span>
                    )}
                    {pkg.items && pkg.items.length > 5 && (
                      <span style={{ color: 'var(--solar-green-600)', fontWeight: 600 }}>
                        + {pkg.items.length - 5} more accessories & cables
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--solar-green-600)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Zap size={14} /> {pkg.capacity_kw} kW System
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: ORDER BOM COMPILATION ==================== */}
      {activeTab === 'orders-bom' && (
        <div>
          {/* Order Selector Banner */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', color: 'var(--navy-800)' }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>
                    Select Commercial Order to Compile / Inspect BOM
                  </label>
                  <select
                    className="input"
                    style={{ minWidth: '320px', fontWeight: 600, color: 'var(--navy-900)' }}
                    value={selectedOrderId || ''}
                    onChange={(e) => setSelectedOrderId(parseInt(e.target.value))}
                  >
                    {orders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.order_number} — {ord.customer_name} ({ord.system_capacity_kw || 5} kW) [{ord.stage}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedOrderBom ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => loadBomForOrder(selectedOrderId)}
                    disabled={loadingBom}
                  >
                    <RefreshCw size={13} className={loadingBom ? 'spin' : ''} /> Refresh BOM
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/inventory?tab=allocate&orderId=${selectedOrderId}`)}
                  >
                    <ArrowRight size={14} /> Proceed to Warehouse Allocation
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleGenerateBom}
                  disabled={generatingBom || !selectedOrderId}
                >
                  <RefreshCw size={16} className={generatingBom ? 'spin' : ''} />
                  <span>{generatingBom ? 'Compiling BOM...' : 'Generate Bill of Materials'}</span>
                </button>
              )}
            </div>
          </div>

          {/* BOM Details or Empty State */}
          {loadingBom ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
              <p>Compiling engineering specifications & BOM line items...</p>
            </div>
          ) : selectedOrderBom ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* BOM Master Card */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-info" style={{ fontWeight: 700 }}>{selectedOrderBom.bom_number}</span>
                      <StatusBadge status={selectedOrderBom.status} />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--navy-900)' }}>
                      Bill of Materials for {selectedOrderBom.order_number}
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Customer: <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{selectedOrderBom.customer_name}</span> ({selectedOrderBom.customer_city})
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>System Capacity</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--solar-green-600)', display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'flex-end' }}>
                        <Zap size={16} /> {selectedOrderBom.system_capacity_kw} kW
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Material Cost</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                        ₹{selectedOrderBom.total_cost_inr.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--navy-900)' }}>
                  Engineering Line Items ({selectedOrderBom.items.length})
                </h3>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item SKU</th>
                        <th>Component Description</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'center' }}>Required Qty</th>
                        <th style={{ textAlign: 'center' }}>Allocated Qty</th>
                        <th style={{ textAlign: 'right' }}>Unit Cost</th>
                        <th style={{ textAlign: 'right' }}>Total Cost</th>
                        <th>Allocation Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderBom.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{item.sku}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.component_name}</div>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {item.category.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                            {item.quantity_required}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color:
                                  item.quantity_allocated >= item.quantity_required
                                    ? 'var(--solar-green-600)'
                                    : item.quantity_allocated > 0
                                    ? 'var(--amber-600)'
                                    : 'var(--text-muted)',
                              }}
                            >
                              {item.quantity_allocated}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>₹{item.unit_cost_inr.toLocaleString('en-IN')}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            ₹{item.total_cost_inr.toLocaleString('en-IN')}
                          </td>
                          <td>
                            <StatusBadge status={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Next Step Footer */}
                <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#ecfdf5', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--solar-green-600)', fontSize: '0.85rem' }}>
                    <CheckCircle size={16} />
                    <span>
                      {selectedOrderBom.status === 'ALLOCATED'
                        ? 'All components have been allocated from warehouse inventory.'
                        : 'BOM generated and ready for multi-warehouse inventory allocation across Pune, Mumbai, and Nashik.'}
                    </span>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/inventory?tab=allocate&orderId=${selectedOrderId}`)}
                  >
                    Open Allocation Planner <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <FileSpreadsheet size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.5rem' }}>
                No Bill of Materials Generated Yet
              </h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 1.5rem', fontSize: '0.875rem' }}>
                Generate an engineering Bill of Materials for this confirmed order. The system will derive panel counts, inverter sizing, mounting structures, and BOS quantities directly from the contract specifications.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleGenerateBom}
                disabled={generatingBom || !selectedOrderId}
              >
                <RefreshCw size={16} className={generatingBom ? 'spin' : ''} />
                <span>{generatingBom ? 'Compiling BOM...' : 'Generate Bill of Materials Now'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================== ADD / EDIT COMPONENT MODAL ==================== */}
      <Modal
        isOpen={isAddProductModalOpen || isEditProductModalOpen}
        onClose={() => {
          setIsAddProductModalOpen(false);
          setIsEditProductModalOpen(false);
        }}
        title={isEditProductModalOpen ? `Edit Component: ${selectedProduct?.sku}` : 'Catalogue New Solar Component'}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIsAddProductModalOpen(false);
                setIsEditProductModalOpen(false);
              }}
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleProductSubmit}>
              {isEditProductModalOpen ? 'Save Changes' : 'Catalogue Component'}
            </button>
          </>
        }
      >
        <form onSubmit={handleProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="SKU Code" required>
              <Input
                value={productFormData.sku}
                onChange={(e) => setProductFormData({ ...productFormData, sku: e.target.value })}
                required
                disabled={isEditProductModalOpen}
              />
            </FormField>

            <FormField label="Category" required>
              <Select
                value={productFormData.category}
                onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
              >
                {CATEGORIES.filter((c) => c !== 'ALL').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Component Name" required>
            <Input
              value={productFormData.name}
              onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
              placeholder="e.g. Waaree 540W Mono PERC Bifacial Solar Panel"
              required
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Manufacturer" required>
              <Input
                value={productFormData.manufacturer}
                onChange={(e) => setProductFormData({ ...productFormData, manufacturer: e.target.value })}
                placeholder="e.g. Waaree Energies"
                required
              />
            </FormField>

            <FormField label="Model Number" required>
              <Input
                value={productFormData.model_number}
                onChange={(e) => setProductFormData({ ...productFormData, model_number: e.target.value })}
                placeholder="e.g. WSMD-540"
                required
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Rating / Capacity">
              <Input
                value={productFormData.rating_capacity}
                onChange={(e) => setProductFormData({ ...productFormData, rating_capacity: e.target.value })}
                placeholder="e.g. 540W or 5 kW"
              />
            </FormField>

            <FormField label="Unit Cost (INR ₹)" required>
              <Input
                type="number"
                step="0.01"
                value={productFormData.unit_cost_inr}
                onChange={(e) => setProductFormData({ ...productFormData, unit_cost_inr: e.target.value })}
                placeholder="10500"
                required
              />
            </FormField>

            <FormField label="Tier Grade" required>
              <Select
                value={productFormData.tier_grade}
                onChange={(e) => setProductFormData({ ...productFormData, tier_grade: e.target.value })}
              >
                <option value="TIER_1">TIER 1 (Premium / Bankable)</option>
                <option value="TIER_2">TIER 2 (Standard)</option>
                <option value="TIER_3">TIER 3 (Economy)</option>
              </Select>
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Credibility Score (0-100)">
              <Input
                type="number"
                min="0"
                max="100"
                value={productFormData.credibility_score}
                onChange={(e) => setProductFormData({ ...productFormData, credibility_score: e.target.value })}
              />
            </FormField>

            <FormField label="Failure Rate %">
              <Input
                type="number"
                step="0.01"
                value={productFormData.failure_rate_pct}
                onChange={(e) => setProductFormData({ ...productFormData, failure_rate_pct: e.target.value })}
                placeholder="0.25"
              />
            </FormField>

            <FormField label="Warranty (Years)">
              <Input
                type="number"
                value={productFormData.warranty_years}
                onChange={(e) => setProductFormData({ ...productFormData, warranty_years: e.target.value })}
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Certification Status">
              <Input
                value={productFormData.certification_status}
                onChange={(e) => setProductFormData({ ...productFormData, certification_status: e.target.value })}
                placeholder="BIS / IEC 61215 / UL Certified"
              />
            </FormField>

            <FormField label="Documentation Status">
              <Input
                value={productFormData.documentation_status}
                onChange={(e) => setProductFormData({ ...productFormData, documentation_status: e.target.value })}
                placeholder="Datasheet & Test Reports Verified"
              />
            </FormField>
          </div>

          <FormField label="Description & Technical Specs">
            <Textarea
              rows={2}
              value={productFormData.description}
              onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
              placeholder="Module efficiency, temperature coefficient, IP rating..."
            />
          </FormField>
        </form>
      </Modal>

      {/* ==================== CREATE SOLAR PACKAGE MODAL ==================== */}
      <Modal
        isOpen={isAddPackageModalOpen}
        onClose={() => setIsAddPackageModalOpen(false)}
        title="Create Predefined Solar Package"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAddPackageModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handlePackageSubmit}>
              Create Package
            </button>
          </>
        }
      >
        <form onSubmit={handlePackageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <FormField label="Package Code" required>
              <Input
                value={packageFormData.code}
                onChange={(e) => setPackageFormData({ ...packageFormData, code: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Package Name" required>
              <Input
                value={packageFormData.name}
                onChange={(e) => setPackageFormData({ ...packageFormData, name: e.target.value })}
                placeholder="e.g. 5 kW Commercial Hybrid Package"
                required
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Capacity (kW)" required>
              <Input
                type="number"
                step="0.5"
                value={packageFormData.capacity_kw}
                onChange={(e) => setPackageFormData({ ...packageFormData, capacity_kw: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Grid Architecture" required>
              <Select
                value={packageFormData.grid_type}
                onChange={(e) => setPackageFormData({ ...packageFormData, grid_type: e.target.value })}
              >
                <option value="ON_GRID">ON GRID (Grid-Tied)</option>
                <option value="OFF_GRID">OFF GRID (Battery Storage)</option>
                <option value="HYBRID">HYBRID</option>
              </Select>
            </FormField>

            <FormField label="Base Turnkey Price (₹)" required>
              <Input
                type="number"
                value={packageFormData.base_price_inr}
                onChange={(e) => setPackageFormData({ ...packageFormData, base_price_inr: e.target.value })}
                required
              />
            </FormField>
          </div>

          <FormField label="Package Description">
            <Textarea
              rows={3}
              value={packageFormData.description}
              onChange={(e) => setPackageFormData({ ...packageFormData, description: e.target.value })}
              placeholder="Recommended application, warranties, component highlights..."
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

