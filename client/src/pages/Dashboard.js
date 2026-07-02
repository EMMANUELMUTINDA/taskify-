import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { getProjects, getProjectOverview } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [overviewRows, setOverviewRows] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const nextProjects = await getProjects(token);
        if (!mounted) return;
        setProjects(nextProjects);

        const overview = await Promise.all(
          nextProjects.map(async (project) => {
            try {
              return await getProjectOverview(project.projectID, token);
            } catch (_error) {
              return {
                projectId: project.projectID,
                projectTitle: project.title,
                overallProgressPct: 0,
                teamAverageScore: 0,
                memberCount: 0,
                activeAlerts: 0,
              };
            }
          })
        );

        if (!mounted) return;
        setOverviewRows(overview);
      } catch (_error) {
        if (mounted) {
          setProjects([]);
          setOverviewRows([]);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [token]);

  const metrics = useMemo(() => {
    const totalProjects = overviewRows.length;
    const totalMembers = overviewRows.reduce((sum, row) => sum + Number(row.memberCount || 0), 0);
    const activeAlerts = overviewRows.reduce((sum, row) => sum + Number(row.activeAlerts || 0), 0);
    const avgProgress = totalProjects
      ? Math.round(overviewRows.reduce((sum, row) => sum + Number(row.overallProgressPct || 0), 0) / totalProjects)
      : 0;

    return { totalProjects, totalMembers, activeAlerts, avgProgress };
  }, [overviewRows]);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Dashboard</div>
            <div className="page-sub">Live system overview from your backend data</div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Projects</div>
            <div className="stat-value">{metrics.totalProjects}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Members Across Projects</div>
            <div className="stat-value">{metrics.totalMembers}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Active Alerts</div>
            <div className="stat-value">{metrics.activeAlerts}</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-label">Average Progress</div>
            <div className="stat-value">{metrics.avgProgress}%</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Project Health</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Progress</th>
                  <th>Team Score</th>
                  <th>Members</th>
                  <th>Alerts</th>
                </tr>
              </thead>
              <tbody>
                {overviewRows.map((row) => (
                  <tr key={row.projectId}>
                    <td><strong>{row.projectTitle}</strong></td>
                    <td>{Math.round(Number(row.overallProgressPct || 0))}%</td>
                    <td>{Math.round(Number(row.teamAverageScore || 0))}%</td>
                    <td>{row.memberCount}</td>
                    <td>{row.activeAlerts}</td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>
                      No projects found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
