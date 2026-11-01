import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const DEMO_ACCOUNTS = {
  ADMIN: {
    role: 'ADMIN',
    email: 'admin@sunpower.com',
    password: 'Password@123',
    name: 'Vikram Malhotra',
    designation: 'General Manager & Solar Admin',
    portalPath: '/login/admin',
    themeColor: '#d97706',
    bgColor: '#fffbeb',
  },
  SALES_EXECUTIVE: {
    role: 'SALES_EXECUTIVE',
    email: 'sales@sunpower.com',
    password: 'Password@123',
    name: 'Rahul Deshmukh',
    designation: 'Senior Sales Representative',
    portalPath: '/login/sales',
    themeColor: '#059669',
    bgColor: '#ecfdf5',
  },
  TECHNICIAN: {
    role: 'TECHNICIAN',
    email: 'technician@sunpower.com',
    password: 'Password@123',
    name: 'Deepak Chavan',
    designation: 'Lead Field Solar Technician',
    portalPath: '/login/technician',
    themeColor: '#0891b2',
    bgColor: '#ecfeff',
  },
  WAREHOUSE_MANAGER: {
    role: 'WAREHOUSE_MANAGER',
    email: 'warehouse@sunpower.com',
    password: 'Password@123',
    name: 'Manoj Gokhale',
    designation: 'Warehouse Operations Head',
    portalPath: '/login/warehouse',
    themeColor: '#ca8a04',
    bgColor: '#fefce8',
  },
  CUSTOMER: {
    role: 'CUSTOMER',
    email: 'customer@sunpower.com',
    password: 'Password@123',
    name: 'Rajesh Sharma',
    designation: 'Solar Rooftop Owner',
    portalPath: '/login/customer',
    themeColor: '#006c36',
    bgColor: '#eefdf1',
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('sunpower_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('sunpower_token'));
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize and validate session
  useEffect(() => {
    async function initSession() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const [meData, permsData] = await Promise.all([
          api.getMe(),
          api.getPermissions().catch(() => ({ permissions: [] })),
        ]);
        setUser(meData);
        localStorage.setItem('sunpower_user', JSON.stringify(meData));
        setPermissions(permsData.permissions || []);
      } catch (err) {
        console.warn('Session verification failed, clearing auth:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [token]);

  const login = async (username_or_email, password, expected_role = null) => {
    const res = await api.login({
      username_or_email,
      password,
      expected_role,
    });

    localStorage.setItem('sunpower_token', res.access_token);
    localStorage.setItem('sunpower_user', JSON.stringify(res.user));
    setToken(res.access_token);
    setUser(res.user);
    setPermissions(res.permissions || []);
    return res;
  };

  const quickDemoLogin = async (roleKey) => {
    const demo = DEMO_ACCOUNTS[roleKey];
    if (!demo) throw new Error(`Unknown role ${roleKey}`);

    // Step 1: Invalidate existing server session if any
    try {
      const activeToken = localStorage.getItem('sunpower_token') || token;
      if (activeToken) {
        await api.logout().catch(() => {});
      }
    } catch (e) {
      // Ignore cleanup error
    } finally {
      localStorage.removeItem('sunpower_token');
      localStorage.removeItem('sunpower_user');
      setToken(null);
      setUser(null);
      setPermissions([]);
    }

    // Step 2: Authenticate as the selected role's demo user via POST /api/auth/login
    const res = await api.login({
      username_or_email: demo.email,
      password: demo.password,
      expected_role: demo.role,
    });

    localStorage.setItem('sunpower_token', res.access_token);
    setToken(res.access_token);

    // Step 3: Validate identity via GET /api/auth/me
    let verifiedUser = res.user;
    try {
      const meData = await api.getMe();
      if (meData && meData.role) {
        verifiedUser = meData;
      }
    } catch (e) {
      console.warn('Identity verification fallback to login payload:', e.message);
    }

    // Step 4: Update application state with genuine credentials returned by server
    localStorage.setItem('sunpower_user', JSON.stringify(verifiedUser));
    setUser(verifiedUser);
    setPermissions(res.permissions || []);
    return res;
  };

  const logout = async () => {
    try {
      const activeToken = localStorage.getItem('sunpower_token') || token;
      if (activeToken) {
        await api.logout().catch(() => {});
      }
    } catch (e) {
      // Ignore network errors during session revocation
    } finally {
      localStorage.removeItem('sunpower_token');
      localStorage.removeItem('sunpower_user');
      setToken(null);
      setUser(null);
      setPermissions([]);
    }
  };

  const hasRole = (allowed) => {
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'SOLAR_MANAGER') return true;
    if (Array.isArray(allowed)) {
      return allowed.map((r) => r.toUpperCase()).includes((user.role || '').toUpperCase());
    }
    return (user.role || '').toUpperCase() === (allowed || '').toUpperCase();
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        permissions,
        loading,
        login,
        quickDemoLogin,
        logout,
        hasRole,
        hasPermission,
        isAuthenticated: !!user,
        demoAccounts: DEMO_ACCOUNTS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

