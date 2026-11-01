import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
  const { user } = useAuth();

  if (user?.role === 'CUSTOMER') {
    return <Navigate to="/mobile/customer" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

