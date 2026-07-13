import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMyNotifications } from '../api';

export default function Sidebar() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canManageProjectWork = user?.role === 'GroupLeader';
  const unitRoomsPath = '/units';
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      if (!token) {
        if (mounted) {
          setUnreadNotifications(0);
        }
        return;
      }

      try {
        const rows = await getMyNotifications(token);
        if (mounted) {
          setUnreadNotifications((rows || []).filter((item) => !item.isRead).length);
        }
      } catch (_error) {
        if (mounted) {
          setUnreadNotifications(0);
        }
      }
    };

    loadNotifications();

    return () => {
      mounted = false;
    };
  }, [token, location.pathname]);

  const active = (path) => {
    const current = location.pathname;
    const isActivePath = path === '/'
      ? current === '/'
      : current === path || current.startsWith(`${path}/`);

    return isActivePath ? 'nav-item active' : 'nav-item';
  };

  const initials = user?.name
    ? user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
    : 'U';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo_sidebar.jpeg" alt="taskify" style={{ height: '36px' }} />
      </div>

      <nav className="sidebar-nav">
        <div className="nav-label">Menu</div>
        <div className={active('/')} onClick={() => navigate('/')}>
          🏠 Home
        </div>
        <div className={active('/dashboard')} onClick={() => navigate('/dashboard')}>
          📊 Dashboard
        </div>
        {canManageProjectWork && (
          <>
            <div className={active('/projects')} onClick={() => navigate('/projects')}>
              📁 Projects
            </div>
          </>
        )}
        <div
          className={location.pathname === '/units' || location.pathname === '/rooms' ? 'nav-item active' : 'nav-item'}
          onClick={() => navigate(unitRoomsPath)}
        >
          🎓 Unit Rooms
        </div>
        <div className={active('/alerts')} onClick={() => navigate('/alerts')}>
          🚨 Loafing Alerts
        </div>
        <div className={active('/peer-review')} onClick={() => navigate('/peer-review')}>
          ⭐ Peer Review
        </div>
        <div className={active('/notifications')} onClick={() => navigate('/notifications')}>
          🔔 Notifications
          {unreadNotifications > 0 && (
            <span
              style={{
                marginLeft: '8px',
                background: '#F56565',
                color: 'white',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
                minWidth: '20px',
                height: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
              }}
            >
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </div>
        <div
          className={location.pathname === '/room-workspace' ? 'nav-item active' : 'nav-item'}
          onClick={() => navigate('/room-workspace')}
        >
          💬 Room Workspace
        </div>
      </nav>

      <div className="sidebar-user">
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}
