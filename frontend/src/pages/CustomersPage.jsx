import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { FormInput } from '../components/FormControls';
import { ErrorState } from '../components/StateBoxes';
import { api } from '../services/api';
import { UserPlus, MapPin, Eye, Edit2, Trash2, Phone, Mail, Building, FileText, CheckCircle2 } from 'lucide-react';

export default function CustomersPage({ refreshTrigger }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [cityFilter, setCityFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    consumer_number: '',
    avg_monthly_bill_inr: 4500,
    sanctioned_load_kw: 5.0,
  });

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCustomers({
        search: searchTerm || undefined,
        city: cityFilter !== 'ALL' ? cityFilter : undefined,
      });
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [refreshTrigger, cityFilter]);

  // Extract distinct cities for filtering
  const distinctCities = Array.from(new Set(customers.map((c) => c.city).filter(Boolean)));

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      consumer_number: '',
      avg_monthly_bill_inr: 4500,
      sanctioned_load_kw: 5.0,
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (c) => {
    setSelectedCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      address: c.address,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      consumer_number: c.consumer_number || '',
      avg_monthly_bill_inr: Math.round(c.avg_monthly_bill_paise / 100),
      sanctioned_load_kw: c.sanctioned_load_kw,
    });
    setIsEditModalOpen(true);
  };

  const openDetailModal = (c) => {
    setSelectedCustomer(c);
    setIsDetailModalOpen(true);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        consumer_number: formData.consumer_number || null,
        avg_monthly_bill_paise: Math.round(Number(formData.avg_monthly_bill_inr) * 100),
        sanctioned_load_kw: parseFloat(formData.sanctioned_load_kw) || 0.0,
      };

      await api.createCustomer(payload);
      setIsAddModalOpen(false);
      loadCustomers();
    } catch (err) {
      alert(`Failed to create customer: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        consumer_number: formData.consumer_number || null,
        avg_monthly_bill_paise: Math.round(Number(formData.avg_monthly_bill_inr) * 100),
        sanctioned_load_kw: parseFloat(formData.sanctioned_load_kw) || 0.0,
      };

      await api.updateCustomer(selectedCustomer.id, payload);
      setIsEditModalOpen(false);
      setSelectedCustomer(null);
      loadCustomers();
    } catch (err) {
      alert(`Failed to update customer: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (c) => {
    const confirmMessage = `Are you sure you want to delete customer '${c.name}'? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      await api.deleteCustomer(c.id);
      loadCustomers();
    } catch (err) {
      alert(err.message);
    }
  };

  const columns = [
    {
      header: 'Customer Name',
      accessor: 'name',
      render: (c) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{c.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID #{c.id}</div>
        </div>
      ),
    },
    {
      header: 'Contact',
      accessor: 'phone',
      render: (c) => (
        <div>
          <div>{c.phone}</div>
          {c.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</div>}
        </div>
      ),
    },
    {
      header: 'Location',
      accessor: 'city',
      render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
          <MapPin size={13} color="var(--text-muted)" />
          <span>{c.city}, {c.state}</span>
        </div>
      ),
    },
    {
      header: 'Consumer #',
      accessor: 'consumer_number',
      render: (c) => (
        <code style={{ fontSize: '0.78rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
          {c.consumer_number || 'N/A'}
        </code>
      ),
    },
    {
      header: 'Avg Monthly Bill',
      accessor: 'avg_monthly_bill_paise',
      render: (c) => (
        <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>
          ₹{(c.avg_monthly_bill_paise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Load (kW)',
      accessor: 'sanctioned_load_kw',
      render: (c) => `${c.sanctioned_load_kw} kW`,
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (c) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openDetailModal(c)}
            title="View Customer Details"
          >
            <Eye size={13} /> Details
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openEditModal(c)}
            title="Edit Customer"
          >
            <Edit2 size={13} /> Edit
          </button>
          <button
            className="btn btn-sm"
            style={{ color: 'var(--red-600)', background: '#fff5f5', border: '1px solid #fed7d7' }}
            onClick={() => handleDeleteCustomer(c)}
            title="Delete Customer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customer Directory"
        description="Comprehensive solar client and property records linked across all inquiries, surveys, and installations."
        actions={
          <button className="btn btn-primary" onClick={openAddModal}>
            <UserPlus size={16} />
            <span>Add Customer</span>
          </button>
        }
      />

      {/* City Filter Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filter City:</span>
        <button
          className={`btn btn-sm ${cityFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCityFilter('ALL')}
        >
          All Cities
        </button>
        {distinctCities.map((city) => (
          <button
            key={city}
            className={`btn btn-sm ${cityFilter === city ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCityFilter(city)}
          >
            {city}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Failed to load customers" message={error} onRetry={loadCustomers} />
      ) : (
        <DataTable
          columns={columns}
          data={customers}
          searchPlaceholder="Search customer by name, phone, consumer #..."
          searchKey="name"
          isLoading={loading}
          emptyMessage="No customers matching criteria. Click 'Add Customer' above to record a new client."
        />
      )}

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Solar Client"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateCustomer} disabled={isSubmitting || !formData.name || !formData.phone}>
              {isSubmitting ? 'Saving...' : 'Create Customer Record'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateCustomer}>
          <div className="form-row">
            <FormInput
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g. Anand Kulkarni"
              required
            />
            <FormInput
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="e.g. +91 98220 12345"
              required
            />
          </div>

          <FormInput
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="e.g. anand@gmail.com"
          />

          <FormInput
            label="Street Address / Site Location"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="e.g. Bungalow 12, Baner Pashan Link Road"
            required
          />

          <div className="form-row">
            <FormInput
              label="City"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              placeholder="e.g. Pune"
              required
            />
            <FormInput
              label="State"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              placeholder="Maharashtra"
              required
            />
          </div>

          <div className="form-row">
            <FormInput
              label="Pincode"
              name="pincode"
              value={formData.pincode}
              onChange={handleInputChange}
              placeholder="411045"
              required
            />
            <FormInput
              label="DISCOM Consumer Number"
              name="consumer_number"
              value={formData.consumer_number}
              onChange={handleInputChange}
              placeholder="MSEDCL-PUN-001928"
            />
          </div>

          <div className="form-row">
            <FormInput
              label="Avg Monthly Electricity Bill (₹)"
              name="avg_monthly_bill_inr"
              type="number"
              value={formData.avg_monthly_bill_inr}
              onChange={handleInputChange}
              placeholder="4500"
            />
            <FormInput
              label="Sanctioned Grid Load (kW)"
              name="sanctioned_load_kw"
              type="number"
              step="0.5"
              value={formData.sanctioned_load_kw}
              onChange={handleInputChange}
              placeholder="5.0"
            />
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Customer: ${selectedCustomer?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleUpdateCustomer} disabled={isSubmitting || !formData.name || !formData.phone}>
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdateCustomer}>
          <div className="form-row">
            <FormInput
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
            />
          </div>

          <FormInput
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
          />

          <FormInput
            label="Street Address / Site Location"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            required
          />

          <div className="form-row">
            <FormInput
              label="City"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="State"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-row">
            <FormInput
              label="Pincode"
              name="pincode"
              value={formData.pincode}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="DISCOM Consumer Number"
              name="consumer_number"
              value={formData.consumer_number}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-row">
            <FormInput
              label="Avg Monthly Electricity Bill (₹)"
              name="avg_monthly_bill_inr"
              type="number"
              value={formData.avg_monthly_bill_inr}
              onChange={handleInputChange}
            />
            <FormInput
              label="Sanctioned Grid Load (kW)"
              name="sanctioned_load_kw"
              type="number"
              step="0.5"
              value={formData.sanctioned_load_kw}
              onChange={handleInputChange}
            />
          </div>
        </form>
      </Modal>

      {/* Customer Details Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Customer Profile & Site History"
        footer={
          <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
            Close
          </button>
        }
      >
        {selectedCustomer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                {selectedCustomer.name}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Client ID #{selectedCustomer.id} · UUID: {selectedCustomer.uuid}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Phone</span>
                <p style={{ fontWeight: 600 }}>{selectedCustomer.phone}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Email</span>
                <p>{selectedCustomer.email || 'N/A'}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Location</span>
                <p>{selectedCustomer.city}, {selectedCustomer.state} - {selectedCustomer.pincode}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>DISCOM Consumer #</span>
                <p><code>{selectedCustomer.consumer_number || 'N/A'}</code></p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Avg Monthly Bill</span>
                <p style={{ fontWeight: 600, color: 'var(--solar-green-600)' }}>
                  ₹{(selectedCustomer.avg_monthly_bill_paise / 100).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Sanctioned Load</span>
                <p>{selectedCustomer.sanctioned_load_kw} kW</p>
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Installation Address</span>
              <p style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', marginTop: '0.25rem' }}>
                {selectedCustomer.address}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ flex: 1, padding: '0.75rem', background: '#ecfdf5', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--solar-green-600)' }}>
                  {selectedCustomer.enquiries_count || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--solar-green-600)', fontWeight: 600 }}>Linked Enquiries</div>
              </div>
              <div style={{ flex: 1, padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--blue-600)' }}>
                  {selectedCustomer.orders_count || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--blue-600)', fontWeight: 600 }}>Confirmed Orders</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
