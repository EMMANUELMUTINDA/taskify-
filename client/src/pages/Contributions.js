import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProjects, getDashboard } from '../api';
import Sidebar from '../components/Sidebar';

export default function Contributions() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [members, setMembers] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useEffect(() => {
    let isMounted = true;

    getProjects(token)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setProjects(data);
        if (data.length > 0) {
          setSelectedProject(String(data[0].projectID));
        }
      })
      .catch(() => {
        if (isMounted) {
          setProjects([]);
          setSelectedProject('');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    let isMounted = true;

    const hydrateMembers = async () => {
      if (!selectedProject) {
        if (isMounted) {
          setMembers([]);
        }
        return;
      }

      try {
        const data = await getDashboard(selectedProject, token);
        if (isMounted) {
          setMembers(Array.isArray(data) ? data : []);
          setLastSyncedAt(new Date());
        }
      } catch (_error) {
        if (isMounted) {
          setMembers([]);
        }
      }
    };

    hydrateMembers();
    const refreshInterval = setInterval(hydrateMembers, 15000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [selectedProject, token]);

  const getScoreColor = (score) => {
    if (score >= 70) return 'var(--success)';
    if (score >= 40) return 'var(--accent)';
    return 'var(--danger)';
  };

  const getProgressClass = (score) => {
    if (score >= 70) return 'green';
    if (score >= 40) return '';
    return 'red';
  };

  const initials = (name) =>
    name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : 'U';

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Contribution Dashboard</div>
            <div className="page-sub">Individual contribution scores per project</div>
            <div className="page-sub" style={{ marginTop: '4px' }}>
              Auto-refreshes every 15 seconds
              {lastSyncedAt ? ` · Last synced: ${lastSyncedAt.toLocaleTimeString()}` : ''}
            </div>
          </div>
          <select
            className="form-control"
            style={{ width: '220px' }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.projectID} value={p.projectID}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Members</div>
            <div className="stat-value">{members.length}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Active Contributors</div>
            <div className="stat-value">{members.filter((m) => m.totalScore >= 40).length}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Low Contributors</div>
            <div className="stat-value">{members.filter((m) => m.totalScore < 30).length}</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-label">Avg Score</div>
            <div className="stat-value">
              {members.length > 0
                ? Math.round(members.reduce((a, m) => a + Number(m.totalScore || 0), 0) / members.length)
                : 0}
              %
            </div>
          </div>
        </div>

        {members
          .filter((m) => Number(m.totalScore) < 30)
          .map((m) => (
            <div className="loafing-alert" key={m.userID}>
              <div className="loafing-icon">⚠️</div>
              <div>
                <div className="loafing-title">Social Loafing Detected - {m.name}</div>
                <div className="loafing-text">
                  Contribution score is {Math.round(Number(m.totalScore || 0))}% - below the 30% threshold.
                  Last active:{' '}
                  {m.lastActive ? new Date(m.lastActive).toLocaleDateString() : 'Never'}
                </div>
              </div>
            </div>
          ))}

        <div className="card">
          <div className="card-title">Individual Contribution Index</div>
          {members.map((m) => (
            <div className="contrib-row" key={m.userID}>
              <div className="contrib-avatar">{initials(m.name)}</div>
              <div style={{ width: '140px' }}>
                <div className="contrib-name">{m.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {m.completedTasks}/{m.totalTasks} tasks done
                </div>
              </div>
              <div className="contrib-bar-wrap">
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${getProgressClass(Number(m.totalScore || 0))}`}
                    style={{ width: `${Math.min(Number(m.totalScore || 0), 100)}%` }}
                  />
                </div>
              </div>
              <div
                className="contrib-score"
                style={{ color: getScoreColor(Number(m.totalScore || 0)) }}
              >
                {Math.round(Number(m.totalScore || 0))}%
              </div>
              <span
                className={`badge ${
                  Number(m.totalScore || 0) >= 70
                    ? 'badge-green'
                    : Number(m.totalScore || 0) >= 40
                      ? 'badge-blue'
                      : 'badge-red'
                }`}
              >
                {Number(m.totalScore || 0) >= 70
                  ? 'Active'
                  : Number(m.totalScore || 0) >= 40
                    ? 'Moderate'
                    : 'Low'}
              </span>
            </div>
          ))}
          {members.length === 0 && (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '24px' }}>
              No data yet. Select a project with members and tasks.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
