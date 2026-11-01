import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext';
import {
  Sun, Shield, ArrowLeft, LogIn, Key, Check, AlertCircle,
  Briefcase, Compass, Wrench, Package, Headphones, CheckCircle2,
  Eye, EyeOff
} from 'lucide-react';

const ROLE_META = {
  admin: {
    roleKey: 'ADMIN',
    title: 'Solar Executive & Admin Portal',
    badge: 'Solar Admin / General Manager',
    desc: 'Company-wide EPC oversight, financial revenue recognition, and staff authorization.',
    icon: Shield,
    accentColor: '#d97706',
    headerBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    borderColor: '#f59e0b',
  },
  sales: {
    roleKey: 'SALES_EXECUTIVE',
    title: 'Commercial & Residential Sales Portal',
    badge: 'Sales Executive',
    desc: 'Customer CRM pipeline, quotation formulation, and lead follow-up tracking.',
    icon: Briefcase,
    accentColor: '#059669',
    headerBg: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
    borderColor: '#10b981',
  },
  technician: {
    roleKey: 'TECHNICIAN',
    title: 'Field Operations & Engineering Portal',
    badge: 'Field Technician',
    desc: 'On-site technical surveys, 8-point commissioning checklists, electrical tests, and service maintenance.',
    icon: Wrench,
    accentColor: '#0284c7',
    headerBg: 'linear-gradient(135deg, #0c4a6e 0%, #082f49 100%)',
    borderColor: '#0ea5e9',
  },
  warehouse: {
    roleKey: 'WAREHOUSE_MANAGER',
    title: 'Multi-Depot Supply Chain Portal',
    badge: 'Warehouse & Inventory Manager',
    desc: 'Depot stock transfers, BOM material reservation, and dispatch staging.',
    icon: Package,
    accentColor: '#ca8a04',
    headerBg: 'linear-gradient(135deg, #713f12 0%, #451a03 100%)',
    borderColor: '#eab308',
  },
  customer: {
    roleKey: 'CUSTOMER',
    title: 'Customer Self-Service Mobile Portal',
    badge: 'Customer / Solar Rooftop Owner',
    desc: 'Access your project milestones, book appointments, view Digital Passport, check warranties, and request service.',
    icon: Sun,
    accentColor: '#006c36',
    headerBg: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
    borderColor: '#10b981',
  },
};

export default function RoleLoginPage() {
  const { roleSlug } = useParams();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const meta = ROLE_META[roleSlug] || ROLE_META.admin;
  const demoAccount = DEMO_ACCOUNTS[meta.roleKey];

  const [usernameOrEmail, setUsernameOrEmail] = useState(demoAccount ? demoAccount.email : '');
  const [password, setPassword] = useState(demoAccount ? demoAccount.password : '');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [autofilledNotice, setAutofilledNotice] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const IconComponent = meta.icon;

  const handleFillDemo = () => {
    if (demoAccount) {
      setUsernameOrEmail(demoAccount.email);
      setPassword(demoAccount.password);
      setAutofilledNotice(true);
      setError(null);
      setTimeout(() => setAutofilledNotice(false), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setError('Please provide your username/email and password.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await login(usernameOrEmail, password, meta.roleKey);
      navigate(res?.dashboard_route || '/');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      {/* Top Navbar */}
      <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
        <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} />
          <span>All Role Portals</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc' }}>
          <Sun size={20} style={{ color: '#f59e0b' }} />
          <span style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>SunPower Solutions</span>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: '460px', background: '#1e293b', borderRadius: '14px', border: `1px solid ${meta.borderColor}33`, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          
          {/* Header Banner */}
          <div style={{ background: meta.headerBg, padding: '2rem', borderBottom: `2px solid ${meta.accentColor}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${meta.accentColor}22`, border: `1px solid ${meta.accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.accentColor }}>
                <IconComponent size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: meta.accentColor }}>
                  {meta.badge}
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  {meta.title}
                </h2>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
              {meta.desc}
            </p>
          </div>

          {/* Form Area */}
          <div style={{ padding: '2rem' }}>
            {/* Quick Demo Autofill Notice / Button */}
            <div style={{ marginBottom: '1.5rem', padding: '0.85rem 1rem', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0' }}>Demo Account Ready</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{demoAccount?.email}</div>
              </div>
              <button
                type="button"
                onClick={handleFillDemo}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '6px', background: `${meta.accentColor}22`, border: `1px solid ${meta.accentColor}`, color: meta.accentColor, cursor: 'pointer', fontWeight: 600 }}
              >
                {autofilledNotice ? 'Autofilled!' : 'Fill Demo'}
              </button>
            </div>

            {error && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#450a0a', border: '1px solid #ef4444', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#fca5a5', fontSize: '0.82rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Email or Username
                </label>
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="name@sunpower.com"
                  required
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.9rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  background: meta.accentColor,
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'opacity 0.2s',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                <LogIn size={18} />
                <span>{submitting ? 'Authenticating...' : `Enter ${meta.badge}`}</span>
              </button>
            </form>
          </div>

          {/* Footer Info */}
          <div style={{ background: '#0f172a', padding: '1rem 2rem', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
            <span>RBAC Enforced</span>
            <span>PBKDF2-SHA256 Token Auth</span>
          </div>

        </div>
      </div>
    </div>
  );
}
