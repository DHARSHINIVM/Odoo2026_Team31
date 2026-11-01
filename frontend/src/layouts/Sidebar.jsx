import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sun,
  LayoutDashboard,
  Users,
  MessageSquarePlus,
  Calendar,
  FileSpreadsheet,
  ShoppingBag,
  ClipboardCheck,
  Eye,
  History,
  Boxes,
  Warehouse,
  Cpu,
  Truck,
  Barcode,
  Wrench,
  CheckCircle2,
  HeadphonesIcon,
  QrCode,
  ShieldCheck,
  BarChart3,
  Award,
  Settings,
  UserCheck,
  FileText,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Exact Module 6 Role-Specific Navigation Definitions
const ROLE_MENUS = {
  SALES_EXECUTIVE: [
    { category: 'Sales & Commercial', items: [
      { name: 'Sales Dashboard', path: '/dashboard/sales', icon: LayoutDashboard },
      { name: 'Customers', path: '/customers', icon: Users },
      { name: 'Enquiries & Leads', path: '/enquiries', icon: MessageSquarePlus },
      { name: 'Appointments', path: '/appointments', icon: Calendar },
      { name: 'Quotations & Pricing', path: '/quotations', icon: FileSpreadsheet },
      { name: 'Confirmed Orders', path: '/orders', icon: ShoppingBag },
    ]},
    { category: 'Project Operations', items: [
      { name: 'BOM & Material Prep', path: '/bom', icon: Boxes },
      { name: 'Installation Progress', path: '/installations', icon: Wrench },
      { name: 'Government Subsidies', path: '/subsidies', icon: Award },
    ]},
    { category: 'Service & Lifecycle', items: [
      { name: 'Personal Tasks', path: '/tasks', icon: CheckSquare },
      { name: 'Digital Solar Passport', path: '/solar-passport', icon: QrCode },
      { name: 'Service Tickets', path: '/service', icon: HeadphonesIcon },
    ]},
  ],

  TECHNICIAN: [
    { category: 'Field Operations', items: [
      { name: 'Technician Dashboard', path: '/dashboard/technician', icon: LayoutDashboard },
      { name: 'Tasks', path: '/tasks', icon: CheckSquare },
      { name: 'Appointments', path: '/appointments', icon: Calendar },
      { name: 'My Surveys', path: '/surveys?tab=mine', icon: ClipboardCheck },
      { name: 'My Installations', path: '/installations?tab=mine', icon: Wrench },
      { name: 'Installation Worksheets', path: '/installations?tab=worksheets', icon: ClipboardCheck },
      { name: 'Schedule & Tasks', path: '/installations?tab=schedule', icon: Calendar },
      { name: 'Service Repairs', path: '/service', icon: HeadphonesIcon },
      { name: 'Completed Work', path: '/installations?tab=completed', icon: CheckCircle2 },
    ]},
  ],

  WAREHOUSE_MANAGER: [
    { category: 'Warehouse & Logistics', items: [
      { name: 'Dashboard', path: '/dashboard/warehouse', icon: LayoutDashboard },
      { name: 'Operational Tasks', path: '/tasks', icon: CheckSquare },
      { name: 'Inventory & Stock', path: '/inventory', icon: Boxes },
      { name: 'Stock Transfers', path: '/inventory?tab=transfers', icon: Truck },
      { name: 'BOM Allocation', path: '/bom', icon: Cpu },
      { name: 'Dispatches', path: '/dispatch', icon: Truck },
      { name: 'Serial Numbers', path: '/dispatch?tab=serials', icon: Barcode },
    ]},
  ],

  CUSTOMER: [
    { category: 'Customer Web Workspace', items: [
      { name: 'Dashboard & Lead Form', path: '/dashboard?tab=lead', icon: LayoutDashboard },
      { name: 'My Subscribed Projects', path: '/dashboard?tab=projects', icon: Boxes },
      { name: 'Digital Passport Scanner', path: '/dashboard?tab=passport', icon: QrCode },
      { name: 'Customer Feedback', path: '/dashboard?tab=feedback', icon: Award },
    ]},
    { category: 'Customer Services', items: [
      { name: 'Service & Maintenance', path: '/service', icon: HeadphonesIcon },
      { name: 'Field Appointments', path: '/appointments', icon: Calendar },
      { name: 'Project Documents', path: '/documents', icon: FileText },
    ]},
  ],

  ADMIN: [
    { category: 'Executive & EPC Management', items: [
      { name: 'Dashboard', path: '/dashboard/admin', icon: LayoutDashboard },
      { name: 'Tasks Monitoring', path: '/tasks', icon: CheckSquare },
      { name: 'Appointments', path: '/appointments', icon: Calendar },
      { name: 'Users & RBAC', path: '/users', icon: UserCheck },
      { name: 'Master Data & Settings', path: '/master-data', icon: Settings },
      { name: 'Customers', path: '/customers', icon: Users },
      { name: 'Enquiries', path: '/enquiries', icon: MessageSquarePlus },
      { name: 'Surveys', path: '/surveys', icon: ClipboardCheck },
      { name: 'Quotations', path: '/quotations', icon: FileSpreadsheet },
      { name: 'Orders', path: '/orders', icon: ShoppingBag },
      { name: 'Inventory', path: '/inventory', icon: Boxes },
      { name: 'Products & BOM', path: '/bom', icon: Cpu },
      { name: 'Dispatches', path: '/dispatch', icon: Truck },
      { name: 'Installations', path: '/installations', icon: Wrench },
      { name: 'PM Surya Ghar', path: '/subsidies', icon: Award },
      { name: 'Passports', path: '/solar-passport', icon: QrCode },
      { name: 'Warranties', path: '/warranties', icon: ShieldCheck },
      { name: 'Warranty & Service', path: '/service', icon: HeadphonesIcon },
      { name: 'Credibility Hub', path: '/credibility-hub', icon: ShieldCheck },
      { name: 'Reports & Analytics', path: '/analytics', icon: BarChart3 },
      { name: 'Audit Trail', path: '/audit-logs', icon: History },
    ]},
  ],
};

// Aliases
ROLE_MENUS.SOLAR_MANAGER = ROLE_MENUS.ADMIN;
ROLE_MENUS.FIELD_TECHNICIAN = ROLE_MENUS.TECHNICIAN;

export default function Sidebar() {
  const { user, role } = useAuth();
  const location = useLocation();

  const currentRole = (role || 'ADMIN').toUpperCase();
  const menuSections = ROLE_MENUS[currentRole] || ROLE_MENUS.ADMIN;

  const isLinkActive = (itemPath) => {
    const [targetPath, targetQuery] = itemPath.split('?');
    
    const pathMatches =
      location.pathname === targetPath ||
      (location.pathname === '/' && targetPath === '/dashboard') ||
      (location.pathname === '/' && targetPath === `/dashboard/${currentRole.toLowerCase().replace('_', '-')}`) ||
      (location.pathname === '/' && currentRole === 'ADMIN' && targetPath === '/dashboard/admin');

    if (!pathMatches) return false;

    if (targetQuery) {
      if (location.search.includes(targetQuery)) return true;
      if (targetQuery === 'tab=lead' && (!location.search || location.search === '' || location.search === '?')) return true;
      return false;
    }

    return !location.search || location.search === '' || location.search === '?';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-icon-wrapper">
          <Sun size={22} />
        </div>
        <div className="brand-text">
          <h1>SunPower</h1>
          <span>Solutions EPC</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuSections.map((section, sIdx) => (
          <div key={sIdx}>
            <div className="nav-category">{section.category}</div>
            {section.items.map((item, iIdx) => {
              const Icon = item.icon;
              const active = isLinkActive(item.path);
              return (
                <Link
                  key={iIdx}
                  to={item.path}
                  className={`nav-link ${active ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.78rem' }}>
            {role || 'Guest'}
          </span>
          <span style={{ fontSize: '0.68rem', background: '#334155', padding: '2px 6px', borderRadius: '4px', color: '#f59e0b', fontWeight: 700 }}>
            RBAC v2
          </span>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
          {user?.name || 'Multi-Role Session'}
        </div>
      </div>
    </aside>
  );
}
