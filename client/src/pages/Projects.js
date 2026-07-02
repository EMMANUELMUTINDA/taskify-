import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { addProjectMember, createProject, getProjectMembers, getProjects, getUsers } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Projects() {
  const { token, user, isAdmin } = useAuth();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [members, setMembers] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [projectForm, setProjectForm] = useState({ title: '', description: '', deadline: '' });
  const [memberForm, setMemberForm] = useState({ userID: '', roleInProject: 'Member' });

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const nextProjects = await getProjects(token);
        if (!mounted) return;
        setProjects(nextProjects);
        if (!selectedProject && nextProjects.length > 0) {
          setSelectedProject(String(nextProjects[0].projectID));
        }
      } catch (_error) {
        if (mounted) setProjects([]);
      }

      try {
        const nextUsers = await getUsers(token);
        if (mounted) setUsers(nextUsers);
      } catch (_error) {
        if (mounted) setUsers([]);
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, [token, selectedProject]);

  useEffect(() => {
    if (!selectedProject) {
      setMembers([]);
      return;
    }

    getProjectMembers(selectedProject, token).then(setMembers).catch(() => setMembers([]));
  }, [selectedProject, token]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!user?.userID) {
      setError('You need to be logged in to create projects.');
      return;
    }

    if (!isAdmin) {
      setError('Only Supervisors can create projects.');
      return;
    }

    const payload = {
      createdBy: user.userID,
      title: projectForm.title,
      description: projectForm.description,
      deadline: projectForm.deadline || null,
      status: 'Active',
    };

    try {
      const result = await createProject(payload, token);
      if (result.projectID) {
        setProjectForm({ title: '', description: '', deadline: '' });
        setMsg('Project created successfully');
        const refreshedProjects = await getProjects(token);
        setProjects(refreshedProjects);
        setSelectedProject(String(result.projectID));
      }
    } catch (apiError) {
      setError(apiError.message || 'Failed to create project');
    }
  };

  const handleAssignMember = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!selectedProject || !memberForm.userID) {
      setError('Choose a project and member first.');
      return;
    }

    if (!isAdmin) {
      setError('Only Supervisors can assign project members.');
      return;
    }

    try {
      const result = await addProjectMember(selectedProject, memberForm, token);
      if (result.message) {
        setMsg('Member assigned to project');
        setMemberForm({ userID: '', roleInProject: 'Member' });
        const updatedMembers = await getProjectMembers(selectedProject, token);
        setMembers(updatedMembers);
      }
    } catch (apiError) {
      setError(apiError.message || 'Failed to assign project member');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Projects</div>
            <div className="page-sub">Create projects, assign members, and track ownership</div>
            {!isAdmin && (
              <div className="page-sub" style={{ color: '#b42318', marginTop: '6px' }}>
                You are signed in as {user?.role || 'Member'}. Only Supervisors can create projects and assign members.
              </div>
            )}
          </div>
        </div>

        {msg && <div className="alert-banner alert-success">Success: {msg}</div>}
        {error && <div className="alert-banner alert-danger">Warning: {error}</div>}

        <div className="review-grid">
          <div className="card">
            <div className="card-title">Create Project</div>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className="form-control"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Deadline</label>
                <input
                  className="form-control"
                  type="date"
                  value={projectForm.deadline}
                  onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={!isAdmin}>Create Project</button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">Assign Member</div>
            <form onSubmit={handleAssignMember}>
              <div className="form-group">
                <label className="form-label">Project</label>
                <select
                  className="form-control"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">Choose project</option>
                  {projects.map((p) => (
                    <option key={p.projectID} value={p.projectID}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Member</label>
                <select
                  className="form-control"
                  value={memberForm.userID}
                  onChange={(e) => setMemberForm({ ...memberForm, userID: e.target.value })}
                >
                  <option value="">Choose member</option>
                  {users.map((u) => (
                    <option key={u.userID} value={u.userID}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Project Role</label>
                <select
                  className="form-control"
                  value={memberForm.roleInProject}
                  onChange={(e) => setMemberForm({ ...memberForm, roleInProject: e.target.value })}
                >
                  <option value="Member">Member</option>
                  <option value="Leader">Leader</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={!isAdmin}>Assign Member</button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Project Members</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Member</th>
                  <th>Role In Project</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.projectMemberID}>
                    <td>{projects.find((p) => Number(p.projectID) === Number(m.projectID))?.title || '-'}</td>
                    <td>{m.name}</td>
                    <td>{m.roleInProject}</td>
                    <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>
                      No members assigned for this project yet.
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
