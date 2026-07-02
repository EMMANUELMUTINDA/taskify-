import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  getProjects,
  getProjectMembers,
  getAssignments,
  downloadAssignmentFile,
  uploadAssignment,
  getProjectMessages,
  sendProjectMessage,
  getTasks,
  updateTaskStatus,
} from '../api';
import { useAuth } from '../context/AuthContext';

export default function Collaboration() {
  const { token, user, isAdmin } = useAuth();
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', file: null });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const hasProjects = projects.length > 0;
  const isCurrentUserMember = members.some((member) => Number(member.userID) === Number(user?.userID));

  useEffect(() => {
    let mounted = true;

    const hydrateProjects = async () => {
      try {
        const data = await getProjects(token);
        if (!mounted) {
          return;
        }

        if (isAdmin) {
          setProjects(data);
          if (data.length > 0) {
            setSelectedProject((prev) => prev || String(data[0].projectID));
          }
          return;
        }

        const membershipResults = await Promise.all(
          data.map(async (project) => {
            try {
              const projectMembers = await getProjectMembers(project.projectID, token);
              return {
                project,
                isMember: projectMembers.some(
                  (member) => Number(member.userID) === Number(user?.userID)
                ),
              };
            } catch (_error) {
              return { project, isMember: false };
            }
          })
        );

        if (!mounted) {
          return;
        }

        const visibleProjects = membershipResults
          .filter((entry) => entry.isMember)
          .map((entry) => entry.project);

        setProjects(visibleProjects);
        if (visibleProjects.length > 0) {
          setSelectedProject((prev) => prev || String(visibleProjects[0].projectID));
        } else {
          setSelectedProject('');
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
  }, [token, user?.userID, isAdmin]);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      if (!selectedProject) {
        setMembers([]);
        setAssignments([]);
        setTasks([]);
        setMessages([]);
        return;
      }

      try {
        const [nextMembers, nextAssignments, nextTasks, nextMessages] = await Promise.all([
          getProjectMembers(selectedProject, token),
          getAssignments(selectedProject, token),
          getTasks(selectedProject, token),
          getProjectMessages(selectedProject, token),
        ]);

        if (!mounted) {
          return;
        }

        setMembers(nextMembers);
        setAssignments(nextAssignments);
        setTasks(nextTasks);
        setMessages(nextMessages);
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        setAssignments([]);
        setTasks([]);
        setMessages([]);
        setMembers([]);
        setError(loadError.message || 'Failed to load collaboration workspace');
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, [selectedProject, token]);

  const handleUploadAssignment = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');

    if (!isAdmin && !isCurrentUserMember) {
      setError('You must be a project member to upload work.');
      return;
    }

    if (!assignmentForm.title.trim()) {
      setError('Assignment title is required.');
      return;
    }

    if (!assignmentForm.file) {
      setError('Please choose a file to upload.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', assignmentForm.title.trim());
      formData.append('description', assignmentForm.description.trim());
      formData.append('assignmentFile', assignmentForm.file);

      await uploadAssignment(selectedProject, formData, token);
      const refreshed = await getAssignments(selectedProject, token);
      setAssignments(refreshed);
      setAssignmentForm({ title: '', description: '', file: null });
      setMsg(isAdmin ? 'Assignment uploaded successfully.' : 'Work uploaded successfully.');
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to upload assignment.');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');

    if (!chatMessage.trim()) {
      setError('Please type a message before sending.');
      return;
    }

    try {
      await sendProjectMessage(selectedProject, { message: chatMessage.trim() }, token);
      const refreshed = await getProjectMessages(selectedProject, token);
      setMessages(refreshed);
      setChatMessage('');
    } catch (sendError) {
      setError(sendError.message || 'Failed to send message.');
    }
  };

  const canEditTask = (task) => {
    if (isAdmin || user?.role === 'GroupLeader') {
      return true;
    }

    return Number(task.assignedTo) === Number(user?.userID);
  };

  const handleTaskStatusChange = async (taskId, nextStatus) => {
    setMsg('');
    setError('');

    const progressPct = nextStatus === 'Done' ? 100 : nextStatus === 'InProgress' ? 50 : 0;

    try {
      await updateTaskStatus(taskId, { status: nextStatus, progressPct }, token);
      const refreshed = await getTasks(selectedProject, token);
      setTasks(refreshed);
      setMsg('Task status updated. Contribution percentages will refresh on the Contributions page.');
    } catch (updateError) {
      setError(updateError.message || 'Failed to update task status.');
    }
  };

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

  const handleDownloadAssignment = async (assignment) => {
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
            <div className="page-title">Collaboration</div>
            <div className="page-sub">
              Members can upload completed work and collaborate in project chat rooms.
            </div>
          </div>
          <select
            className="form-control"
            style={{ width: '260px' }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={!hasProjects}
          >
            {!hasProjects && <option value="">No accessible projects</option>}
            {projects.map((project) => (
              <option key={project.projectID} value={project.projectID}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        {msg && <div className="alert-banner alert-success">Success: {msg}</div>}
        {error && <div className="alert-banner alert-danger">Warning: {error}</div>}

        {!hasProjects && (
          <div className="alert-banner alert-warning">
            You currently do not have access to any project collaboration room.
          </div>
        )}

        <div className="review-grid">
          <div className="card">
            <div className="card-title">Project Assignments</div>

            <form onSubmit={handleUploadAssignment} style={{ marginBottom: '14px' }}>
              <div className="form-group">
                <label className="form-label">{isAdmin ? 'Assignment Title' : 'Work Title'}</label>
                <input
                  className="form-control"
                  value={assignmentForm.title}
                  onChange={(e) =>
                    setAssignmentForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder={
                    isAdmin
                      ? 'Week 4 Data Structures Assignment'
                      : 'API integration completion - Sprint 2'
                  }
                  disabled={!selectedProject}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={assignmentForm.description}
                  onChange={(e) =>
                    setAssignmentForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder={
                    isAdmin
                      ? 'Include expected deliverables and deadline details.'
                      : 'Briefly describe what was completed in this upload.'
                  }
                  disabled={!selectedProject}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Upload File</label>
                <input
                  className="form-control"
                  type="file"
                  onChange={(e) =>
                    setAssignmentForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))
                  }
                  disabled={!selectedProject}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={!selectedProject}>
                {isAdmin ? 'Upload Assignment' : 'Submit Completed Work'}
              </button>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Uploaded By</th>
                    <th>Date</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.assignmentID}>
                      <td>
                        <div>{assignment.title}</div>
                        {assignment.description && (
                          <div className="page-sub" style={{ marginTop: '4px' }}>
                            {assignment.description}
                          </div>
                        )}
                      </td>
                      <td>{assignment.uploadedByName}</td>
                      <td>{new Date(assignment.uploadedAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDownloadAssignment(assignment)}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)', padding: '22px' }}>
                        No assignments uploaded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Project Tasks</div>
            <div className="page-sub" style={{ marginBottom: '10px' }}>
              Everyone can see team tasks. Members can update tasks assigned to them.
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const assignee = members.find(
                      (member) => Number(member.userID) === Number(task.assignedTo)
                    );

                    return (
                      <tr key={task.taskID}>
                        <td>{task.title}</td>
                        <td>{assignee?.name || `User #${task.assignedTo}`}</td>
                        <td>
                          <select
                            className="form-control"
                            value={task.status}
                            onChange={(e) => handleTaskStatusChange(task.taskID, e.target.value)}
                            disabled={!canEditTask(task)}
                            style={{ minWidth: '140px' }}
                          >
                            <option value="Todo">Todo</option>
                            <option value="InProgress">In Progress</option>
                            <option value="Done">Done</option>
                            <option value="Backlog">Backlog</option>
                          </select>
                        </td>
                        <td>{task.progressPct}%</td>
                      </tr>
                    );
                  })}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)', padding: '22px' }}>
                        No tasks created for this project yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Project Chat</div>

            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                height: '320px',
                overflowY: 'auto',
                padding: '10px',
                marginBottom: '10px',
                background: '#f8fbff',
              }}
            >
              {messages.map((message) => (
                <div key={message.messageID} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    <strong>{message.name}</strong> ({message.role})
                    {' · '}
                    {new Date(message.sentAt).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text)' }}>{message.message}</div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="empty-text">No messages yet. Start the conversation.</div>
              )}
            </div>

            <form onSubmit={handleSendMessage}>
              <div className="form-group">
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Type a message to your project members..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  disabled={!selectedProject}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={!selectedProject}>
                Send Message
              </button>
            </form>

            <div style={{ marginTop: '12px' }}>
              <div className="page-sub">Members in this room: {members.length}</div>
              <div className="page-sub" style={{ marginTop: '4px' }}>
                {members.map((member) => member.name).join(', ') || 'No members assigned'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
