import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  FileCheck,
  FileSpreadsheet,
  Image,
  AlertTriangle,
  CheckCircle,
  Plus,
  RefreshCw,
  Eye,
  File
} from 'lucide-react';
import { api } from '../services/api';
import Modal from './Modal';
import { FormField, Input, Select, Textarea } from './FormControls';

const CATEGORY_LABELS = {
  SURVEY_REPORT: 'Site Survey Report',
  QUOTATION_DOC: 'Customer Quotation',
  INSTALLATION_PHOTO: 'Installation Quality Photograph',
  COMMISSIONING_REPORT: 'Commissioning & Testing Report',
  WARRANTY_CERTIFICATE: 'Equipment Warranty Certificate',
  SERVICE_DOCUMENT: 'Service & Repair Worksheet',
  CUSTOMER_ID_PROOF: 'Customer Identity Proof',
  ELECTRICITY_BILL: 'Utility Electricity Bill',
  TECHNICAL_SPECIFICATION: 'Technical Engineering Datasheet',
  GOVERNMENT_SUBSIDY_APPROVAL: 'PM Surya Ghar Approval',
  OTHER: 'General Project Document',
};

export default function DocumentManager({
  entityType,
  entityId,
  entityIdentifier,
  title = 'Project Documents & Artifacts',
  description = 'Manage engineering attachments, compliance certificates, and inspection photographs.',
  compact = false,
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    category: 'TECHNICAL_SPECIFICATION',
    notes: '',
  });

  const loadDocuments = async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDocuments({
        entity_type: entityType,
        entity_id: entityId,
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
  }, [entityType, entityId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Selected file exceeds maximum allowed limit of 10 MB.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      if (!uploadForm.title) {
        // Auto-fill title from clean filename
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
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId.toString());
      if (entityIdentifier) {
        formData.append('entity_identifier', entityIdentifier);
      }
      formData.append('uploaded_by_name', 'Solar Operations Lead');
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
      const res = await api.deleteDocument(docId, false, 'Solar Operations Lead');
      setSuccess(res.message);
      await loadDocuments();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const getFileIcon = (mime = '', fname = '') => {
    const lower = (mime + fname).toLowerCase();
    if (lower.includes('pdf')) return <FileText size={18} style={{ color: '#dc2626' }} />;
    if (lower.includes('image') || lower.includes('png') || lower.includes('jpg') || lower.includes('jpeg')) {
      return <Image size={18} style={{ color: '#0284c7' }} />;
    }
    if (lower.includes('sheet') || lower.includes('csv') || lower.includes('excel') || lower.includes('xls')) {
      return <FileSpreadsheet size={18} style={{ color: '#16a34a' }} />;
    }
    return <File size={18} style={{ color: '#64748b' }} />;
  };

  return (
    <div style={{ marginTop: compact ? '0.5rem' : '1.25rem' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h4
            style={{
              fontSize: compact ? '0.9rem' : '1rem',
              fontWeight: 700,
              color: 'var(--navy-900)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <FileText size={16} />
            <span>{title}</span>
            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
              {documents.length}
            </span>
          </h4>
          {!compact && description && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadDocuments}
            title="Refresh document list"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsUploadModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <Upload size={13} />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
            background: '#fee2e2',
            border: '1px solid var(--red-600)',
            borderRadius: '6px',
            color: 'var(--red-600)',
            fontSize: '0.8rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <AlertTriangle size={15} />
          <span>{error}</span>
          <button
            type="button"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-600)' }}
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
            background: '#ecfdf5',
            border: '1px solid var(--solar-green-400)',
            borderRadius: '6px',
            color: 'var(--solar-green-600)',
            fontSize: '0.8rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <CheckCircle size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="card"
              style={{
                padding: '0.85rem',
                borderLeft: '4px solid var(--solar-green-500)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <div style={{ padding: '0.4rem', background: '#f8fafc', borderRadius: '6px' }}>
                  {getFileIcon(doc.mime_type, doc.original_file_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: 'var(--navy-900)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={doc.title}
                  >
                    {doc.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <span className="badge badge-neutral" style={{ fontSize: '0.65rem', marginRight: '0.35rem' }}>
                      {CATEGORY_LABELS[doc.category] || doc.category}
                    </span>
                    <span>{doc.file_size_display}</span>
                  </div>
                </div>
              </div>

              {doc.notes && (
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={doc.notes}
                >
                  {doc.notes}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.4rem',
                  marginTop: '0.2rem',
                }}
              >
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {doc.created_at ? doc.created_at.split('T')[0] : 'Uploaded'} · {doc.uploaded_by_name}
                </span>

                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <a
                    href={`http://127.0.0.1:8000/api/documents/${doc.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                    title="Download file"
                  >
                    <Download size={12} />
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.72rem', color: 'var(--red-600)' }}
                    onClick={() => handleDelete(doc.id, doc.title)}
                    title="Archive document"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}
        >
          <FileText size={24} style={{ margin: '0 auto 0.4rem', opacity: 0.4 }} />
          <p>No project documents uploaded yet for this record.</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsUploadModalOpen(true)}
            style={{ marginTop: '0.5rem' }}
          >
            <Upload size={13} /> Upload Document
          </button>
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title={`Upload Document: ${entityType} ${entityIdentifier ? `(${entityIdentifier})` : ''}`}
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

          <FormField label="Document Category" required>
            <Select
              value={uploadForm.category}
              onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
            >
              {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (
                <option key={catKey} value={catKey}>
                  {catLabel}
                </option>
              ))}
            </Select>
          </FormField>

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
            <div
              style={{
                padding: '0.5rem 0.75rem',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: '#166534',
              }}
            >
              Selected: <strong>{selectedFile.name}</strong> ({roundFileSize(selectedFile.size)})
            </div>
          )}

          <FormField label="Operational Notes / Description">
            <Textarea
              rows={2}
              value={uploadForm.notes}
              onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
              placeholder="e.g. Scanned copy of DISCOM net metering sanction letter with executive seal..."
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

function roundFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

