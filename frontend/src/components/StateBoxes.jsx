import React from 'react';
import { Inbox, AlertCircle, RefreshCw } from 'lucide-react';

export function LoadingState({ message = 'Loading records...' }) {
  return (
    <div className="state-box">
      <div className="loading-spinner"></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>{message}</p>
    </div>
  );
}

export function EmptyState({ title = 'No data available', description = 'There are no records to display currently.', action }) {
  return (
    <div className="state-box">
      <div className="empty-icon-wrapper">
        <Inbox size={32} />
      </div>
      <div className="empty-title">{title}</div>
      <p className="empty-desc">{description}</p>
      {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Failed to load', message = 'An unexpected error occurred while communicating with the backend server.', onRetry }) {
  return (
    <div className="state-box" style={{ border: '1px dashed var(--red-600)', borderRadius: '10px', background: '#fff5f5' }}>
      <div style={{ color: 'var(--red-600)' }}>
        <AlertCircle size={36} />
      </div>
      <div className="empty-title" style={{ color: 'var(--red-600)' }}>{title}</div>
      <p className="empty-desc">{message}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry} style={{ marginTop: '0.5rem' }}>
          <RefreshCw size={14} /> Retry Request
        </button>
      )}
    </div>
  );
}

