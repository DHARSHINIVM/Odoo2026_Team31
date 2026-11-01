import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './src/context/AuthContext';
import CustomerDashboard from './src/pages/dashboards/CustomerDashboard';

// Mock localStorage and fetch
global.localStorage = {
  getItem: (k) => {
    if (k === 'sunpower_token') return 'mock_token';
    if (k === 'sunpower_user') return JSON.stringify({
      id: 5,
      full_name: 'Rajesh Sharma',
      email: 'customer@sunpower.com',
      role: 'CUSTOMER'
    });
    return null;
  },
  setItem: () => {},
  removeItem: () => {},
};

// Mock fetch so api calls return real data
const realData = {
  customer: { id: 1, name: 'Rajesh Sharma', city: 'Pune', phone: '+91 98230 11223', consumer_number: 'MSEDCL-PUN-849201' },
  active_project: { order_id: 6, order_number: 'ORD-2026-006', system_capacity_kw: 5.5, grid_type: 'ON_GRID', stage: 'BOM_GENERATED' },
  milestones: [{ step_number: 1, title: 'Survey', is_completed: true }],
  hardware_items: [{ name: 'Panel', category: 'PANEL', is_ready: true, status: 'Allocated' }],
  coordinator: { name: 'Rahul Deshmukh', phone: '+91 98200 22002' },
  passport: { id: 1, passport_number: 'DSP-MH-2026-0081', system_health_score: 98, lifetime_mwh: 187.5 },
  warranties_count: 3,
  open_service_tickets_count: 1,
  unread_notifications_count: 2,
  recent_activity: [{ title: 'Order Confirmed', date: 'Oct 29', desc: 'Order confirmed' }]
};

const mockProjects = [
  { id: 6, order_id: 6, order_number: 'ORD-2026-006', stage: 'BOM_GENERATED', system_capacity_kw: 6.5, address: 'Baner, Pune' },
  { id: 1, order_id: 1, order_number: 'ORD-2026-001', stage: 'COMMISSIONED', system_capacity_kw: 5.5, address: 'Baner, Pune' }
];

const mockApts = [
  { id: 1, appointment_number: 'APT-2026-0001', appointment_type: 'SITE_SURVEY', scheduled_date: '2026-11-04', time_slot: '10:00 - 12:00', status: 'CONFIRMED' }
];

const mockTickets = [
  { id: 1, ticket_number: 'SRV-2026-0001', issue_category: 'GENERAL_MAINTENANCE', description: 'Cleaning check', status: 'OPEN' }
];

const mockFeedbacks = [
  { id: 1, feedback_type: 'PRODUCT', rating: 5, comments: 'Excellent solar output yield!', created_at: '2026-10-31' }
];

global.fetch = async (url) => {
  const urlStr = String(url);
  let resData = {};
  if (urlStr.includes('/customer/dashboard')) resData = realData;
  else if (urlStr.includes('/customer/projects')) resData = mockProjects;
  else if (urlStr.includes('/customer/appointments')) resData = mockApts;
  else if (urlStr.includes('/customer/service-tickets')) resData = mockTickets;
  else if (urlStr.includes('/customer/feedback')) resData = mockFeedbacks;
  else if (urlStr.includes('/auth/me')) resData = { id: 5, full_name: 'Rajesh Sharma', email: 'customer@sunpower.com', role: 'CUSTOMER' };
  else if (urlStr.includes('/auth/permissions')) resData = { permissions: [] };
  else if (urlStr.includes('/health')) resData = { status: 'HEALTHY', tables_count: 35 };

  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => resData,
    text: async () => JSON.stringify(resData)
  };
};

console.log('Testing full page rendering...');
for (const tab of ['lead', 'projects', 'passport', 'feedback']) {
  try {
    const html = renderToString(
      <MemoryRouter initialEntries={[`/dashboard?tab=${tab}`]}>
        <AuthProvider>
          <CustomerDashboard refreshTrigger={0} />
        </AuthProvider>
      </MemoryRouter>
    );
    console.log(`Rendered tab ${tab}: length ${html.length}`);
  } catch (err) {
    console.error(`ERROR rendering tab ${tab}:`, err);
  }
}
