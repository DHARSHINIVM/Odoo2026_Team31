// Centralized API Service for SunPower Solutions
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

/**
 * Standard HTTP Request Wrapper using native fetch
 * Automatically attaches Authorization header if sunpower_token exists.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach JWT Bearer Token if present in localStorage
  const token = localStorage.getItem('sunpower_token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (errorData.detail.message) {
            errorMessage = errorData.detail.message;
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Non-JSON response
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error on [${options.method || 'GET'} ${url}]:`, error.message);
    throw error;
  }
}

export const api = {
  // System & Seed
  getHealth: () => request('/health'),
  resetSeedData: () => request('/seed/reset', { method: 'POST' }),

  // Centralized Auth & RBAC (Phase 2 Module 1)
  login: (credentials) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),
  getPermissions: () => request('/auth/permissions'),
  getUsers: (role) => request(`/auth/users${role && role !== 'ALL' ? `?role=${role}` : ''}`),
  createUser: (userData) => request('/auth/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  updateUser: (id, userData) => request(`/auth/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(userData),
  }),
  updateUserCapabilities: (id, capabilities) => request(`/auth/users/${id}/capabilities`, {
    method: 'PATCH',
    body: JSON.stringify({ capabilities }),
  }),
  getUserSessions: (id) => request(`/auth/users/${id}/sessions`),
  revokeUserSessions: (id) => request(`/auth/users/${id}/revoke-sessions`, { method: 'POST' }),
  resetUserPassword: (id, newPassword) => request(`/auth/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  }),
  getRolesPermissions: () => request('/auth/roles-permissions'),
  getTeamByRole: (role) => request(`/auth/team/${role}`),

  // Master Data & System Configuration (Administrator)
  getMasterDataOverview: () => request('/master-data/overview'),
  getMasterPackages: (params = {}) => {
    const query = new URLSearchParams();
    if (params.system_type) query.append('system_type', params.system_type);
    if (params.min_kw) query.append('min_kw', params.min_kw);
    if (params.max_kw) query.append('max_kw', params.max_kw);
    const qs = query.toString();
    return request(`/master-data/packages${qs ? `?${qs}` : ''}`);
  },
  createMasterPackage: (pkgData) => request('/master-data/packages', {
    method: 'POST',
    body: JSON.stringify(pkgData),
  }),
  updateMasterPackage: (id, pkgData) => request(`/master-data/packages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(pkgData),
  }),
  getMasterComponents: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return request(`/master-data/components${qs ? `?${qs}` : ''}`);
  },
  getBomTemplates: () => request('/master-data/bom-templates'),
  updateBomTemplates: (data) => request('/master-data/bom-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getPricingTaxConfig: () => request('/master-data/pricing-tax'),
  updatePricingTaxConfig: (data) => request('/master-data/pricing-tax', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getTechnicalChecklists: () => request('/master-data/checklists'),
  updateTechnicalChecklists: (data) => request('/master-data/checklists', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getCommissioningTests: () => request('/master-data/commissioning-tests'),
  updateCommissioningTests: (data) => request('/master-data/commissioning-tests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getWarrantyTerms: () => request('/master-data/warranty-terms'),
  getSystemConfig: () => request('/master-data/system-config'),
  updateSystemConfig: (data) => request('/master-data/system-config', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 5 Canonical Workspaces & Role Dashboards
  getAdminDashboard: () => request('/dashboard/admin'),
  getSalesDashboard: () => request('/dashboard/sales'),
  getWarehouseDashboard: () => request('/dashboard/warehouse'),
  getTechnicianDashboard: () => request('/dashboard/technician'),
  getUnifiedTechnicianDashboard: () => request('/dashboard/technician'),

  // Generic Dashboard Overview
  getDashboard: () => request('/dashboard'),
  getDashboardSummary: () => request('/dashboard/summary'),

  // Customers
  getCustomers: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.city) query.append('city', params.city);
    if (params.skip) query.append('skip', params.skip);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString();
    return request(`/customers${qs ? `?${qs}` : ''}`);
  },
  getCustomerById: (id) => request(`/customers/${id}`),
  createCustomer: (customerData) => request('/customers', {
    method: 'POST',
    body: JSON.stringify(customerData),
  }),
  updateCustomer: (id, customerData) => request(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(customerData),
  }),
  deleteCustomer: (id) => request(`/customers/${id}`, {
    method: 'DELETE',
  }),

  // Enquiries (Phase 2 Module 3 CRM)
  getEnquiries: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.skip) query.append('skip', params.skip);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString();
    return request(`/enquiries${qs ? `?${qs}` : ''}`);
  },
  getEnquiryById: (id) => request(`/enquiries/${id}`),
  createEnquiry: (enquiryData) => request('/enquiries', {
    method: 'POST',
    body: JSON.stringify(enquiryData),
  }),
  updateEnquiry: (id, enquiryData) => request(`/enquiries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(enquiryData),
  }),

  // Site Surveys (Phase 2 Module 4)
  getSurveys: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.skip) query.append('skip', params.skip);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString();
    return request(`/surveys${qs ? `?${qs}` : ''}`);
  },
  getSurveyById: (id) => request(`/surveys/${id}`),
  createSurvey: (surveyData) => request('/surveys', {
    method: 'POST',
    body: JSON.stringify(surveyData),
  }),
  updateSurvey: (id, surveyData) => request(`/surveys/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(surveyData),
  }),
  assignSurveyTechnician: (id, assignData) => request(`/surveys/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify(assignData),
  }),
  submitSurveyByTechnician: (id, submitData) => request(`/surveys/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(submitData),
  }),
  approveSurvey: (id, reviewData = {}) => request(`/surveys/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify(reviewData),
  }),
  rejectSurvey: (id, reviewData = {}) => request(`/surveys/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(reviewData),
  }),

  // Quotations
  getQuotations: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.customer_id) query.append('customer_id', params.customer_id);
    const qs = query.toString();
    return request(`/quotations${qs ? `?${qs}` : ''}`);
  },
  getQuotationById: (id) => request(`/quotations/${id}`),
  createQuotation: (quoteData) => request('/quotations', {
    method: 'POST',
    body: JSON.stringify(quoteData),
  }),
  acceptQuotation: (id) => request(`/quotations/${id}/accept`, {
    method: 'POST',
  }),

  // Orders
  getOrders: (params = {}) => {
    const query = new URLSearchParams();
    if (params.stage && params.stage !== 'ALL') query.append('stage', params.stage);
    if (params.customer_id) query.append('customer_id', params.customer_id);
    const qs = query.toString();
    return request(`/orders${qs ? `?${qs}` : ''}`);
  },
  getOrderById: (id) => request(`/orders/${id}`),
  createOrder: (orderData) => request('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  }),
  recordPayment: (orderId, paymentData) => request(`/orders/${orderId}/payments`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  }),

  // Product Catalog & Packages
  getProducts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.tier && params.tier !== 'ALL') query.append('tier', params.tier);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  getProduct: (id) => request(`/products/${id}`),
  getProductById: (id) => request(`/products/${id}`),
  createProduct: (compData) => request('/products', {
    method: 'POST',
    body: JSON.stringify(compData),
  }),
  updateProduct: (id, compData) => request(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(compData),
  }),
  getCatalogComponents: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.tier && params.tier !== 'ALL') query.append('tier', params.tier);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  getComponents: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.tier && params.tier !== 'ALL') query.append('tier', params.tier);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  createComponent: (compData) => request('/products', {
    method: 'POST',
    body: JSON.stringify(compData),
  }),
  updateComponent: (id, compData) => request(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(compData),
  }),
  getPackages: () => request('/packages'),
  getPackageById: (id) => request(`/packages/${id}`),
  createPackage: (pkgData) => request('/packages', {
    method: 'POST',
    body: JSON.stringify(pkgData),
  }),

  // Bill of Materials (BOM)
  getOrderBom: (orderId) => request(`/orders/${orderId}/bom`),
  getBOMByOrderId: (orderId) => request(`/orders/${orderId}/bom`),
  generateOrderBom: (orderId) => request(`/orders/${orderId}/generate-bom`, {
    method: 'POST',
  }),
  generateBOMForOrder: (orderId) => request(`/orders/${orderId}/generate-bom`, {
    method: 'POST',
  }),
  allocateOrderBom: (orderId, allocationData = {}) => request(`/orders/${orderId}/allocate-inventory`, {
    method: 'POST',
    body: JSON.stringify(allocationData),
  }),
  allocateBOMInventory: (orderId, allocationData = {}) => request(`/orders/${orderId}/allocate-inventory`, {
    method: 'POST',
    body: JSON.stringify(allocationData),
  }),

  // Multi-Warehouse Inventory
  getWarehouses: () => request('/warehouses'),
  createWarehouse: (warehouseData) => request('/warehouses', {
    method: 'POST',
    body: JSON.stringify(warehouseData),
  }),
  getWarehouseById: (id) => request(`/warehouses/${id}`),
  getInventory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.warehouse_id && params.warehouse_id !== 'ALL') query.append('warehouse_id', params.warehouse_id);
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.low_stock_only) query.append('low_stock_only', 'true');
    const qs = query.toString();
    return request(`/inventory${qs ? `?${qs}` : ''}`);
  },
  getWarehouseInventory: (warehouseId = null) => {
    const query = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    return request(`/inventory${query}`);
  },
  adjustInventory: (payload) => request('/inventory/adjustments', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  receiveGoods: (payload) => request('/inventory/goods-receipt', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  processReturn: (payload) => request('/inventory/returns', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getInventorySerials: (params = {}) => {
    const query = new URLSearchParams();
    if (params.warehouse_id) query.append('warehouse_id', params.warehouse_id);
    if (params.component_id) query.append('component_id', params.component_id);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return request(`/inventory/serials${qs ? `?${qs}` : ''}`);
  },
  releaseOrderReservation: (payload) => request('/inventory/reservations/release', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getInventoryMovements: (limit = 50) => request(`/inventory/movements?limit=${limit}`),
  simulateOrderAllocation: (orderId, warehouseId = null) => {
    const query = warehouseId ? `?preferred_warehouse_id=${warehouseId}` : '';
    return request(`/orders/${orderId}/allocation-simulation${query}`);
  },
  allocateOrderInventory: (orderId, payload = {}) => request(`/orders/${orderId}/allocate-inventory`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  transferStock: (transferData) => request('/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify(transferData),
  }),
  getGoodsReceipts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.warehouse_id) query.append('warehouse_id', params.warehouse_id);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString();
    return request(`/inventory/goods-receipts${qs ? `?${qs}` : ''}`);
  },
  getInventoryReservations: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status_filter', params.status);
    if (params.order_id) query.append('order_id', params.order_id);
    if (params.warehouse_id) query.append('warehouse_id', params.warehouse_id);
    const qs = query.toString();
    return request(`/inventory/reservations${qs ? `?${qs}` : ''}`);
  },
  getInventoryReturns: (params = {}) => {
    const query = new URLSearchParams();
    if (params.return_type) query.append('return_type', params.return_type);
    if (params.warehouse_id) query.append('warehouse_id', params.warehouse_id);
    const qs = query.toString();
    return request(`/inventory/returns${qs ? `?${qs}` : ''}`);
  },
  getInventoryAlerts: (warehouseId = null) => {
    const query = warehouseId && warehouseId !== 'ALL' ? `?warehouse_id=${warehouseId}` : '';
    return request(`/inventory/alerts${query}`);
  },
  registerWarehouseDevice: (payload) => request('/inventory/device-registration', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Dispatches & Serial Numbers
  getDispatches: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.order_id) query.append('order_id', params.order_id);
    const qs = query.toString();
    return request(`/dispatches${qs ? `?${qs}` : ''}`);
  },
  getDispatchById: (id) => request(`/dispatches/${id}`),
  createDispatch: (dispatchData) => request('/dispatches', {
    method: 'POST',
    body: JSON.stringify(dispatchData),
  }),
  validateSerial: (serialData) => request('/dispatches/validate-serial', {
    method: 'POST',
    body: JSON.stringify(serialData),
  }),
  confirmDispatchWithPassport: (payload) => request('/dispatches/confirm-with-passport', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  markDispatchDelivered: (id) => request(`/dispatches/${id}/deliver`, {
    method: 'PATCH',
  }),
  cancelDispatch: (id) => request(`/dispatches/${id}/cancel`, {
    method: 'POST',
  }),
  updateDispatchDelivery: (id, deliveryData) => request(`/dispatches/${id}/delivery`, {
    method: 'PATCH',
    body: JSON.stringify(deliveryData),
  }),
  getSerializedItems: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.warehouse_id) query.append('warehouse_id', params.warehouse_id);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return request(`/inventory/serials${qs ? `?${qs}` : ''}`);
  },
  getSerialNumbers: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.warehouse_id) query.append('warehouse_id', params.warehouse_id);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return request(`/inventory/serials${qs ? `?${qs}` : ''}`);
  },
  registerSerialNumber: (serialData) => request('/inventory/serials/register', {
    method: 'POST',
    body: JSON.stringify(serialData),
  }),
  updateSerialStatus: (id, updateData) => request(`/inventory/serials/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(updateData),
  }),
  captureSerialNumber: (serialData) => request('/dispatches/serials/capture', {
    method: 'POST',
    body: JSON.stringify(serialData),
  }),

  // Installations & Digital Commissioning Worksheets (Phase 2 Module 6)
  getInstallations: (params = {}) => {
    const query = new URLSearchParams();
    if (params.order_id) query.append('order_id', params.order_id);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    const qs = query.toString();
    return request(`/installations${qs ? `?${qs}` : ''}`);
  },
  getInstallationById: (id) => request(`/installations/${id}`),
  getInstallationComponents: (id) => request(`/installations/${id}/components`),
  verifyInstallationComponent: (id, serial_number) => request(`/installations/${id}/verify-component`, {
    method: 'POST',
    body: JSON.stringify({ serial_number }),
  }),
  createInstallation: (instData) => request('/installations', {
    method: 'POST',
    body: JSON.stringify(instData),
  }),
  updateInstallationChecklist: (id, checklistData) => request(`/installations/${id}/checklist`, {
    method: 'PATCH',
    body: JSON.stringify(checklistData),
  }),
  updateInstallationStage: (id, stageData) => request(`/installations/${id}/stage`, {
    method: 'PATCH',
    body: JSON.stringify(stageData),
  }),
  uploadInstallationEvidence: (id, formData) => request(`/installations/${id}/upload-evidence`, {
    method: 'POST',
    body: formData,
  }),
  commissionInstallation: (id, commissionData = {}) => request(`/installations/${id}/commission`, {
    method: 'POST',
    body: JSON.stringify(commissionData),
  }),
  assignInstallationTeam: (id, assignData) => request(`/installations/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify(assignData),
  }),

  // Warranties & Policies (Phase 2 Module 7)
  getWarrantyPolicies: () => request('/warranties/policies'),
  getAllWarranties: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status_filter', params.status);
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    if (params.expiring_days_threshold) query.append('expiring_days_threshold', params.expiring_days_threshold);
    const qs = query.toString();
    return request(`/warranties${qs ? `?${qs}` : ''}`);
  },
  getWarrantyBySerial: (serialNumber) => request(`/warranties/${encodeURIComponent(serialNumber)}`),
  checkWarranty: (serialNumber) => request(`/warranties/check/${encodeURIComponent(serialNumber)}`),
  replaceWarrantyComponent: (payload) => request('/warranties/replace', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Digital Solar Passport
  getPassports: (q = '') => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return request(`/passports${qs}`);
  },
  getOrderPassport: (orderId) => request(`/passports/${orderId}`),
  getPassportById: (id) => request(`/passports/detail/${id}`),
  getPublicPassport: (token) => request(`/passports/public/${token}`),

  // Service Management & O&M (Phase 2 Module 8)
  getServiceTickets: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.priority && params.priority !== 'ALL') query.append('priority', params.priority);
    if (params.customer_id) query.append('customer_id', params.customer_id);
    if (params.is_warranty_covered !== undefined && params.is_warranty_covered !== null) {
      query.append('is_warranty_covered', params.is_warranty_covered);
    }
    if (params.q) query.append('q', params.q);
    const qs = query.toString();
    return request(`/service/tickets${qs ? `?${qs}` : ''}`);
  },
  createServiceTicket: (ticketData) => request('/service/tickets', {
    method: 'POST',
    body: JSON.stringify(ticketData),
  }),
  getServiceTicketById: (id) => request(`/service/tickets/${id}`),
  updateServiceTicket: (id, ticketData) => request(`/service/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(ticketData),
  }),
  assignServiceTechnician: (id, assignData) => request(`/service/tickets/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify(assignData),
  }),
  submitCustomerComplaint: (complaintData) => request('/service/tickets/customer-complaint', {
    method: 'POST',
    body: JSON.stringify(complaintData),
  }),
  getTicketsByPassportToken: (token) => request(`/service/tickets/by-token/${encodeURIComponent(token)}`),

  // Project Financials, Payments & Expenses (Feature 4)
  getOrderFinancials: (orderId) => request(`/orders/${orderId}/financials`),
  recordOrderPayment: (orderId, paymentData) => request(`/orders/${orderId}/payments`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  }),
  getOrderPayments: (orderId) => request(`/orders/${orderId}/payments`),
  recordOrderExpense: (orderId, expenseData) => request(`/orders/${orderId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(expenseData),
  }),
  getOrderExpenses: (orderId) => request(`/orders/${orderId}/expenses`),

  // Multi-Warehouse Inventory Transfers (Feature 5)
  getInventoryTransfers: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status_filter', params.status);
    if (params.warehouse_id) query.append('warehouse_id', params.warehouse_id);
    if (params.component_id) query.append('component_id', params.component_id);
    const qs = query.toString();
    return request(`/inventory/transfers${qs ? `?${qs}` : ''}`);
  },
  createInventoryTransfer: (transferData) => request('/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify(transferData),
  }),
  approveInventoryTransfer: (id) => request(`/inventory/transfers/${id}/approve`, {
    method: 'PATCH',
  }),
  dispatchInventoryTransfer: (id) => request(`/inventory/transfers/${id}/dispatch`, {
    method: 'PATCH',
  }),
  receiveInventoryTransfer: (id) => request(`/inventory/transfers/${id}/receive`, {
    method: 'PATCH',
  }),
  cancelInventoryTransfer: (id) => request(`/inventory/transfers/${id}/cancel`, {
    method: 'PATCH',
  }),
  getInventoryTransferById: (id) => request(`/inventory/transfers/${id}`),

  // Subsidies (Phase 2 Module 9 PM Surya Ghar)
  getSubsidies: (status = null) => {
    const query = status && status !== 'ALL' ? `?status_filter=${status}` : '';
    return request(`/subsidies${query}`);
  },
  createSubsidy: (subsidyData) => request('/subsidies', {
    method: 'POST',
    body: JSON.stringify(subsidyData),
  }),
  updateSubsidyStatus: (id, updateData) => request(`/subsidies/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(updateData),
  }),

  // Installation-Level Profitability (Phase 2 Module 10)
  getInstallationsProfitability: () => request('/analytics/installations/profitability'),

  // Notifications (Phase 2 Module 11)
  getNotifications: (unreadOnly = false) => {
    const query = unreadOnly ? '?unread_only=true' : '';
    return request(`/notifications${query}`);
  },
  markNotificationRead: (id) => request(`/notifications/${id}/read`, {
    method: 'PATCH',
  }),
  markAllNotificationsRead: () => request('/notifications/read-all', {
    method: 'POST',
  }),

  // Component Credibility Hub
  getCredibilityEvaluations: (category = null) => {
    const query = category && category !== 'ALL' ? `?category=${category}` : '';
    return request(`/credibility${query}`);
  },
  getComponentCredibility: (id) => request(`/credibility/${id}`),
  updateComponentQuality: (id, payload) => request(`/credibility/components/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  simulateCredibility: (payload) => request('/credibility/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Financial & Operational Analytics & Reports (Phase 2 Features 9 & 10)
  getFinancialAnalytics: () => request('/analytics/financial'),
  getOperationalAnalytics: () => request('/analytics/operational'),
  getOperationalReport: () => request('/analytics/reports/operational'),
  getFinancialReport: (params = {}) => {
    const query = new URLSearchParams();
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.customer_id) query.append('customer_id', params.customer_id);
    const qs = query.toString();
    return request(`/analytics/reports/financial${qs ? `?${qs}` : ''}`);
  },
  getComponentQualityReport: (category = null) => {
    const query = category && category !== 'ALL' ? `?category=${category}` : '';
    return request(`/analytics/reports/components${query}`);
  },
  getReportCsvUrl: (reportType = 'financial') => `${API_BASE_URL}/analytics/export/csv?report_type=${reportType}`,

  // Document Management (Phase 2 Feature 6)
  getDocuments: (params = {}) => {
    const query = new URLSearchParams();
    if (params.entity_type && params.entity_type !== 'ALL') query.append('entity_type', params.entity_type);
    if (params.entity_id) query.append('entity_id', params.entity_id);
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    if (params.include_archived) query.append('include_archived', 'true');
    if (params.skip) query.append('skip', params.skip);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString();
    return request(`/documents${qs ? `?${qs}` : ''}`);
  },
  uploadDocument: (formData) => request('/documents/upload', {
    method: 'POST',
    body: formData,
  }),
  getDocumentById: (id) => request(`/documents/${id}`),
  deleteDocument: (id, permanent = false, userName = 'Staff') => {
    return request(`/documents/${id}?permanent=${permanent}&user_name=${encodeURIComponent(userName)}`, {
      method: 'DELETE',
    });
  },

  // Audit History (Phase 2 Feature 8)
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.entity_type && params.entity_type !== 'ALL') query.append('entity_type', params.entity_type);
    if (params.entity_id) query.append('entity_id', params.entity_id);
    if (params.entity_identifier) query.append('entity_identifier', params.entity_identifier);
    if (params.action && params.action !== 'ALL') query.append('action', params.action);
    if (params.user_id) query.append('user_id', params.user_id);
    if (params.search) query.append('search', params.search);
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.skip !== undefined) query.append('skip', params.skip);
    if (params.limit !== undefined) query.append('limit', params.limit);
    const qs = query.toString();
    return request(`/audit-logs${qs ? `?${qs}` : ''}`);
  },
  getEntityAuditTrail: (entityType, entityId) => request(`/audit-logs/entity/${entityType}/${entityId}`),

  // Personal Task Management (Master Platform)
  getTasks: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status_filter', params.status);
    if (params.priority && params.priority !== 'ALL') query.append('priority', params.priority);
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.assigned_to_me) query.append('assigned_to_me', 'true');
    if (params.overdue_only) query.append('overdue_only', 'true');
    const qs = query.toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  getTaskSummary: () => request('/tasks/summary'),
  createTask: (taskData) => request('/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  }),
  getTaskById: (id) => request(`/tasks/${id}`),
  updateTask: (id, taskData) => request(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(taskData),
  }),
  addTaskComment: (id, comment) => request(`/tasks/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  }),

  // Customer Appointment Booking & Scheduling (Master Platform)
  getAppointments: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status_filter', params.status);
    if (params.appointment_type && params.appointment_type !== 'ALL') query.append('appointment_type', params.appointment_type);
    if (params.customer_id) query.append('customer_id', params.customer_id);
    if (params.assigned_tech_id) query.append('assigned_tech_id', params.assigned_tech_id);
    const qs = query.toString();
    return request(`/appointments${qs ? `?${qs}` : ''}`);
  },
  getAppointmentAvailability: (params = {}) => {
    const query = new URLSearchParams();
    if (params.target_date) query.append('target_date', params.target_date);
    if (params.appointment_type) query.append('appointment_type', params.appointment_type);
    if (params.technician_id) query.append('technician_id', params.technician_id);
    if (params.days_ahead) query.append('days_ahead', params.days_ahead);
    const qs = query.toString();
    return request(`/appointments/availability${qs ? `?${qs}` : ''}`);
  },
  bookAppointment: (appointmentData) => request('/appointments', {
    method: 'POST',
    body: JSON.stringify(appointmentData),
  }),
  getAppointmentById: (id) => request(`/appointments/${id}`),
  rescheduleAppointment: (id, rescheduleData) => request(`/appointments/${id}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(rescheduleData),
  }),
  cancelAppointment: (id, cancellationData) => request(`/appointments/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify(cancellationData),
  }),
  assignAppointmentTechnician: (id, technicianId) => request(`/appointments/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ technician_id: technicianId }),
  }),

  // Customer Portal & Mobile Application (Customer Role)
  getCustomerProfile: () => request('/customer/profile'),
  updateCustomerProfile: (data) => request('/customer/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  getCustomerDashboard: () => request('/customer/dashboard'),
  submitInstallationRequest: (data) => request('/customer/installation-request', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getCustomerInstallationRequests: () => request('/customer/installation-requests'),
  getCustomerProjects: () => request('/customer/projects'),
  getCustomerProjectDetails: (id) => request(`/customer/projects/${id}`),
  getCustomerAppointments: () => request('/customer/appointments'),
  bookCustomerAppointment: (data) => request('/customer/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  rescheduleCustomerAppointment: (id, data) => request(`/customer/appointments/${id}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  cancelCustomerAppointment: (id, data) => request(`/customer/appointments/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  getCustomerPassport: (orderId) => request(`/customer/passport${orderId ? `?order_id=${orderId}` : ''}`),
  verifyCustomerPassportQr: (token) => request(`/customer/passport/verify-qr/${token}`),
  acknowledgeCustomerPassport: (data) => request('/customer/passport/acknowledge', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getCustomerWarranties: () => request('/customer/warranties'),
  getCustomerServiceTickets: () => request('/customer/service-tickets'),
  createCustomerServiceTicket: (data) => request('/customer/service-tickets', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  uploadComplaintEvidence: (ticketId, formData) => request(`/customer/service-tickets/${ticketId}/upload-evidence`, {
    method: 'POST',
    body: formData,
  }),
  getCustomerFeedback: () => request('/customer/feedback'),
  submitCustomerFeedback: (data) => request('/customer/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getCustomerNotifications: () => request('/customer/notifications'),
  markCustomerNotificationRead: (id) => request(`/customer/notifications/${id}/read`, {
    method: 'PATCH',
  }),
  markAllCustomerNotificationsRead: () => request('/customer/notifications/mark-all-read', {
    method: 'POST',
  }),
  registerCustomer: (data) => request('/customer/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  forgotCustomerPassword: (data) => request('/customer/forgot-password', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  resetCustomerPassword: (data) => request('/customer/reset-password', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};
