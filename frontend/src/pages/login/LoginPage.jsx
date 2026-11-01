import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext';
import {
  Sun, Shield, Briefcase, Compass, Wrench, Package, Headphones,
  LogIn, ArrowRight, Zap, CheckCircle2, AlertCircle, Eye, EyeOff
} from 'lucide-react';

const ROLES_LIST = [
  {
    key: 'ADMIN',
    slug: 'admin',
    name: '1. Administrator',
    user: 'Vikram Malhotra',
    email: 'admin@sunpower.com',
    desc: 'Executive KPIs, financial recognition, user authorization, and company-wide EPC oversight.',
    icon: Shield,
    color: '#d97706',
    border: '#f59e0b',
    bgBadge: '#451a03',
  },
  {
    key: 'SALES_EXECUTIVE',
    slug: 'sales',
    name: '2. Sales Executive',
    user: 'Rahul Deshmukh',
    email: 'sales@sunpower.com',
    desc: 'Customer CRM pipeline, 16 commercial/residential leads, quotation formulation, and order booking.',
    icon: Briefcase,
    color: '#059669',
    border: '#10b981',
    bgBadge: '#022c22',
  },
  {
    key: 'TECHNICIAN',
    slug: 'technician',
    name: '3. Technician',
    user: 'Deepak Chavan',
    email: 'technician@sunpower.com',
    desc: 'Unified field operations: site surveys, 8-point installation commissioning, telemetry, and service maintenance.',
    icon: Wrench,
    color: '#0284c7',
    border: '#0ea5e9',
    bgBadge: '#082f49',
  },
  {
    key: 'WAREHOUSE_MANAGER',
    slug: 'warehouse',
    name: '4. Warehouse Manager',
    user: 'Manoj Gokhale',
    email: 'warehouse@sunpower.com',
    desc: 'Multi-depot stock balances, BOM allocations, QR barcode scanning, dispatches, and material returns.',
    icon: Package,
    color: '#ca8a04',
    border: '#eab308',
    bgBadge: '#422006',
  },
  {
    key: 'CUSTOMER',
    slug: 'customer',
    name: '5. Customer',
    user: 'Rajesh Sharma',
    email: 'customer@sunpower.com',
    desc: 'Project transparency, milestone tracking, Digital Solar Passport, warranties, and service support requests.',
    icon: Sun,
    color: '#006c36',
    border: '#10b981',
    bgBadge: '#022c22',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { quickDemoLogin, login, isAuthenticated } = useAuth();

  const [loadingRole, setLoadingRole] = useState(null);
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [customError, setCustomError] = useState(null);
  const [submittingCustom, setSubmittingCustom] = useState(false);

  // If already authenticated, redirect to home / dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleQuickLogin = async (roleKey) => {
    setLoadingRole(roleKey);
    try {
      const res = await quickDemoLogin(roleKey);
      navigate(res?.dashboard_route || '/');
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    } finally {
      setLoadingRole(null);
    }
  };

  const handleCustomLogin = async (e) => {
    e.preventDefault();
    setSubmittingCustom(true);
    setCustomError(null);
    try {
      const res = await login(customEmail, customPassword);
      navigate(res?.dashboard_route || '/');
    } catch (err) {
      setCustomError(err.message || 'Authentication failed');
    } finally {
      setSubmittingCustom(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0b1120', color: '#f8fafc', padding: '2rem 1.5rem' }}>
      {/* Brand Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto 2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1.25rem', background: '#1e293b', borderRadius: '30px', border: '1px solid #334155', marginBottom: '1.25rem' }}>
          <Sun size={24} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>SunPower Solutions EPC</span>
          <span style={{ fontSize: '0.72rem', background: '#f59e0b22', color: '#f59e0b', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>Phase 2 RBAC</span>
        </div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 0.75rem', color: '#ffffff' }}>
          Multi-Role Authentication & Access Portals
        </h1>
        <p style={{ maxWidth: '720px', margin: '0 auto', fontSize: '0.95rem', color: '#94a3b8', lineHeight: 1.6 }}>
          Select any of the 5 authorized roles below to access your dedicated operational workspace and scoped permissions.
        </p>
      </div>

      {/* 5 Role Cards Grid */}
      <div style={{ maxWidth: '1200px', margin: '0 auto 3rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {ROLES_LIST.map((role) => {
          const Icon = role.icon;
          const isLoading = loadingRole === role.key;

          return (
            <div
              key={role.key}
              style={{
                background: '#1e293b',
                borderRadius: '12px',
                border: `1px solid ${role.border}33`,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              }}
            >
              <div>
                {/* Role Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: `${role.color}22`, border: `1px solid ${role.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: role.color }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                        {role.name}
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: role.color, fontWeight: 600 }}>
                        {role.user}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: role.bgBadge, color: role.color, fontWeight: 700 }}>
                    {role.key}
                  </span>
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  {role.desc}
                </p>

                {/* Account info */}
                <div style={{ background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: '#64748b', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{role.email}</span>
                  <span style={{ color: '#cbd5e1' }}>Password@123</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => handleQuickLogin(role.key)}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: '0.65rem 0.75rem',
                    borderRadius: '6px',
                    background: role.color,
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Zap size={15} />
                  <span>{isLoading ? 'Logging in...' : 'Quick Login'}</span>
                </button>

                <Link
                  to={`/login/${role.slug}`}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    background: '#334155',
                    color: '#f8fafc',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  title="Open dedicated login screen for this role"
                >
                  <span>Portal</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Standard Login Form at the Bottom */}
      <div style={{ maxWidth: '460px', margin: '0 auto', background: '#1e293b', padding: '1.75rem', borderRadius: '12px', border: '1px solid #334155' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#f8fafc' }}>
          Manual Account Login
        </h3>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 1.25rem' }}>
          Log in with any custom username or registered company email address.
        </p>

        {customError && (
          <div style={{ marginBottom: '1rem', padding: '0.6rem 0.85rem', background: '#450a0a', border: '1px solid #ef4444', borderRadius: '6px', color: '#fca5a5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={15} />
            <span>{customError}</span>
          </div>
        )}

        <form onSubmit={handleCustomLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.3rem' }}>
              Username or Email
            </label>
            <input
              type="text"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="e.g. admin@sunpower.com"
              required
              style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.3rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCustomPassword ? 'text' : 'password'}
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%', padding: '0.65rem 2.25rem 0.65rem 0.85rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
              />
              <button
                type="button"
                onClick={() => setShowCustomPassword(!showCustomPassword)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={showCustomPassword ? 'Hide password' : 'Show password'}
              >
                {showCustomPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submittingCustom}
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: submittingCustom ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <LogIn size={16} />
            <span>{submittingCustom ? 'Verifying...' : 'Sign In'}</span>
          </button>
        </form>
      </div>

    </div>
  );
}

