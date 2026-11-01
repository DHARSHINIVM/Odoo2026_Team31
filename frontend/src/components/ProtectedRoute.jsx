import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading, hasRole, demoAccounts, quickDemoLogin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
        <RefreshCw size={28} className="loading-spinner" style={{ color: 'var(--solar-orange-500)' }} />
        <span style={{ color: 'var(--solar-gray-500)', fontSize: '0.9rem' }}>Verifying authenticated session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return (
      <div className="card" style={{ maxWidth: '640px', margin: '3rem auto', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: '#fef2f2', color: '#dc2626', borderRadius: '50%', marginBottom: '1.25rem' }}>
          <ShieldAlert size={40} />
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
          Unauthorized Access (Role Restriction)
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Your current account <strong>{user.full_name}</strong> has role <span className="badge badge-secondary">{user.role}</span> which is not permitted to access this module.
        </p>

        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#475569' }}>
          Required Role: {Array.isArray(allowedRoles) ? allowedRoles.join(', ') : allowedRoles}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Return to Dashboard</span>
          </Link>

          {/* Quick Demo Switcher if user wants to switch into allowed role */}
          {Array.isArray(allowedRoles) && allowedRoles.length > 0 && (
            <button
              className="btn btn-primary"
              onClick={() => quickDemoLogin(allowedRoles[0])}
            >
              <span>Switch to {allowedRoles[0]} (Demo)</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return children;
}

