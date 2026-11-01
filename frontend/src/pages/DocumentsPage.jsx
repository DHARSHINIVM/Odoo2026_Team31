import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { FormField, Input, Select, Textarea } from '../components/FormControls';
import { ErrorState } from '../components/StateBoxes';
import { api } from '../services/api';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  FileSpreadsheet,
  Image,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  FileCheck,
  Search,
  Filter,
  Eye,
  File
} from 'lucide-react';

const CATEGORIES = [
  'ALL',
  'SURVEY_REPORT',
  'QUOTATION_DOC',
  'INSTALLATION_PHOTO',
  'COMMISSIONING_REPORT',
  'WARRANTY_CERTIFICATE',
  'SERVICE_DOCUMENT',
  'CUSTOMER_ID_PROOF',
  'ELECTRICITY_BILL',
  'TECHNICAL_SPECIFICATION',
  'GOVERNMENT_SUBSIDY_APPROVAL',
  'OTHER'
];

const ENTITY_TYPES = [
  'ALL',
  'CUSTOMER',
  'ENQUIRY',
  'SURVEY',
  'QUOTATION',
  'ORDER',
  'INSTALLATION',
  'PASSPORT',
  'WARRANTY',
  'SERVICE_TICKET',
  'COMPONENT'
];

export default function DocumentsPage({ refreshTrigger }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [entityTypeFilter, setEntityTypeFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Upload Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    category: 'TECHNICAL_SPECIFICATION',
    entity_type: 'ORDER',
    entity_id: '1',
    entity_identifier: '',
    notes: '',
  });

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDocuments({
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        entity_type: entityTypeFilter !== 'ALL' ? entityTypeFilter : undefined,
        search: searchTerm || undefined,
      });
      setDocuments(res.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger, categoryFilter, entityTypeFilter]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Selected file exceeds maximum limit of 10 MB.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      if (!uploadForm.title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setUploadForm((prev) => ({ ...prev, title: cleanName }));
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please choose a file to upload.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', uploadForm.title.trim() || selectedFile.name);
      formData.append('category', uploadForm.category);
      formData.append('entity_type', uploadForm.entity_type);
      formData.append('entity_id', uploadForm.entity_id);
      if (uploadForm.entity_identifier) {
        formData.append('entity_identifier', uploadForm.entity_identifier);
      }
      formData.append('uploaded_by_name', 'Solar EPC Manager');
      if (uploadForm.notes) {
        formData.append('notes', uploadForm.notes);
      }

      const res = await api.uploadDocument(formData);
      setSuccess(res.message);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadForm({
        title: '',
        category: 'TECHNICAL_SPECIFICATION',
        entity_type: 'ORDER',
        entity_id: '1',
        entity_identifier: '',
        notes: '',
      });
      await loadDocuments();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId, docTitle) => {
    if (!window.confirm(`Archive document "${docTitle}"?`)) return;
    try {
      const res = await api.deleteDocument(docId, false, 'Solar EPC Manager');
      setSuccess(res.message);
      await loadDocuments();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const getFileIcon = (mime = '', fname = '') => {
    const lower = (mime + fname).toLowerCase();
    if (lower.includes('pdf')) return <FileText size={16} style={{ color: '#dc2626' }} />;
    if (lower.includes('image') || lower.includes('png') || lower.includes('jpg') || lower.includes('jpeg')) {
      return <Image size={16} style={{ color: '#0284c7' }} />;
    }
    if (lower.includes('sheet') || lower.includes('csv') || lower.includes('excel') || lower.includes('xls')) {
      return <FileSpreadsheet size={16} style={{ color: '#16a34a' }} />;
    }
    return <File size={16} style={{ color: '#64748b' }} />;
  };

  const columns = [
    {
      header: 'Document Title',
      accessor: 'title',
      render: (d) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {getFileIcon(d.mime_type, d.original_file_name)}
          <div>
            <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{d.title}</span>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {d.original_file_name} · {d.file_size_display}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (d) => (
        <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
          {d.category.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      header: 'Associated Entity',
      accessor: 'entity_type',
      render: (d) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--navy-900)', fontSize: '0.82rem' }}>
            {d.entity_type} #{d.entity_id}
          </span>
          {d.entity_identifier && (
            <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>
              {d.entity_identifier}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Uploaded By / Date',
      accessor: 'created_at',
      render: (d) => (
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{d.uploaded_by_name}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {d.created_at ? d.created_at.split('T')[0] : 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Notes',
      accessor: 'notes',
      render: (d) => (
        <div style={{ maxWidth: '200px', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.notes}>
          {d.notes || '—'}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      render: (d) => (
        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
          <a
            href={`http://127.0.0.1:8000/api/documents/${d.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            title="Download document file"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
          >
            <Download size={13} /> Download
          </a>
          <button
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--red-600)' }}
            onClick={() => handleDelete(d.id, d.title)}
            title="Archive document"
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
        title="Document Management & Project Artifacts"
        description="Unified enterprise document repository for survey reports, client quotations, commissioning sheets, and equipment warranty certificates."
        action={
          <button className="btn btn-primary" onClick={() => setIsUploadModalOpen(true)}>
            <Upload size={16} /> Upload New Document
          </button>
        }
      />

      {/* Global Alerts */}
      {success && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem', background: '#ecfdf5', border: '1px solid var(--solar-green-400)', borderRadius: '8px', color: 'var(--solar-green-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem', background: '#fee2e2', border: '1px solid var(--red-600)', borderRadius: '8px', color: 'var(--red-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red-600)', fontWeight: 700 }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--navy-600)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Stored Documents</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy-900)' }}>{documents.length}</div>
        </div>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Survey & Technical Reports</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7' }}>
            {documents.filter((d) => d.category === 'SURVEY_REPORT' || d.category === 'TECHNICAL_SPECIFICATION').length}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--solar-green-500)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Commissioning & Handover</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
            {documents.filter((d) => d.category === 'COMMISSIONING_REPORT' || d.category === 'INSTALLATION_PHOTO').length}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Warranty & Compliance</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>
            {documents.filter((d) => d.category === 'WARRANTY_CERTIFICATE' || d.category === 'GOVERNMENT_SUBSIDY_APPROVAL').length}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Entity:</span>
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
          >
            {ENTITY_TYPES.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            setCategoryFilter('ALL');
            setEntityTypeFilter('ALL');
            setSearchTerm('');
            loadDocuments();
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Documents Table */}
      <DataTable
        columns={columns}
        data={documents}
        searchPlaceholder="Search document title, original filename, entity #..."
        searchKey="title"
        isLoading={loading}
        emptyMessage="No documents found matching the filter criteria. Upload project files using the button above."
      />

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Project Document"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleUploadSubmit} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Commit Upload'}
            </button>
          </>
        }
      >
        <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <FormField label="Document Title" required>
            <Input
              value={uploadForm.title}
              onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              placeholder="e.g. Inverter Commissioning Test Report"
              required
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Category" required>
              <Select
                value={uploadForm.category}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
              >
                {CATEGORIES.filter((c) => c !== 'ALL').map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Related Business Entity" required>
              <Select
                value={uploadForm.entity_type}
                onChange={(e) => setUploadForm({ ...uploadForm, entity_type: e.target.value })}
              >
                {ENTITY_TYPES.filter((et) => et !== 'ALL').map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Entity Primary Key ID" required>
              <Input
                type="number"
                min="1"
                value={uploadForm.entity_id}
                onChange={(e) => setUploadForm({ ...uploadForm, entity_id: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Entity Reference Code (Optional)">
              <Input
                value={uploadForm.entity_identifier}
                onChange={(e) => setUploadForm({ ...uploadForm, entity_identifier: e.target.value })}
                placeholder="e.g. ORD-2026-0001 or INS-2026-001"
              />
            </FormField>
          </div>

          <FormField label="File Attachment (PDF, JPG, PNG, WEBP, DOCX, XLSX - Max 10MB)" required>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.csv,.txt"
              onChange={handleFileChange}
              required
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            />
          </FormField>

          {selectedFile && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '0.8rem', color: '#166534' }}>
              Selected: <strong>{selectedFile.name}</strong> ({Math.round(selectedFile.size / 1024)} KB)
            </div>
          )}

          <FormField label="Operational Description / Notes">
            <Textarea
              rows={2}
              value={uploadForm.notes}
              onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
              placeholder="e.g. Official signed test verification copy..."
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

