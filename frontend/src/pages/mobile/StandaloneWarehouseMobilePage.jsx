import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import WarehouseManagerMobileApp from './WarehouseManagerMobileApp';

export default function StandaloneWarehouseMobilePage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getWarehouseDashboard();
      setData(res);
    } catch (err) {
      setError(err.message);
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
        background: '#f7f9ff',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #fef08a',
          borderTopColor: '#ca8a04',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ marginTop: '1rem', color: '#475569', fontWeight: 600, fontSize: '0.9rem' }}>
          Loading Warehouse Depot Operations...
        </p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h3 style={{ color: '#b91c1c' }}>Depot Sync Error</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{error}</p>
        <button
          onClick={loadData}
          style={{
            marginTop: '1rem',
            padding: '0.6rem 1.2rem',
            background: '#ca8a04',
            color: '#fff',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return <WarehouseManagerMobileApp data={data} user={user} onRefresh={loadData} />;
}
