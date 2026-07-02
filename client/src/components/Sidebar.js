import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canManageProjectWork = user?.role === 'Supervisor' || user?.role === 'GroupLeader';

  const active = (path) => (location.pathname === path ? 'nav-item active' : 'nav-item');

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
        <div className="sidebar-logo-icon">T</div>
        <div>
          <h2>Taskify</h2>
          <span>Group Work Monitor</span>
        </div>
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
            <div className={active('/tasks')} onClick={() => navigate('/tasks')}>
              ✅ My Tasks
            </div>
          </>
        )}
        <div className={active('/contributions')} onClick={() => navigate('/contributions')}>
          📈 Contributions
        </div>
        <div className={active('/peer-review')} onClick={() => navigate('/peer-review')}>
          ⭐ Peer Review
        </div>
        <div className={active('/collaboration')} onClick={() => navigate('/collaboration')}>
          💬 Collaboration
        </div>
        <div className={active('/alerts')} onClick={() => navigate('/alerts')}>
          🚨 Loafing Alerts
        </div>

        {isAdmin && (
          <>
            <div className="nav-label">Admin</div>
            <div className={active('/users')} onClick={() => navigate('/users')}>
              👥 Users
            </div>
          </>
        )}
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
