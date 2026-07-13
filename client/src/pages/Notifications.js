import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { getMyNotifications, markNotificationRead } from '../api';
import { useAuth } from '../context/AuthContext';

const prettyTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleString();
};

const labelForType = (type) => {
  if (type === 'password-reset') return 'Security';
  if (type === 'security') return 'Account';
  return 'System';
};

export default function Notifications() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const rows = await getMyNotifications(token);
        if (mounted) {
          setItems(rows || []);
          setError('');
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load notifications');
          setItems([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [token]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items]
  );

  const handleMarkRead = async (notificationId) => {
    try {
      await markNotificationRead(notificationId, token);
      setItems((prev) =>
        prev.map((item) =>
          Number(item.notificationID) === Number(notificationId)
            ? { ...item, isRead: 1, readAt: new Date().toISOString() }
            : item
        )
      );
    } catch (err) {
      setError(err.message || 'Failed to update notification');
    }
  };

  const handleMarkAllRead = async () => {
    const unread = items.filter((item) => !item.isRead);
    for (const item of unread) {
      // Sequential updates avoid creating request spikes for many notifications.
      // eslint-disable-next-line no-await-in-loop
      await handleMarkRead(item.notificationID);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Notifications</div>
            <div className="page-sub">Security codes and account updates appear here.</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            Mark All Read
          </button>
        </div>

        <div className="stats-grid" style={{ marginBottom: '18px' }}>
          <div className="stat-card">
            <div className="stat-label">Total</div>
            <div className="stat-value">{items.length}</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-label">Unread</div>
            <div className="stat-value">{unreadCount}</div>
          </div>
        </div>

        {error && <div className="alert-banner alert-danger">Warning: {error}</div>}

        <div className="card">
          {loading ? (
            <p className="empty-text">Loading notifications...</p>
          ) : items.length === 0 ? (
            <p className="empty-text">No notifications yet.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.notificationID}
                style={{
                  border: item.isRead ? '1px solid #E2E8F0' : '1.5px solid #90CDF4',
                  background: item.isRead ? '#FFFFFF' : '#F7FAFC',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '10px',
                  boxShadow: item.isRead ? 'none' : '0 4px 14px rgba(15, 23, 42, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className="badge badge-blue">{labelForType(item.type)}</span>
                      {!item.isRead && (
                        <span style={{ color: '#0B6BCB', fontSize: '12px', fontWeight: 700 }}>NEW</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, color: '#1A202C' }}>{item.title}</div>
                    <div style={{ color: '#4A5568', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{item.body}</div>
                    <div style={{ color: '#718096', fontSize: '12px', marginTop: '8px' }}>
                      {prettyTime(item.createdAt)}
                    </div>
                  </div>
                  {!item.isRead && (
                    <button
                      className="btn"
                      style={{ border: '1px solid #CBD5E0', background: '#FFFFFF', height: '36px' }}
                      onClick={() => handleMarkRead(item.notificationID)}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
