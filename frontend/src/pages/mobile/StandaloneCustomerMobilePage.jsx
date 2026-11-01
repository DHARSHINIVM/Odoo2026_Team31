import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CustomerMobileApp from './CustomerMobileApp';

export default function StandaloneCustomerMobilePage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCustomerDashboard();
      setData(res);
    } catch (err) {
      console.error('Customer Dashboard loading error:', err);
      setError(err.message || 'Failed to synchronize with SunPower central backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f4faf5',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          border: '4px solid #e8f7eb',
          borderTopColor: '#006c36',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ marginTop: '1.2rem', color: '#006c36', fontWeight: 700, fontSize: '0.95rem' }}>
          Synchronizing Solar Project Telemetry...
        </p>
        <p style={{ marginTop: '0.2rem', color: '#56615a', fontSize: '0.8rem' }}>
          Connecting to SunPower Central EPC Network
        </p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        fontFamily: 'Inter, sans-serif',
        background: '#f4faf5',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#fee2e2',
          color: '#b91c1c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          marginBottom: '1rem'
        }}>
          !
        </div>
        <h3 style={{ color: '#0f172a', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Customer Portal Sync Error</h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: '360px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
          {error}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={loadData}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#006c36',
              color: '#ffffff',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
              boxShadow: '0 2px 4px rgba(0,108,54,0.2)'
            }}
          >
            Retry Connection
          </button>
          <button
            onClick={logout}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#e2e8f0',
              color: '#334155',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Sign In Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <CustomerMobileApp
      initialData={data}
      user={user}
      onRefresh={loadData}
    />
  );
}

