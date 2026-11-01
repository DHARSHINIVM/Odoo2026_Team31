import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, UserPlus, Shield, CheckCircle2, XCircle,
  Key, RefreshCw, Mail, Briefcase, Sliders, Check,
  Edit2, LogOut, Search, Clock, Laptop, AlertTriangle
} from 'lucide-react';

const APPROVED_FIVE_ROLES = [
  { id: 'ADMIN', label: 'Administrator', desc: 'System configuration, user security, and executive oversight' },
  { id: 'SALES_EXECUTIVE', label: 'Sales Executive', desc: 'Customer CRM, enquiries, quotations, orders, and subsidies' },
  { id: 'TECHNICIAN', label: 'Technician', desc: 'Unified identity for roof surveys, installation & electrical testing, service maintenance' },
  { id: 'WAREHOUSE_MANAGER', label: 'Warehouse Manager', desc: 'Depot stock, BOM allocations, serial scanning & dispatch' },
  { id: 'CUSTOMER', label: 'Customer', desc: 'Solar Passport portal, system generation & service ticketing' },
];

const ALL_ROLES = [
  'ALL',
  'ADMIN',
  'SALES_EXECUTIVE',
  'TECHNICIAN',
  'WAREHOUSE_MANAGER',
  'CUSTOMER',
];

const CAPABILITY_DEFINITIONS = {
  SALES_EXECUTIVE: [
    { id: 'can_approve_quotation', label: 'Quotation Self-Approval', desc: 'Authorize quotations directly without survey manager sign-off' },
    { id: 'can_apply_special_discount', label: 'Commercial Discount Authority', desc: 'Apply up to 10% commercial discount on standard packages' },
    { id: 'can_override_survey', label: 'Fast-Track Survey Override', desc: 'Generate binding quote prior to physical site survey visit' },
  ],
  FIELD_TECHNICIAN: [
    { id: 'SURVEY_EXECUTION', label: 'Site Survey Execution', desc: 'Perform roof measurement, structural check & shadow analysis' },
    { id: 'INSTALLATION_EXECUTION', label: 'Installation Execution', desc: 'Lead mechanical mounting and solar array setup' },
    { id: 'ELECTRICAL_TESTING', label: 'Electrical Testing', desc: 'VOC, ISC, insulation resistance & earthing pit testing' },
    { id: 'CAMERA_CAPTURE', label: 'Evidence Capture', desc: 'Upload mandatory site photographs and quality worksheets' },
    { id: 'COMPONENT_VERIFICATION', label: 'Component Verification', desc: 'Scan barcode serials and verify against BOM' },
    { id: 'PASSPORT_UPDATES', label: 'Digital Passport Updates', desc: 'Sign off milestone lifecycle events on central passport' },
    { id: 'CUSTOMER_ACK', label: 'Customer Handover Sign-off', desc: 'Capture customer acknowledgement and completion signature' },
  ],
  WAREHOUSE_MANAGER: [
    { id: 'inventory:force_stock_adjustment', label: 'Manual Stock Adjustment', desc: 'Reconcile stock physical counts against depot records' },
    { id: 'dispatch:bypass_serial_scan', label: 'Emergency Dispatch Override', desc: 'Authorize urgent material dispatches with deferred scanning' },
  ],
  ADMIN: [
    { id: 'MANAGE_USERS', label: 'User & RBAC Administration', desc: 'Create, modify, and deactivate system accounts' },
    { id: 'MANAGE_MASTER_DATA', label: 'Master Data Management', desc: 'Configure solar packages, components, BOMs, and pricing' },
    { id: 'FINANCIAL_OVERSIGHT', label: 'Financial Verification', desc: 'Verify customer payments and view financial summaries' },
  ]
};

export default function UsersPage({ refreshTrigger }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    username: '',
    email: '',
    password: 'Password@123',
    full_name: '',
    role: 'SALES_EXECUTIVE',
    department: 'Sales',
    designation: 'Solar Sales Specialist',
  });
  const [creating, setCreating] = useState(false);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    role: '',
    department: '',
    designation: '',
  });
  const [updating, setUpdating] = useState(false);

  // Reset Password Modal
  const [resettingUser, setResettingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('Password@123');
  const [savingPassword, setSavingPassword] = useState(false);

  // Sessions Modal
  const [sessionUser, setSessionUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  // Capability Configuration Modal
  const [selectedUserForCaps, setSelectedUserForCaps] = useState(null);
  const [userCaps, setUserCaps] = useState([]);
  const [savingCaps, setSavingCaps] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getUsers(roleFilter);
      setUsers(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, refreshTrigger]);

  // Edit User Handlers
  const openEditModal = (u) => {
    setEditingUser(u);
    setEditFormData({
      full_name: u.full_name || '',
      email: u.email || '',
      role: u.role || 'SALES_EXECUTIVE',
      department: u.department || 'Operations',
      designation: u.designation || 'Specialist',
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdating(true);
    try {
      await api.updateUser(editingUser.id, editFormData);
      alert(`User ${editFormData.full_name} updated successfully!`);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Password Reset Handlers
  const openResetPasswordModal = (u) => {
    setResettingUser(u);
    setNewPassword('Password@123');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resettingUser) return;
    setSavingPassword(true);
    try {
      await api.resetUserPassword(resettingUser.id, newPassword);
      alert(`Password reset successfully for ${resettingUser.full_name}. Active sessions invalidated.`);
      setResettingUser(null);
    } catch (err) {
      alert(`Password reset failed: ${err.message}`);
    } finally {
      setSavingPassword(false);
    }
  };

  // Sessions Handlers
  const openSessionsModal = async (u) => {
    setSessionUser(u);
    setLoadingSessions(true);
    try {
      const data = await api.getUserSessions(u.id);
      setSessions(data);
    } catch (err) {
      alert(`Failed to load sessions: ${err.message}`);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!sessionUser) return;
    setRevokingSessions(true);
    try {
      const res = await api.revokeUserSessions(sessionUser.id);
      alert(res.message);
      // Reload sessions
      const data = await api.getUserSessions(sessionUser.id);
      setSessions(data);
    } catch (err) {
      alert(`Revoke failed: ${err.message}`);
    } finally {
      setRevokingSessions(false);
    }
  };

  // Capability Handlers
  const openCapabilityModal = (u) => {
    setSelectedUserForCaps(u);
    setUserCaps(u.capabilities || []);
  };

  const toggleCap = (capId) => {
    if (userCaps.includes(capId)) {
      setUserCaps(userCaps.filter((c) => c !== capId));
    } else {
      setUserCaps([...userCaps, capId]);
    }
  };

  const handleSaveCapabilities = async () => {
    if (!selectedUserForCaps) return;
    setSavingCaps(true);
    try {
      await api.updateUserCapabilities(selectedUserForCaps.id, userCaps);
      alert('Capabilities and permissions updated successfully!');
      setSelectedUserForCaps(null);
      loadUsers();
    } catch (err) {
      alert(`Failed to update capabilities: ${err.message}`);
    } finally {
      setSavingCaps(false);
    }
  };

  const handleToggleActive = async (user) => {
    if (user.id === currentUser?.id) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      await loadUsers();
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createUser(createFormData);
      alert(`User ${createFormData.full_name} (${createFormData.role}) created successfully!`);
      setShowCreateModal(false);
      setCreateFormData({
        username: '',
        email: '',
        password: 'Password@123',
        full_name: '',
        role: 'SALES_EXECUTIVE',
        department: 'Sales',
        designation: 'Solar Sales Specialist',
      });
      await loadUsers();
    } catch (err) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Filtered list by search
  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Enterprise Staff, RBAC & Session Management"
        subtitle="Manage verified user accounts across the five primary solar business roles with active session oversight"
        action={
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <UserPlus size={16} />
            <span>Add Staff Member</span>
          </button>
        }
      />

      {/* Role Filter & Search Bar */}
      <div className="card" style={{ padding: '0.9rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginRight: '0.25rem' }}>
            ROLES:
          </span>
          {ALL_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem' }}
            >
              {r.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '0.45rem 0.6rem 0.45rem 2rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '180px' }}
            />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadUsers} title="Reload users">
            <RefreshCw size={14} className={loading ? 'loading-spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Users Directory Table */}
      <div className="card" style={{ padding: '1.5rem' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            Loading employee directory...
          </div>
        ) : error ? (
          <div style={{ padding: '1.5rem', color: '#dc2626', background: '#fef2f2', borderRadius: '8px' }}>
            {error}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Username / Email</th>
                  <th>Department & Designation</th>
                  <th>Role</th>
                  <th>Granular Capabilities</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{u.full_name}</strong>
                      {u.id === currentUser?.id && (
                        <span style={{ fontSize: '0.68rem', color: '#059669', marginLeft: '6px', fontWeight: 700, background: '#ecfdf5', padding: '1px 5px', borderRadius: '4px' }}>
                          You
                        </span>
                      )}
                    </td>
                    <td>
                      <div>
                        <span style={{ color: '#334155', fontWeight: 600 }}>{u.username}</span>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{u.email}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: '#334155' }}>{u.department || 'Operations'}</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{u.designation || 'Specialist'}</span>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : u.role.includes('TECH') ? 'badge-warning' : 'badge-primary'}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '280px' }}>
                        {u.capabilities && u.capabilities.length > 0 ? (
                          u.capabilities.map((c) => (
                            <span
                              key={c}
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                background: c.includes('SURVEY') ? '#eff6ff' : c.includes('INSTALLATION') ? '#ecfdf5' : c.includes('can_') ? '#fef3c7' : '#f8fafc',
                                color: c.includes('SURVEY') ? '#1d4ed8' : c.includes('INSTALLATION') ? '#047857' : c.includes('can_') ? '#b45309' : '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontWeight: 500
                              }}
                            >
                              {c.replace('_', ' ')}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Standard Role Defaults</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                        {/* Edit User Button */}
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem' }}
                          onClick={() => openEditModal(u)}
                          title="Edit profile & role"
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>

                        {/* Reset Password Button */}
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem' }}
                          onClick={() => openResetPasswordModal(u)}
                          title="Reset employee password"
                        >
                          <Key size={12} />
                        </button>

                        {/* Sessions Viewer Button */}
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem' }}
                          onClick={() => openSessionsModal(u)}
                          title="View active sessions & token status"
                        >
                          <Laptop size={12} />
                        </button>

                        {/* Configure Capabilities & Approvals */}
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem' }}
                          onClick={() => openCapabilityModal(u)}
                          title="Configure granular permissions and approval capabilities"
                        >
                          <Sliders size={12} />
                          <span>Perms</span>
                        </button>

                        {/* Toggle Active Button */}
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ fontSize: '0.72rem', padding: '0.25rem 0.45rem' }}
                          onClick={() => handleToggleActive(u)}
                          disabled={u.id === currentUser?.id}
                          title={u.id === currentUser?.id ? 'Cannot deactivate self' : u.is_active ? 'Deactivate account' : 'Activate account'}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Modal 1: Create New Staff Member                              */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              Create New Staff Member Account
            </h3>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={createFormData.full_name}
                    onChange={(e) => setCreateFormData({ ...createFormData, full_name: e.target.value })}
                    placeholder="e.g. Rahul Patil"
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={createFormData.username}
                    onChange={(e) => setCreateFormData({ ...createFormData, username: e.target.value })}
                    placeholder="e.g. rahulpatil"
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    placeholder="rahul@sunpower.com"
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Approved Enterprise Role
                </label>
                <select
                  value={createFormData.role}
                  onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  {APPROVED_FIVE_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.label} ({r.id})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={createFormData.department}
                    onChange={(e) => setCreateFormData({ ...createFormData, department: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Designation
                  </label>
                  <input
                    type="text"
                    value={createFormData.designation}
                    onChange={(e) => setCreateFormData({ ...createFormData, designation: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 2: Edit Staff Profile & Role                             */}
      {/* ------------------------------------------------------------- */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', color: '#0f172a' }}>
              Edit Account: {editingUser.full_name} ({editingUser.username})
            </h3>

            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Assigned Role
                </label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  {APPROVED_FIVE_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.label} ({r.id})</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.72rem', color: '#ea580c', display: 'block', marginTop: '4px' }}>
                  Note: Changing a user's role revokes their current active sessions to enforce fresh permissions.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Designation
                  </label>
                  <input
                    type="text"
                    value={editFormData.designation}
                    onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updating}
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 3: Reset Password                                       */}
      {/* ------------------------------------------------------------- */}
      {resettingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '1.75rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#0f172a' }}>
              Reset Password
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem' }}>
              Set a new secure password for <strong>{resettingUser.full_name}</strong> ({resettingUser.username}). This will immediately invalidate any active login sessions.
            </p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  New Password
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResettingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingPassword}
                >
                  {savingPassword ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 4: Active Sessions & Token Status                       */}
      {/* ------------------------------------------------------------- */}
      {sessionUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '640px', padding: '1.75rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Session Registry: {sessionUser.full_name}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Server-side database-backed JWT session registry
                </span>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleRevokeAllSessions}
                disabled={revokingSessions}
              >
                <LogOut size={13} />
                <span>Revoke All Sessions</span>
              </button>
            </div>

            {loadingSessions ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                Loading session logs...
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                No recorded active sessions found for this user.
              </div>
            ) : (
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Device / Client</th>
                      <th>IP Address</th>
                      <th>Login Time</th>
                      <th>Expires At</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, idx) => (
                      <tr key={idx}>
                        <td>
                          <span style={{ fontWeight: 500, color: '#1e293b' }}>
                            {s.user_agent.length > 35 ? s.user_agent.slice(0, 35) + '...' : s.user_agent}
                          </span>
                        </td>
                        <td><code>{s.ip_address}</code></td>
                        <td>{s.created_at}</td>
                        <td>{s.expires_at}</td>
                        <td>
                          <span className={`badge ${s.is_active ? 'badge-success' : 'badge-secondary'}`}>
                            {s.is_active ? 'Active' : s.is_revoked ? 'Revoked' : 'Expired'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setSessionUser(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 5: Granular Capabilities & Approvals                     */}
      {/* ------------------------------------------------------------- */}
      {selectedUserForCaps && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '620px', padding: '1.75rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#0f172a' }}>
              Granular Capabilities & Special Approvals
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1.25rem' }}>
              Configure specific execution rights and approval authorities for <strong>{selectedUserForCaps.full_name}</strong> (Role: <span className="badge badge-primary">{selectedUserForCaps.role}</span>).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
              {/* Combine role-relevant capabilities */}
              {(() => {
                const userRole = selectedUserForCaps.role.toUpperCase();
                let availableList = [];
                if (userRole === 'SALES_EXECUTIVE') {
                  availableList = CAPABILITY_DEFINITIONS.SALES_EXECUTIVE;
                } else if (userRole.includes('TECH') || userRole === 'FIELD_TECHNICIAN') {
                  availableList = CAPABILITY_DEFINITIONS.FIELD_TECHNICIAN;
                } else if (userRole === 'WAREHOUSE_MANAGER') {
                  availableList = CAPABILITY_DEFINITIONS.WAREHOUSE_MANAGER;
                } else if (userRole === 'ADMIN' || userRole === 'SOLAR_MANAGER') {
                  availableList = [
                    ...CAPABILITY_DEFINITIONS.ADMIN,
                    ...CAPABILITY_DEFINITIONS.FIELD_TECHNICIAN.slice(0, 3)
                  ];
                } else {
                  availableList = [
                    ...CAPABILITY_DEFINITIONS.SALES_EXECUTIVE,
                    ...CAPABILITY_DEFINITIONS.FIELD_TECHNICIAN
                  ];
                }

                return availableList.map((cap) => {
                  const isChecked = userCaps.includes(cap.id);
                  return (
                    <div
                      key={cap.id}
                      onClick={() => toggleCap(cap.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: isChecked ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        background: isChecked ? '#eff6ff' : '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: isChecked ? 'none' : '2px solid #94a3b8',
                          background: isChecked ? '#2563eb' : '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 2,
                          color: '#fff'
                        }}
                      >
                        {isChecked && <Check size={13} strokeWidth={3} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                          {cap.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {cap.desc}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedUserForCaps(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveCapabilities}
                disabled={savingCaps}
              >
                {savingCaps ? 'Saving...' : 'Save Capabilities'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
