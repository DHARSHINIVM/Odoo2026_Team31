import React from 'react';
import { useAuth } from '../context/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import SalesDashboard from './dashboards/SalesDashboard';
import WarehouseDashboard from './dashboards/WarehouseDashboard';
import UnifiedTechnicianDashboard from './dashboards/UnifiedTechnicianDashboard';
import CustomerDashboard from './dashboards/CustomerDashboard';

export default function DashboardPage({ refreshTrigger }) {
  const { user, role } = useAuth();

  // Authoritative authenticated role from server
  const activeRole = (user?.role || role || 'ADMIN').toUpperCase();

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
        return <CustomerDashboard refreshTrigger={refreshTrigger} />;
      case 'ADMIN':
      case 'SOLAR_MANAGER':
      default:
        return <AdminDashboard refreshTrigger={refreshTrigger} />;
    }
  };

  return (
    <div>
      {renderDashboard()}
    </div>
  );
}
