import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { FormInput, FormSelect, FormTextarea } from '../components/FormControls';
import { ErrorState } from '../components/StateBoxes';
import { api } from '../services/api';
import {
  FileSpreadsheet,
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  Printer,
  Sparkles,
  IndianRupee,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';

const STATUS_FILTERS = ['ALL', 'DRAFT', 'SHARED', 'ACCEPTED', 'REJECTED'];

export default function QuotationsPage({ refreshTrigger }) {
  const [searchParams] = useSearchParams();
  const urlSurveyId = searchParams.get('surveyId');
  const urlEnquiryId = searchParams.get('enquiryId');

  const [quotations, setQuotations] = useState([]);
  const [approvedSurveys, setApprovedSurveys] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCreatedNotice, setOrderCreatedNotice] = useState(null);

  // Form State for Generating Quotation
  const [formData, setFormData] = useState({
    survey_id: '',
    package_id: '',
    system_capacity_kw: 5.0,
    gross_amount_inr: 295000,
    subsidy_amount_inr: 78000,
    discount_inr: 5000,
    tax_inr: 0,
    validity_days: 30,
    notes: 'Includes Waaree bifacial panels, Sungrow inverter and 5-yr O&M warranty.',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [quoteRes, surveyRes, pkgRes] = await Promise.allSettled([
        api.getQuotations({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        }),
        api.getSurveys({ status: 'APPROVED' }),
        api.getPackages(),
      ]);

      const quoteList = quoteRes.status === 'fulfilled' && Array.isArray(quoteRes.value) ? quoteRes.value : [];
      let surveyList = surveyRes.status === 'fulfilled' && Array.isArray(surveyRes.value) ? surveyRes.value : [];
      const pkgList = pkgRes.status === 'fulfilled' && Array.isArray(pkgRes.value) ? pkgRes.value : [];

      // If urlEnquiryId is specified and not in approved surveys, try to find any survey for that enquiry
      if (urlEnquiryId && !surveyList.some((s) => s.enquiry_id === parseInt(urlEnquiryId, 10))) {
        try {
          const allSurveys = await api.getSurveys();
          if (Array.isArray(allSurveys)) {
            const extra = allSurveys.filter((s) => s.enquiry_id === parseInt(urlEnquiryId, 10));
            if (extra.length > 0) {
              surveyList = [...surveyList, ...extra];
            }
          }
        } catch {
          // Ignore secondary fallback error
        }
      }

      setQuotations(quoteList);
      setApprovedSurveys(surveyList);
      setPackages(pkgList);

      if (quoteRes.status === 'rejected' && surveyRes.status === 'rejected') {
        throw new Error(quoteRes.reason?.message || 'Failed to load quotations data.');
      }

      if (surveyList.length > 0) {
        let targetSurvey = null;
        if (urlSurveyId) {
          targetSurvey = surveyList.find((s) => s.id === parseInt(urlSurveyId));
        } else if (urlEnquiryId) {
          targetSurvey = surveyList.find((s) => s.enquiry_id === parseInt(urlEnquiryId));
        }
        if (!targetSurvey && !formData.survey_id) {
          targetSurvey = surveyList[0];
        }
        if (targetSurvey) {
          setFormData((prev) => ({
            ...prev,
            survey_id: targetSurvey.id,
            system_capacity_kw: targetSurvey.recommended_capacity_kw || 5.0,
            gross_amount_inr: Math.round((targetSurvey.recommended_capacity_kw || 5.0) * 55000),
            subsidy_amount_inr: 78000,
          }));
          if (urlSurveyId || urlEnquiryId) {
            setIsCreateModalOpen(true);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger, statusFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSurveySelectChange = (e) => {
    const surveyId = parseInt(e.target.value, 10);
    const survey = approvedSurveys.find((s) => s.id === surveyId);
    if (survey) {
      const kw = survey.recommended_capacity_kw || 5.0;
      const gross = Math.round(kw * 55000);
      const sub = kw <= 2 ? 60000 : 78000;
      setFormData((prev) => ({
        ...prev,
        survey_id: surveyId,
        system_capacity_kw: kw,
        gross_amount_inr: gross,
        subsidy_amount_inr: sub,
      }));
    } else {
      setFormData((prev) => ({ ...prev, survey_id: e.target.value }));
    }
  };

  const handlePackageSelectChange = (e) => {
    const pkgId = e.target.value;
    const pkg = packages.find((p) => p.id === parseInt(pkgId, 10));
    if (pkg) {
      const gross = Math.round(pkg.total_price_paise / 100);
      const sub = pkg.capacity_kw <= 2 ? 60000 : 78000;
      setFormData((prev) => ({
        ...prev,
        package_id: pkg.id,
        system_capacity_kw: pkg.capacity_kw,
        gross_amount_inr: gross,
        subsidy_amount_inr: sub,
      }));
    } else {
      setFormData((prev) => ({ ...prev, package_id: '' }));
    }
  };

  const netPayableINR = Math.max(
    0,
    Number(formData.gross_amount_inr || 0) -
      Number(formData.subsidy_amount_inr || 0) -
      Number(formData.discount_inr || 0) +
      Number(formData.tax_inr || 0)
  );

  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    if (!formData.survey_id) {
      alert('Please select an approved site survey.');
      return;
    }
    const selectedSurveyObj = approvedSurveys.find((s) => s.id === parseInt(formData.survey_id, 10));
    if (!selectedSurveyObj) {
      alert('Selected survey not found.');
      return;
    }

    setIsSubmitting(true);
    try {
      const grossPaise = Math.round(Number(formData.gross_amount_inr) * 100);
      const subsidyPaise = Math.round(Number(formData.subsidy_amount_inr) * 100);
      const discountPaise = Math.round(Number(formData.discount_inr) * 100);
      const taxPaise = Math.round(Number(formData.tax_inr) * 100);
      const netPaise = Math.round(netPayableINR * 100);

      // Auto-generate standard BOM line items for breakdown
      const kw = parseFloat(formData.system_capacity_kw) || 5.0;
      const numPanels = Math.ceil((kw * 1000) / 550);
      const items = [
        {
          item_description: `Waaree 550W Bifacial Dual Glass Solar Modules (${numPanels} units)`,
          quantity: numPanels,
          unit_price_paise: 1250000,
          total_price_paise: numPanels * 1250000,
        },
        {
          item_description: `Sungrow Grid-Tied Solar Inverter with Real-Time Monitoring`,
          quantity: 1,
          unit_price_paise: 4800000,
          total_price_paise: 4800000,
        },
        {
          item_description: `Hot Dip Galvanized Module Mounting Structure Sets`,
          quantity: Math.ceil(numPanels / 4),
          unit_price_paise: 520000,
          total_price_paise: Math.ceil(numPanels / 4) * 520000,
        },
        {
          item_description: `BOS Cable, Earthing Pit, Lightning Arrester & Net Meter Sync`,
          quantity: 1,
          unit_price_paise: 590000,
          total_price_paise: 590000,
        },
      ];

      const payload = {
        enquiry_id: selectedSurveyObj.enquiry_id,
        survey_id: selectedSurveyObj.id,
        package_id: formData.package_id ? parseInt(formData.package_id, 10) : null,
        system_capacity_kw: kw,
        gross_amount_paise: grossPaise,
        subsidy_amount_paise: subsidyPaise,
        discount_paise: discountPaise,
        tax_amount_paise: taxPaise,
        net_amount_paise: netPaise,
        estimated_annual_units_kwh: kw * 1500.0,
        estimated_payback_years: 3.8,
        validity_days: parseInt(formData.validity_days, 10) || 30,
        notes: formData.notes,
        items,
      };

      await api.createQuotation(payload);
      setIsCreateModalOpen(false);
      loadData();
    } catch (err) {
      alert(`Quotation Creation Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptQuotation = async (q) => {
    if (!window.confirm(`Accept quotation ${q.quotation_number} for customer ${q.customer_name}? This will convert it into an official Installation Order.`)) {
      return;
    }
    try {
      const order = await api.acceptQuotation(q.id);
      setOrderCreatedNotice(`Order ${order.order_number} successfully created for ₹${(order.total_contract_paise/100).toLocaleString('en-IN')}!`);
      loadData();
      setTimeout(() => setOrderCreatedNotice(null), 6000);
    } catch (err) {
      alert(`Error accepting quotation: ${err.message}`);
    }
  };

  const handleRejectQuotation = async (q) => {
    if (!window.confirm(`Mark quotation ${q.quotation_number} as REJECTED?`)) return;
    try {
      await api.rejectQuotation(q.id);
      loadData();
    } catch (err) {
      alert(`Error rejecting quotation: ${err.message}`);
    }
  };

  const openPreviewModal = (q) => {
    setSelectedQuotation(q);
    setIsPreviewModalOpen(true);
  };

  const columns = [
    {
      header: 'Quote #',
      accessor: 'quotation_number',
      render: (q) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{q.quotation_number}</span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Enquiry: {q.enquiry_number}
          </div>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (q) => (
        <div>
          <div style={{ fontWeight: 600 }}>{q.customer_name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {q.customer_city} · {q.customer_phone}
          </div>
        </div>
      ),
    },
    {
      header: 'System Size',
      accessor: 'system_capacity_kw',
      render: (q) => (
        <span style={{ fontWeight: 700, color: 'var(--solar-green-600)' }}>
          {q.system_capacity_kw} kW
        </span>
      ),
    },
    {
      header: 'Gross Price',
      accessor: 'gross_amount_paise',
      render: (q) => `₹${(q.gross_amount_paise / 100).toLocaleString('en-IN')}`,
    },
    {
      header: 'Govt Subsidy',
      accessor: 'subsidy_amount_paise',
      render: (q) => (
        <span style={{ color: 'var(--solar-green-600)', fontWeight: 600 }}>
          -₹{(q.subsidy_amount_paise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Net Payable',
      accessor: 'net_amount_paise',
      render: (q) => (
        <span style={{ fontWeight: 800, color: 'var(--navy-900)' }}>
          ₹{(q.net_amount_paise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (q) => (
        <div>
          <StatusBadge status={q.status} />
          {q.order_number && (
            <div style={{ fontSize: '0.7rem', color: 'var(--solar-green-600)', marginTop: '2px', fontWeight: 600 }}>
              Converted: {q.order_number}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (q) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openPreviewModal(q)}
            title="Preview Printable Proposal"
          >
            <Eye size={13} /> View
          </button>
          {q.status !== 'ACCEPTED' && q.status !== 'REJECTED' && (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleAcceptQuotation(q)}
                title="Customer Accepts Proposal (Converts to Order)"
              >
                <CheckCircle2 size={13} /> Accept
              </button>
              <button
                className="btn btn-sm"
                style={{ color: 'var(--red-600)', background: '#fff5f5', border: '1px solid #fed7d7' }}
                onClick={() => handleRejectQuotation(q)}
                title="Customer Rejects"
              >
                <XCircle size={13} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const surveyOptions = approvedSurveys.map((s) => ({
    value: s.id,
    label: `${s.survey_number} · ${s.customer_name} (${s.recommended_capacity_kw}kW recommended · ${s.customer_city})`,
  }));

  const packageOptions = [
    { value: '', label: 'Custom Sized Installation' },
    ...packages.map((p) => ({
      value: p.id,
      label: `${p.name} (₹${(p.total_price_paise / 100).toLocaleString('en-IN')})`,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Quotations & Proposals"
        description="Formal solar EPC engineering proposals with PM Surya Ghar national subsidy calculation and order conversion."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={approvedSurveys.length === 0}
            title={approvedSurveys.length === 0 ? 'An approved site survey is required first' : ''}
          >
            <Plus size={16} />
            <span>Generate Quotation</span>
          </button>
        }
      />

      {/* Success Notification Banner on Order Conversion */}
      {orderCreatedNotice && (
        <div style={{ background: '#ecfdf5', border: '1px solid var(--solar-green-400)', color: 'var(--solar-green-600)', padding: '0.85rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <ShoppingBag size={18} />
          <span>{orderCreatedNotice}</span>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>
          Filter Status:
        </span>
        {STATUS_FILTERS.map((st) => (
          <button
            key={st}
            className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(st)}
          >
            {st}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Failed to load quotations" message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={quotations}
          searchPlaceholder="Search quotation #, customer, enquiry..."
          searchKey="quotation_number"
          isLoading={loading}
          emptyMessage="No quotations found. Select an approved survey to generate a proposal."
        />
      )}

      {/* Generate Quotation Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Generate Formal Solar Proposal"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateQuotation} disabled={isSubmitting || !formData.survey_id}>
              {isSubmitting ? 'Calculating & Saving...' : 'Generate Quotation Proposal'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateQuotation}>
          <FormSelect
            label="Select Approved Site Survey"
            name="survey_id"
            value={formData.survey_id}
            onChange={handleSurveySelectChange}
            options={surveyOptions.length > 0 ? surveyOptions : [{ value: '', label: 'No approved surveys found (approve survey first)' }]}
            required
          />

          <FormSelect
            label="Standard Pre-Configured Package (Optional)"
            name="package_id"
            value={formData.package_id}
            onChange={handlePackageSelectChange}
            options={packageOptions}
          />

          <div className="form-row">
            <FormInput
              label="System Capacity (kW)"
              name="system_capacity_kw"
              type="number"
              step="0.5"
              value={formData.system_capacity_kw}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Gross EPC Cost (₹)"
              name="gross_amount_inr"
              type="number"
              value={formData.gross_amount_inr}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-row">
            <FormInput
              label="PM Surya Ghar Subsidy (₹)"
              name="subsidy_amount_inr"
              type="number"
              value={formData.subsidy_amount_inr}
              onChange={handleInputChange}
            />
            <FormInput
              label="Promotional Discount (₹)"
              name="discount_inr"
              type="number"
              value={formData.discount_inr}
              onChange={handleInputChange}
            />
          </div>

          <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)', margin: '1rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>Final Net Payable Amount:</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
                ₹{netPayableINR.toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Includes Tier-1 bifacial panels, grid-tied inverter, certified racking structure, and 5-yr EPC warranty.
            </div>
          </div>

          <FormInput
            label="Proposal Validity (Days)"
            name="validity_days"
            type="number"
            value={formData.validity_days}
            onChange={handleInputChange}
            required
          />

          <FormTextarea
            label="Proposal Special Terms & Remarks"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={2}
          />
        </form>
      </Modal>

      {/* Printable Quotation Preview Modal */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={`Quotation Proposal: ${selectedQuotation?.quotation_number}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={15} /> Print / Save as PDF
            </button>
            <button className="btn btn-secondary" onClick={() => setIsPreviewModalOpen(false)}>
              Close
            </button>
            {selectedQuotation && selectedQuotation.status !== 'ACCEPTED' && selectedQuotation.status !== 'REJECTED' && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleAcceptQuotation(selectedQuotation);
                  setIsPreviewModalOpen(false);
                }}
              >
                Accept & Convert to Order
              </button>
            )}
          </>
        }
      >
        {selectedQuotation && (
          <div style={{ padding: '0.5rem', fontSize: '0.875rem' }}>
            {/* Proposal Header */}
            <div style={{ borderBottom: '2px solid var(--solar-green-500)', paddingBottom: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                  SunPower Solutions EPC
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Clean Energy Systems · Certified ISO 9001:2015</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Pune · Mumbai · Nashik Operational Centers</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-info" style={{ marginBottom: '0.25rem' }}>{selectedQuotation.quotation_number}</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date: {selectedQuotation.created_at?.split('T')[0]}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valid: {selectedQuotation.validity_days} Days</p>
              </div>
            </div>

            {/* Customer & System Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', marginBottom: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-900)', textTransform: 'uppercase' }}>Client Information</h4>
                <p style={{ fontWeight: 600, marginTop: '0.25rem' }}>{selectedQuotation.customer_name}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedQuotation.customer_address}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedQuotation.customer_city} · {selectedQuotation.customer_phone}</p>
              </div>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-900)', textTransform: 'uppercase' }}>System Specification</h4>
                <p style={{ fontWeight: 700, color: 'var(--solar-green-600)', fontSize: '1.1rem', marginTop: '0.25rem' }}>
                  {selectedQuotation.system_capacity_kw} kW Grid-Tied PV
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Est. Annual Generation: ~{Math.round(selectedQuotation.estimated_annual_units_kwh || 0)} Units (kWh)
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Projected Payback: {selectedQuotation.estimated_payback_years} Years
                </p>
              </div>
            </div>

            {/* Cost Breakdown Table */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-900)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Itemized Equipment & Workmanship Scope
              </h4>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedQuotation.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.item_description}</td>
                      <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{(it.total_price_paise / 100).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Box */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span>Gross Commercial Price:</span>
                <span style={{ fontWeight: 600 }}>₹{(selectedQuotation.gross_amount_paise / 100).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: 'var(--solar-green-600)' }}>
                <span>PM Surya Ghar Central Subsidy (Credited post-grid sync):</span>
                <span style={{ fontWeight: 600 }}>-₹{(selectedQuotation.subsidy_amount_paise / 100).toLocaleString('en-IN')}</span>
              </div>
              {selectedQuotation.discount_paise > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: 'var(--amber-600)' }}>
                  <span>Special Promotional Discount:</span>
                  <span style={{ fontWeight: 600 }}>-₹{(selectedQuotation.discount_paise / 100).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-strong)', paddingTop: '0.6rem', fontSize: '1.05rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>Customer Net Investment:</span>
                <span style={{ fontWeight: 800, color: 'var(--solar-green-600)' }}>
                  ₹{(selectedQuotation.net_amount_paise / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-900)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Terms & Conditions
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                {selectedQuotation.terms_and_conditions}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

