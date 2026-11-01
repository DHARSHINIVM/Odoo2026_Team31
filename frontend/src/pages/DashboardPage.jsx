import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import SalesDashboard from './dashboards/SalesDashboard';
import WarehouseDashboard from './dashboards/WarehouseDashboard';
import UnifiedTechnicianDashboard from './dashboards/UnifiedTechnicianDashboard';
import StandaloneCustomerMobilePage from './mobile/StandaloneCustomerMobilePage';
import { Shield, Briefcase, Wrench, Package, Sun, RefreshCw, CheckCircle2, Lock } from 'lucide-react';
import PublicPassportPage from './PublicPassportPage';

const ROLES = [
  { key: 'ADMIN', label: '1. Administrator', icon: Shield, color: '#d97706' },
  { key: 'SALES_EXECUTIVE', label: '2. Sales Executive', icon: Briefcase, color: '#059669' },
  { key: 'TECHNICIAN', label: '3. Technician', icon: Wrench, color: '#0284c7' },
  { key: 'WAREHOUSE_MANAGER', label: '4. Warehouse Manager', icon: Package, color: '#ca8a04' },
  { key: 'CUSTOMER', label: '5. Customer', icon: Sun, color: '#006c36' },
];

export default function DashboardPage({ refreshTrigger }) {
  const { user, role, quickDemoLogin } = useAuth();
  const [switchingRole, setSwitchingRole] = useState(null);

  const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false' && (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     import.meta.env.DEV)
  );

  // Authoritative authenticated role from server
  const activeRole = (user?.role || role || 'ADMIN').toUpperCase();

  const handleAuthenticatedDemoSwitch = async (targetRoleKey) => {
    if (targetRoleKey === activeRole || switchingRole) return;
    setSwitchingRole(targetRoleKey);
    try {
      // Executes full transition: invalidate session -> authenticate via /api/auth/login -> verify /api/auth/me
      await quickDemoLogin(targetRoleKey);
    } catch (err) {
      alert(`Demo transition failed: ${err.message}`);
    } finally {
      setSwitchingRole(null);
    }
  };

  const renderDashboard = () => {
    switch (activeRole) {
      case 'SALES_EXECUTIVE':
        return <SalesDashboard refreshTrigger={refreshTrigger} />;
      case 'TECHNICIAN':
      case 'FIELD_TECHNICIAN':
        return <UnifiedTechnicianDashboard refreshTrigger={refreshTrigger} />;
      case 'WAREHOUSE_MANAGER':
        return <WarehouseDashboard refreshTrigger={refreshTrigger} />;
      case 'CUSTOMER':
        return <StandaloneCustomerMobilePage />;
      case 'ADMIN':
      case 'SOLAR_MANAGER':
      default:
        return <AdminDashboard refreshTrigger={refreshTrigger} />;
    }
  };

  const currentRoleConfig = ROLES.find((r) => r.key === activeRole) || ROLES[0];
  const CurrentIcon = currentRoleConfig.icon;

  return (
    <div>
      {/* Authenticated Role Status & Demo Transition Bar */}
      {isDemoMode ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '0.65rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', overflowX: 'auto', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: '6px', background: `${currentRoleConfig.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CurrentIcon size={16} style={{ color: currentRoleConfig.color }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ⚡ Demo Mode
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>·</span>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#0f172a' }}>
                  {user?.full_name || 'Staff User'} ({activeRole})
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                Switching roles executes genuine backend token authentication.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'nowrap', alignItems: 'center' }}>
            {ROLES.map((r) => {
              const Icon = r.icon;
              const isCurrent = activeRole === r.key;
              const isTargetSwitching = switchingRole === r.key;

              return (
                <button
                  key={r.key}
                  onClick={() => handleAuthenticatedDemoSwitch(r.key)}
                  disabled={isCurrent || !!switchingRole}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: isCurrent ? 700 : 500,
                    background: isCurrent ? `${r.color}15` : '#f8fafc',
                    color: isCurrent ? r.color : '#64748b',
                    border: isCurrent ? `1.5px solid ${r.color}` : '1px solid #e2e8f0',
                    cursor: isCurrent || switchingRole ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: switchingRole && !isTargetSwitching && !isCurrent ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                  title={isCurrent ? 'Currently authenticated' : `Authenticate as demo ${r.label}`}
                >
                  {isTargetSwitching ? (
                    <RefreshCw size={13} className="loading-spinner" style={{ color: r.color }} />
                  ) : (
                    <Icon size={13} style={{ color: isCurrent ? r.color : '#94a3b8' }} />
                  )}
                  <span>{r.label}</span>
                  {isCurrent && (
                    <CheckCircle2 size={12} style={{ color: '#10b981' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Production Mode: Security Banner confirming authenticated server role */
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={15} style={{ color: '#059669' }} />
            <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 500 }}>
              Authenticated Workspace: <strong>{currentRoleConfig.label}</strong> ({user?.email})
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
            Role-Based Authorization Enforced
          </span>
        </div>
      )}

      {/* Render the Authoritative Authenticated Dashboard */}
      {renderDashboard()}
    </div>
  );
}
