import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  Bell, Check, CheckCheck, Clock, ExternalLink,
  MessageSquare, Compass, Boxes, Wrench, Headphones, Award
} from 'lucide-react';

const CATEGORY_COLORS = {
  ENQUIRY: { bg: '#ecfdf5', text: '#059669', icon: MessageSquare },
  SURVEY: { bg: '#eef2ff', text: '#4f46e5', icon: Compass },
  INVENTORY: { bg: '#fef3c7', text: '#d97706', icon: Boxes },
  INSTALLATION: { bg: '#fff7ed', text: '#ea580c', icon: Wrench },
  SERVICE: { bg: '#faf5ff', text: '#9333ea', icon: Headphones },
  SUBSIDY: { bg: '#f0fdf4', text: '#16a34a', icon: Award },
};

export default function NotificationsDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const drawerRef = useRef(null);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
    } catch (err) {
      // Silently fail if not logged in
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={drawerRef}>
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          padding: '0.45rem',
          borderRadius: '50%',
          cursor: 'pointer',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        title="View Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Flyout Drawer / Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '380px',
            maxHeight: '480px',
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            border: '1px solid #e2e8f0',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.85rem 1.15rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Notifications</strong>
              {unreadCount > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.72rem',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <CheckCheck size={13} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => {
                const conf = CATEGORY_COLORS[n.category] || CATEGORY_COLORS.ENQUIRY;
                const Icon = conf.icon;

                return (
                  <div
                    key={n.id}
                    style={{
                      padding: '0.85rem 1.15rem',
                      borderBottom: '1px solid #f8fafc',
                      background: n.is_read ? '#ffffff' : '#f0f9ff',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: conf.bg,
                        color: conf.text,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: n.is_read ? 600 : 700, color: '#0f172a' }}>
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <button
                            onClick={(e) => handleMarkRead(n.id, e)}
                            title="Mark as read"
                            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                          >
                            <Check size={13} />
                          </button>
                        )}
                      </div>

                      <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                        {n.message}
                      </p>

                      {n.link_url && (
                        <Link
                          to={n.link_url}
                          onClick={() => setIsOpen(false)}
                          style={{
                            fontSize: '0.72rem',
                            color: '#2563eb',
                            textDecoration: 'none',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <span>Open related workflow</span>
                          <ExternalLink size={10} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}
    </div>
  );
}

