import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { downloadAssignmentFile, getAssignments, getProjects } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Assignments() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const hydrateProjects = async () => {
      try {
        const rows = await getProjects(token);
        if (!mounted) return;
        setProjects(rows);

        if (rows.length > 0) {
          setSelectedProject(String(rows[0].projectID));
        }
      } catch (_error) {
        if (mounted) {
          setProjects([]);
          setSelectedProject('');
        }
      }
    };

    hydrateProjects();

    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    let mounted = true;

    const hydrateAssignments = async () => {
      if (!selectedProject) {
        setAssignments([]);
        return;
      }

      try {
        const rows = await getAssignments(selectedProject, token);
        if (!mounted) return;
        setAssignments(rows);
      } catch (loadError) {
        if (!mounted) return;
        setAssignments([]);
        setError(loadError.message || 'Failed to load assignments.');
      }
    };

    hydrateAssignments();

    return () => {
      mounted = false;
    };
  }, [selectedProject, token]);

  const resolveFilenameFromContentDisposition = (headerValue) => {
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(headerValue || '');
    if (!match || !match[1]) {
      return null;
    }

    try {
      return decodeURIComponent(match[1].replace(/"/g, '').trim());
    } catch (_error) {
      return match[1].replace(/"/g, '').trim();
    }
  };

  const handleDownload = async (assignment) => {
    setMsg('');
    setError('');

    try {
      const { blob, contentDisposition } = await downloadAssignmentFile(
        selectedProject,
        assignment.assignmentID,
        token
      );
      const fallbackName = assignment.fileName || `assignment-${assignment.assignmentID}`;
      const filename = resolveFilenameFromContentDisposition(contentDisposition) || fallbackName;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      setMsg('Download started.');
    } catch (downloadError) {
      setError(downloadError.message || 'Failed to download assignment.');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Assignments</div>
            <div className="page-sub">Browse uploaded project files and download submissions.</div>
          </div>
          <select
            className="form-control"
            style={{ width: '280px' }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={projects.length === 0}
          >
            {projects.length === 0 && <option value="">No accessible projects</option>}
            {projects.map((project) => (
              <option key={project.projectID} value={project.projectID}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        {msg && <div className="alert-banner alert-success">Success: {msg}</div>}
        {error && <div className="alert-banner alert-danger">Warning: {error}</div>}

        <div className="card">
          <div className="card-title">Uploaded Assignments</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  <th>File</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.assignmentID}>
                    <td>{assignment.title}</td>
                    <td>{assignment.description || '-'}</td>
                    <td>{assignment.uploadedByName}</td>
                    <td>{new Date(assignment.uploadedAt).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleDownload(assignment)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>
                      No assignments available for this project.
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
