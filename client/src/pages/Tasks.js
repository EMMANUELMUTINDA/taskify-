import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { createTask, getProjects, getTasks, getUsers, updateTaskStatus } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Tasks() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', assignedTo: '', status: 'Todo', deadline: '' });

  useEffect(() => {
    let mounted = true;

    getProjects(token)
      .then((rows) => {
        if (!mounted) return;
        setProjects(rows);
        if (rows.length > 0) {
          setSelectedProject(String(rows[0].projectID));
        }
      })
      .catch(() => {
        if (mounted) setProjects([]);
      });

    getUsers(token).then(setUsers).catch(() => setUsers([]));

    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    let mounted = true;

    const hydrateTasks = async () => {
      if (!selectedProject) {
        if (mounted) setTasks([]);
        return;
      }

      try {
        const nextTasks = await getTasks(selectedProject, token);
        if (mounted) setTasks(nextTasks);
      } catch (_error) {
        if (mounted) setTasks([]);
      }
    };

    hydrateTasks();

    return () => {
      mounted = false;
    };
  }, [selectedProject, token]);

  const reloadTasks = async (projectId) => {
    if (!projectId) {
      setTasks([]);
      return;
    }

    const nextTasks = await getTasks(projectId, token);
    setTasks(nextTasks);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');

    if (!selectedProject) {
      setError('Select a project first.');
      return;
    }

    const payload = {
      projectID: Number(selectedProject),
      assignedTo: Number(form.assignedTo),
      title: form.title,
      status: form.status,
      deadline: form.deadline || null,
      progressPct: form.status === 'Done' ? 100 : 0,
    };

    const result = await createTask(payload, token);
    if (result.taskID) {
      setMsg('Task created successfully');
      setForm({ title: '', assignedTo: '', status: 'Todo', deadline: '' });
      await reloadTasks(selectedProject);
    }
  };

  const handleStatusChange = async (taskId, status) => {
    setMsg('');
    setError('');

    const progressPct = status === 'Done' ? 100 : status === 'InProgress' ? 50 : 0;
    const result = await updateTaskStatus(taskId, { status, progressPct }, token);
    if (result.message) {
      setMsg('Task status updated');
      await reloadTasks(selectedProject);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Tasks</div>
            <div className="page-sub">Create tasks, assign owners, and update status</div>
          </div>
          <select
            className="form-control"
            style={{ width: '240px' }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.projectID} value={p.projectID}>{p.title}</option>
            ))}
          </select>
        </div>

        {msg && <div className="alert-banner alert-success">Success: {msg}</div>}
        {error && <div className="alert-banner alert-danger">Warning: {error}</div>}

        <div className="card">
          <div className="card-title">Create Task</div>
          <form onSubmit={handleCreateTask} className="review-grid">
            <div className="form-group">
              <label className="form-label">Task Title *</label>
              <input
                className="form-control"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Assign To *</label>
              <select
                className="form-control"
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                required
              >
                <option value="">Choose member</option>
                {users.map((u) => (
                  <option key={u.userID} value={u.userID}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Initial Status</label>
              <select
                className="form-control"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="Todo">Todo</option>
                <option value="InProgress">In Progress</option>
                <option value="Done">Done</option>
                <option value="Backlog">Backlog</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input
                type="date"
                className="form-control"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
            <div>
              <button className="btn btn-primary" type="submit">Create Task</button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-title">Task List</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.taskID}>
                    <td>{task.title}</td>
                    <td>{users.find((u) => Number(u.userID) === Number(task.assignedTo))?.name || `User #${task.assignedTo}`}</td>
                    <td>
                      <select
                        className="form-control"
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.taskID, e.target.value)}
                      >
                        <option value="Todo">Todo</option>
                        <option value="InProgress">In Progress</option>
                        <option value="Done">Done</option>
                        <option value="Backlog">Backlog</option>
                      </select>
                    </td>
                    <td>{task.progressPct}%</td>
                    <td>{task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>
                      No tasks in this project yet.
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
