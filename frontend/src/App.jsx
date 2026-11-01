import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';

// Auth & Login Pages (Phase 2 Module 1)
import LoginPage from './pages/login/LoginPage';
import RoleLoginPage from './pages/login/RoleLoginPage';

// Core Pages & Dashboards
import DashboardPage from './pages/DashboardPage';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import SalesDashboard from './pages/dashboards/SalesDashboard';
import WarehouseDashboard from './pages/dashboards/WarehouseDashboard';
import UnifiedTechnicianDashboard from './pages/dashboards/UnifiedTechnicianDashboard';
import StandaloneTechnicianMobilePage from './pages/mobile/StandaloneTechnicianMobilePage';
import StandaloneWarehouseMobilePage from './pages/mobile/StandaloneWarehouseMobilePage';
import StandaloneCustomerMobilePage from './pages/mobile/StandaloneCustomerMobilePage';

import CustomersPage from './pages/CustomersPage';
import EnquiriesPage from './pages/EnquiriesPage';
import SurveysPage from './pages/SurveysPage';
import QuotationsPage from './pages/QuotationsPage';
import OrdersPage from './pages/OrdersPage';
import BomPage from './pages/BomPage';
import InventoryPage from './pages/InventoryPage';
import DispatchPage from './pages/DispatchPage';
import InstallationsPage from './pages/InstallationsPage';
import SolarPassportPage from './pages/SolarPassportPage';
import PublicPassportPage from './pages/PublicPassportPage';
import WarrantiesPage from './pages/WarrantiesPage';
import ServicePage from './pages/ServicePage';
import CredibilityHubPage from './pages/CredibilityHubPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SubsidiesPage from './pages/SubsidiesPage';
import UsersPage from './pages/UsersPage';
import DocumentsPage from './pages/DocumentsPage';
import AuditHistoryPage from './pages/AuditHistoryPage';
import TasksPage from './pages/TasksPage';
import AppointmentsPage from './pages/AppointmentsPage';
import MasterDataPage from './pages/MasterDataPage';

export default function App() {
  const [refreshTrigger] = useState(0);

  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          {/* Public Authentication Portals (7 Roles + Central Hub) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/:roleSlug" element={<RoleLoginPage />} />

          {/* Public Customer Passport & QR Verification Portal */}
          <Route path="/passport" element={<PublicPassportPage />} />
          <Route path="/passport/public" element={<PublicPassportPage />} />
          <Route path="/passport/public/:token" element={<PublicPassportPage />} />
          <Route path="/customer/passport" element={<PublicPassportPage />} />

          {/* Standalone Field Ops Mobile Application (Full-Screen PWA Viewport) */}
          <Route
            path="/mobile/technician"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'TECHNICIAN', 'FIELD_TECHNICIAN']}>
                <StandaloneTechnicianMobilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mobile/warehouse"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'WAREHOUSE_MANAGER']}>
                <StandaloneWarehouseMobilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mobile/customer"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'CUSTOMER']}>
                <StandaloneCustomerMobilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'CUSTOMER']}>
                <StandaloneCustomerMobilePage />
              </ProtectedRoute>
            }
          />

          {/* Authenticated Application Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Dynamic Dashboard matching Authenticated Role */}
            <Route index element={<DashboardPage refreshTrigger={refreshTrigger} />} />
            <Route path="dashboard" element={<DashboardPage refreshTrigger={refreshTrigger} />} />
            <Route
              path="dashboard/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER']}>
                  <AdminDashboard refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/sales"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'SALES_EXECUTIVE']}>
                  <SalesDashboard refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/warehouse"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'WAREHOUSE_MANAGER']}>
                  <WarehouseDashboard refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/technician"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'TECHNICIAN', 'FIELD_TECHNICIAN']}>
                  <UnifiedTechnicianDashboard refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />

            {/* Sales & CRM */}
            <Route
              path="customers"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'SALES_EXECUTIVE']}>
                  <CustomersPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="enquiries"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'SALES_EXECUTIVE']}>
                  <EnquiriesPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="surveys"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'TECHNICIAN', 'FIELD_TECHNICIAN']}>
                  <SurveysPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="quotations"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'SALES_EXECUTIVE']}>
                  <QuotationsPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'SALES_EXECUTIVE']}>
                  <OrdersPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />

            {/* EPC Supply Chain & Operations */}
            <Route
              path="bom"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'WAREHOUSE_MANAGER', 'SALES_EXECUTIVE']}>
                  <BomPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'WAREHOUSE_MANAGER']}>
                  <InventoryPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="dispatch"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'WAREHOUSE_MANAGER', 'TECHNICIAN', 'FIELD_TECHNICIAN']}>
                  <DispatchPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="installations"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'TECHNICIAN', 'FIELD_TECHNICIAN', 'SALES_EXECUTIVE']}>
                  <InstallationsPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />

            {/* Operational Task Manager & Customer Appointments */}
            <Route path="tasks" element={<TasksPage refreshTrigger={refreshTrigger} />} />
            <Route path="appointments" element={<AppointmentsPage refreshTrigger={refreshTrigger} />} />

            {/* Customer Lifecycle & Subsidies */}
            <Route path="subsidies" element={<SubsidiesPage refreshTrigger={refreshTrigger} />} />
            <Route path="solar-passport" element={<SolarPassportPage refreshTrigger={refreshTrigger} />} />
            <Route
              path="warranties"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'TECHNICIAN', 'FIELD_TECHNICIAN', 'SALES_EXECUTIVE', 'CUSTOMER']}>
                  <WarrantiesPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="service"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER', 'TECHNICIAN', 'FIELD_TECHNICIAN', 'SALES_EXECUTIVE', 'CUSTOMER']}>
                  <ServicePage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />

            {/* Intelligence & Administration */}
            <Route path="credibility-hub" element={<CredibilityHubPage refreshTrigger={refreshTrigger} />} />
            <Route
              path="analytics"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER']}>
                  <AnalyticsPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER']}>
                  <UsersPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="documents"
              element={
                <ProtectedRoute allowedRoles={['TECHNICIAN', 'FIELD_TECHNICIAN', 'CUSTOMER']}>
                  <DocumentsPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER']}>
                  <AuditHistoryPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
            <Route
              path="master-data"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SOLAR_MANAGER']}>
                  <MasterDataPage refreshTrigger={refreshTrigger} />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
