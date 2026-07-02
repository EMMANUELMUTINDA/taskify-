import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAlerts, resolveAlert } from '../api';
import Sidebar from '../components/Sidebar';

export default function Alerts() {
  const { token, isAdmin } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getAlerts(token).then(setAlerts).catch(() => setAlerts([]));
  }, [token]);

  const handleResolve = async (id) => {
    if (!isAdmin) {
      return;
    }

    await resolveAlert(id, token);
    setMsg('Alert resolved');
    const updatedAlerts = await getAlerts(token);
    setAlerts(updatedAlerts);
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Loafing Alerts</div>
            <div className="page-sub">Members flagged for low contribution</div>
          </div>
        </div>

        {msg && <div className="alert-banner alert-success">Success: {msg}</div>}

        {alerts.length === 0 ? (
          <div className="card empty-card">
            <div className="empty-emoji">OK</div>
            <div className="empty-title">No active alerts</div>
            <div className="empty-subtitle">All members are contributing adequately.</div>
          </div>
        ) : (
          alerts.map((a) => (
            <div className="loafing-alert alert-row" key={a.alertID}>
              <div className="alert-row-content">
                <div className="loafing-icon">!</div>
                <div>
                  <div className="loafing-title">
                    {a.memberName} - {a.projectTitle}
                  </div>
                  <div className="loafing-text">
                    Score at trigger: {a.scoreAtTrigger}% (threshold: {a.threshold}%)
                  </div>
                  <div className="loafing-text alert-time">
                    Triggered: {new Date(a.triggeredAt).toLocaleString()}
                  </div>
                </div>
              </div>
              {isAdmin && (
                <button className="btn btn-success btn-sm" onClick={() => handleResolve(a.alertID)}>
                  Resolve
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
