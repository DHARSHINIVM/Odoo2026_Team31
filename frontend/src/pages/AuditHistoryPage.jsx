import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { api } from '../services/api';
import {
  History,
  Shield,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle,
  AlertTriangle,
  Calendar,
  User,
  ArrowRight
} from 'lucide-react';

const ENTITY_MODULES = [
  'ALL',
  'ORDER',
  'SURVEY',
  'QUOTATION',
  'ENQUIRY',
  'INSTALLATION',
  'INVENTORY_TRANSFER',
  'DISPATCH',
  'PASSPORT',
  'WARRANTY',
  'SERVICE_TICKET',
  'COMPONENT',
  'DOCUMENT',
  'USER'
];

const ACTION_TYPES = [
  'ALL',
  'CREATE',
  'UPDATE',
  'STATUS_CHANGE',
  'APPROVE',
  'REJECT',
  'ALLOCATE',
  'DISPATCH',
  'COMMISSION',
  'TRANSFER',
  'PAYMENT',
  'EXPENSE',
  'UPLOAD',
  'ARCHIVE'
];

export default function AuditHistoryPage({ refreshTrigger }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Diff Modal
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState(null);

  const loadAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAuditLogs({
        entity_type: entityFilter !== 'ALL' ? entityFilter : undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: searchTerm || undefined,
        limit: 100,
      });
      setLogs(res.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [refreshTrigger, entityFilter, actionFilter, startDate, endDate]);

  const openDiffModal = (audit) => {
    setSelectedAudit(audit);
    setIsDiffModalOpen(true);
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'APPROVE':
      case 'COMMISSION':
        return <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>{action}</span>;
      case 'REJECT':
      case 'DELETE_PERMANENT':
        return <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>{action}</span>;
      case 'STATUS_CHANGE':
        return <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>{action.replace('_', ' ')}</span>;
      case 'ALLOCATE':
      case 'DISPATCH':
      case 'TRANSFER':
        return <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', fontSize: '0.72rem', fontWeight: 700 }}>{action}</span>;
      case 'PAYMENT':
      case 'EXPENSE':
        return <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>{action}</span>;
      default:
        return <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>{action}</span>;
    }
  };

  const columns = [
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (l) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 600, color: 'var(--navy-900)', fontSize: '0.8rem' }}>
            {l.timestamp ? l.timestamp.split('T')[0] : 'N/A'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {l.timestamp ? l.timestamp.split('T')[1]?.split('.')[0] : ''} UTC
          </div>
        </div>
      ),
    },
    {
      header: 'Actor / User',
      accessor: 'user_name',
      render: (l) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--navy-900)' }}>
            {l.user_name || 'System / Batch'}
          </div>
          <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
            {l.user_role || 'SYSTEM'}
          </span>
        </div>
      ),
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (l) => getActionBadge(l.action),
    },
    {
      header: 'Target Entity',
      accessor: 'entity_type',
      render: (l) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--navy-900)', fontSize: '0.82rem' }}>
            {l.entity_type} {l.entity_id ? `#${l.entity_id}` : ''}
          </span>
          {l.entity_identifier && (
            <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>
              {l.entity_identifier}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Operational Details',
      accessor: 'details',
      render: (l) => (
        <div style={{ fontSize: '0.8rem', color: 'var(--navy-800)', maxWidth: '350px' }}>
          {l.details || '—'}
        </div>
      ),
    },
    {
      header: 'State Diff',
      accessor: 'actions',
      align: 'right',
      render: (l) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => openDiffModal(l)}
          title="Inspect state before and after changes"
          disabled={!l.old_values && !l.new_values}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
        >
          <Eye size={13} /> {l.old_values || l.new_values ? 'Inspect Diff' : 'No State'}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit History & Traceability Ledger"
        description="Immutable chronological audit trail recording authenticated user transactions, status progressions, approvals, and allocation events across all modules."
      />

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem', background: '#fee2e2', border: '1px solid var(--red-600)', borderRadius: '8px', color: 'var(--red-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red-600)', fontWeight: 700 }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--navy-600)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Recorded Events</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy-900)' }}>{logs.length}</div>
        </div>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status Transitions</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>
            {logs.filter((l) => l.action === 'STATUS_CHANGE').length}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--solar-green-500)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Approvals & Commissioning</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--solar-green-600)' }}>
            {logs.filter((l) => l.action === 'APPROVE' || l.action === 'COMMISSION').length}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Logistics & Allocations</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed' }}>
            {logs.filter((l) => l.action === 'ALLOCATE' || l.action === 'DISPATCH' || l.action === 'TRANSFER').length}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Module:</span>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
          >
            {ENTITY_MODULES.map((em) => (
              <option key={em} value={em}>
                {em.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
          >
            {ACTION_TYPES.map((at) => (
              <option key={at} value={at}>
                {at.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
          />
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
          />
        </div>

        <button
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            setEntityFilter('ALL');
            setActionFilter('ALL');
            setStartDate('');
            setEndDate('');
            setSearchTerm('');
            loadAuditLogs();
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={logs}
        searchPlaceholder="Search audit details, entity #, actor name, action..."
        searchKey="details"
        isLoading={loading}
        emptyMessage="No audit records found matching the filter criteria."
      />

      {/* Diff Inspection Modal */}
      <Modal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        title={`Audit State Inspection: ${selectedAudit?.action} on ${selectedAudit?.entity_type} ${selectedAudit?.entity_identifier || ''}`}
        footer={
          <button className="btn btn-primary" onClick={() => setIsDiffModalOpen(false)}>
            Close
          </button>
        }
      >
        {selectedAudit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Actor:</span>
                <span style={{ fontWeight: 700 }}>{selectedAudit.user_name} ({selectedAudit.user_role})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>
                <span style={{ fontWeight: 600 }}>{selectedAudit.timestamp}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target Entity:</span>
                <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>
                  {selectedAudit.entity_type} #{selectedAudit.entity_id} ({selectedAudit.entity_identifier || 'N/A'})
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontWeight: 600, color: 'var(--navy-900)' }}>
              Summary: {selectedAudit.details}
            </p>

            {/* State Diffs */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedAudit.old_values ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
              {selectedAudit.old_values && (
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--red-600)', textTransform: 'uppercase' }}>
                    State Before Action
                  </span>
                  <pre
                    style={{
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      overflowX: 'auto',
                      maxHeight: '250px',
                    }}
                  >
                    {JSON.stringify(selectedAudit.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAudit.new_values && (
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--solar-green-600)', textTransform: 'uppercase' }}>
                    State After Action
                  </span>
                  <pre
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      overflowX: 'auto',
                      maxHeight: '250px',
                    }}
                  >
                    {JSON.stringify(selectedAudit.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

