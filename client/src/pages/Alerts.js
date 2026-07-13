import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAlerts, resolveAlert } from '../api';
import Sidebar from '../components/Sidebar';

const clampPct = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const scoreSeverity = (score, threshold) => {
  const gap = threshold - score;
  if (gap >= 15) return 'high';
  if (gap >= 8) return 'medium';
  return 'low';
};

function PercentageCircle({ value, label, tone = 'danger' }) {
  const pct = clampPct(value);
  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  return (
    <div className="alert-circle-wrap">
      <svg className="alert-circle" viewBox="0 0 84 84" role="img" aria-label={`${label} ${pct} percent`}>
        <circle className="alert-circle-track" cx="42" cy="42" r={radius} />
        <circle
          className={`alert-circle-progress ${tone}`}
          cx="42"
          cy="42"
          r={radius}
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="alert-circle-value">{pct}%</div>
      <div className="alert-circle-label">{label}</div>
    </div>
  );
}

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

  const analytics = alerts.reduce(
    (acc, alert) => {
      const score = clampPct(alert.scoreAtTrigger);
      const threshold = clampPct(alert.threshold);
      const severity = scoreSeverity(score, threshold);

      acc.total += 1;
      acc.avgScore += score;
      acc.avgThreshold += threshold;
      acc.bySeverity[severity] += 1;

      const key = alert.projectTitle || 'Unknown Project';
      if (!acc.byProject[key]) {
        acc.byProject[key] = { count: 0, totalScore: 0 };
      }
      acc.byProject[key].count += 1;
      acc.byProject[key].totalScore += score;
      return acc;
    },
    {
      total: 0,
      avgScore: 0,
      avgThreshold: 0,
      bySeverity: { high: 0, medium: 0, low: 0 },
      byProject: {},
    }
  );

  const avgScore = analytics.total ? Math.round(analytics.avgScore / analytics.total) : 0;
  const avgThreshold = analytics.total ? Math.round(analytics.avgThreshold / analytics.total) : 0;

  const projectRows = Object.entries(analytics.byProject)
    .map(([project, value]) => ({
      project,
      count: value.count,
      avgScore: Math.round(value.totalScore / value.count),
    }))
    .sort((a, b) => b.count - a.count);

  const maxProjectAlerts = Math.max(...projectRows.map((row) => row.count), 1);

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

        <div className="alerts-overview-grid">
          <div className="card alert-summary-card">
            <div className="card-title">Active Alerts</div>
            <div className="alert-summary-value">{alerts.length}</div>
            <div className="page-sub">Members currently below contribution threshold</div>
          </div>
          <div className="card alert-summary-card">
            <div className="card-title">Average Trigger Score</div>
            <div className="alert-summary-value">{avgScore}%</div>
            <div className="page-sub">Compared with threshold average {avgThreshold}%</div>
          </div>
          <div className="card alert-summary-card">
            <div className="card-title">Severity Mix</div>
            <div className="alert-severity-pills">
              <span className="badge badge-red">High {analytics.bySeverity.high}</span>
              <span className="badge badge-orange">Medium {analytics.bySeverity.medium}</span>
              <span className="badge badge-green">Low {analytics.bySeverity.low}</span>
            </div>
          </div>
        </div>

        {projectRows.length > 0 && (
          <div className="card">
            <div className="card-title">Project Risk Graph</div>
            <div className="alerts-graph">
              {projectRows.map((row) => (
                <div className="alerts-graph-row" key={row.project}>
                  <div className="alerts-graph-title">{row.project}</div>
                  <div className="alerts-graph-bar-wrap">
                    <div
                      className="alerts-graph-bar"
                      style={{ width: `${Math.max(8, (row.count / maxProjectAlerts) * 100)}%` }}
                    >
                      {row.count}
                    </div>
                  </div>
                  <div className="alerts-graph-score">avg {row.avgScore}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="card empty-card">
            <div className="empty-emoji">OK</div>
            <div className="empty-title">No active alerts</div>
            <div className="empty-subtitle">All members are contributing adequately.</div>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((a) => {
              const score = clampPct(a.scoreAtTrigger);
              const threshold = clampPct(a.threshold);
              const severity = scoreSeverity(score, threshold);
              const circleTone = severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'success';

              return (
                <div className="loafing-alert alert-row" key={a.alertID}>
                  <div className="alert-row-content">
                    <div className={`loafing-icon severity-${severity}`}>!</div>
                    <div>
                      <div className="loafing-title">
                        {a.memberName} - {a.projectTitle}
                      </div>
                      <div className="loafing-text">
                        Score at trigger: {score}% (threshold: {threshold}%)
                      </div>
                      <div className="loafing-text alert-time">
                        Triggered: {new Date(a.triggeredAt).toLocaleString()}
                      </div>
                      <div className="alert-severity-inline">Severity: {severity}</div>
                    </div>
                  </div>

                  <div className="alert-circles">
                    <PercentageCircle value={score} label="Score" tone={circleTone} />
                    <PercentageCircle value={threshold} label="Threshold" tone="muted" />
                  </div>

                  {isAdmin && (
                    <button className="btn btn-success btn-sm" onClick={() => handleResolve(a.alertID)}>
                      Resolve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
