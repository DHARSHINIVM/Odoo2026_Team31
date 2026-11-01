import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Database, ChevronRight, Server,
  User as UserIcon, LogOut, ChevronDown, Shield, RefreshCw, CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import NotificationsDrawer from '../components/NotificationsDrawer';

const routeNameMap = {
  '/': 'Dashboard Overview',
  '/customers': 'Customer Directory',
  '/enquiries': 'Solar Enquiries',
  '/surveys': 'Site Surveys',
  '/quotations': 'Quotations & Proposals',
  '/orders': 'Installation Orders',
  '/bom': 'Products & Bill of Materials',
  '/inventory': 'Multi-Warehouse Inventory',
  '/dispatch': 'Dispatch & Serial Barcodes',
  '/installations': 'Installation & Commissioning',
  '/solar-passport': 'Digital Solar Passport',
  '/service': 'Service & Maintenance Tickets',
  '/credibility-hub': 'Component Credibility Hub',
  '/analytics': 'Financial & Operational Analytics',
  '/subsidies': 'PM Surya Ghar Subsidy Portal',
  '/users': 'Enterprise Staff & RBAC',
  '/master-data': 'Master Data & Engineering Configuration',
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, logout, quickDemoLogin, demoAccounts } = useAuth();

  const [backendHealth, setBackendHealth] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const checkHealth = async () => {
    try {
      const data = await api.getHealth();
      setBackendHealth(data);
    } catch (err) {
      setBackendHealth({ status: 'OFFLINE', error: err.message });
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      checkHealth();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false' && (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     import.meta.env.DEV)
  );

  const handleRoleSwitch = async (roleKey) => {
    setUserMenuOpen(false);
    try {
      await quickDemoLogin(roleKey);
    } catch (err) {
      alert(`Switch failed: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const currentTitle = routeNameMap[location.pathname] || 'SunPower Solutions';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="breadcrumbs">
          <Link to="/">SunPower</Link>
          <ChevronRight size={14} />
          <span className="current">{currentTitle}</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Backend Health Badge */}
        {backendHealth && backendHealth.status === 'HEALTHY' ? (
          <div className="status-indicator-badge online" title={`SQLite Connected. ${backendHealth.tables_count} tables initialized.`}>
            <span className="pulse-dot"></span>
            <span>Online · {backendHealth.tables_count} Tables</span>
          </div>
        ) : (
          <div className="status-indicator-badge offline" title="FastAPI backend is offline or unreachable on http://127.0.0.1:8000">
            <span className="pulse-dot"></span>
            <span>Offline</span>
          </div>
        )}

        {/* In-App Notifications Bell (Phase 2 Module 11) */}
        <NotificationsDrawer />

        {/* User Profile Pill & Role Switcher */}
        {user ? (
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.75rem',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#f59e0b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {user.full_name?.charAt(0) || 'U'}
              </div>

              <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                  {user.full_name}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  {user.role}
                </span>
              </div>

              <ChevronDown size={14} style={{ color: '#94a3b8' }} />
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: '260px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  zIndex: 1200,
                  padding: '0.5rem 0',
                }}
              >
                <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Signed in as</div>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{user.email}</strong>
                </div>

                {isDemoMode && (
                  <>
                    <div style={{ padding: '0.5rem 1rem 0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ⚡ Demo Mode Switcher
                      </span>
                      <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Re-authenticates</span>
                    </div>

                    {Object.keys(demoAccounts).map((roleKey) => {
                      const demo = demoAccounts[roleKey];
                      const isCurrent = user.role === roleKey;
                      return (
                        <button
                          key={roleKey}
                          onClick={() => handleRoleSwitch(roleKey)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.45rem 1rem',
                            background: isCurrent ? '#f8fafc' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.78rem',
                            color: isCurrent ? demo.themeColor : '#334155',
                            fontWeight: isCurrent ? 700 : 500,
                          }}
                        >
                          <span>{demo.name} ({demo.role})</span>
                          {isCurrent && <CheckCircle2 size={13} style={{ color: '#10b981' }} />}
                        </button>
                      );
                    })}
                  </>
                )}

                <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      color: '#dc2626',
                      fontWeight: 600,
                    }}
                  >
                    <LogOut size={14} />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">
            <UserIcon size={14} />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
