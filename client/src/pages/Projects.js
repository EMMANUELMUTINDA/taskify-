import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  addProjectMember,
  allocateGroupToProject,
  createClassGroup,
  createProject,
  getClassGroups,
  getProjectMembers,
  getProjects,
  getUsers,
} from '../api';
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
  const [groupForm, setGroupForm] = useState({ groupName: '' });
  const [classGroupForm, setClassGroupForm] = useState({
    courseName: '',
    studyYear: '',
    unitCode: '',
    classGroup: '',
  });
  const [classGroups, setClassGroups] = useState([]);
  const [memberEmailQuery, setMemberEmailQuery] = useState('');
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);

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

      try {
        const nextClassGroups = await getClassGroups(token);
        if (mounted) setClassGroups(nextClassGroups);
      } catch (_error) {
        if (mounted) setClassGroups([]);
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

  const handleAllocateGroup = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!selectedProject || !groupForm.groupName) {
      setError('Choose a room and group first.');
      return;
    }

    if (!isAdmin) {
      setError('Only Supervisors can allocate groups to rooms.');
      return;
    }

    try {
      const result = await allocateGroupToProject(
        selectedProject,
        { groupName: groupForm.groupName },
        token
      );

      setMsg(result.message || 'Group allocated to room');
      const updatedMembers = await getProjectMembers(selectedProject, token);
      setMembers(updatedMembers);
    } catch (apiError) {
      setError(apiError.message || 'Failed to allocate group');
    }
  };

  const handleCreateClassGroup = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!isAdmin) {
      setError('Only Supervisors can create class groups.');
      return;
    }

    if (
      !classGroupForm.courseName ||
      !classGroupForm.studyYear ||
      !classGroupForm.unitCode ||
      !classGroupForm.classGroup
    ) {
      setError('Fill in course name, year, unit code, and class group.');
      return;
    }

    try {
      const result = await createClassGroup(
        {
          courseName: classGroupForm.courseName,
          studyYear: Number(classGroupForm.studyYear),
          unitCode: classGroupForm.unitCode,
          classGroup: classGroupForm.classGroup,
        },
        token
      );

      setMsg(result.message || 'Class group saved successfully');
      setClassGroupForm({
        courseName: '',
        studyYear: '',
        unitCode: '',
        classGroup: '',
      });

      const nextClassGroups = await getClassGroups(token);
      setClassGroups(nextClassGroups);
    } catch (apiError) {
      setError(apiError.message || 'Failed to save class group');
    }
  };

  const availableGroups = classGroups.map((group) => group.groupName);

  const studentUsers = users.filter((u) => u.role === 'Member' || u.role === 'GroupLeader');
  const query = memberEmailQuery.trim().toLowerCase();
  const emailSearchResults = (query
    ? studentUsers.filter(
        (u) =>
          u.email.toLowerCase().includes(query) ||
          String(u.name || '').toLowerCase().includes(query)
      )
    : studentUsers
  ).slice(0, 12);

  const selectedStudent = studentUsers.find(
    (u) => Number(u.userID) === Number(memberForm.userID)
  );

  const isSelectedStudentAlreadyMember = Boolean(
    selectedStudent &&
      members.some((m) => Number(m.userID) === Number(selectedStudent.userID))
  );

  const handleStudentSearchSelect = (student) => {
    setMemberForm((prev) => ({ ...prev, userID: String(student.userID) }));
    setMemberEmailQuery(student.email);
    setHighlightedSuggestionIndex(-1);
    setError('');
  };

  const handleStudentSearchKeyDown = (event) => {
    if (emailSearchResults.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedSuggestionIndex((prev) =>
        prev < emailSearchResults.length - 1 ? prev + 1 : emailSearchResults.length - 1
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
      return;
    }

    if (event.key === 'Enter' && highlightedSuggestionIndex >= 0) {
      event.preventDefault();
      handleStudentSearchSelect(emailSearchResults[highlightedSuggestionIndex]);
      return;
    }

    if (event.key === 'Escape') {
      setHighlightedSuggestionIndex(-1);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Projects</div>
            <div className="page-sub">Create collaboration rooms, assign members, and manage ownership</div>
            {!isAdmin && (
              <div className="page-sub" style={{ color: '#b42318', marginTop: '6px' }}>
                You are signed in as {user?.role || 'Member'}. Only Supervisors can create rooms and assign members.
              </div>
            )}
          </div>
        </div>

        {msg && <div className="alert-banner alert-success">Success: {msg}</div>}
        {error && <div className="alert-banner alert-danger">Warning: {error}</div>}

        <div className="review-grid">
          <div className="card">
            <div className="card-title">Create Room</div>
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
              <button className="btn btn-primary" type="submit" disabled={!isAdmin}>Create Room</button>
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
                <label className="form-label">Search Student By Email</label>
                <input
                  className="form-control"
                  value={memberEmailQuery}
                  onChange={(e) => {
                    setMemberEmailQuery(e.target.value);
                    setHighlightedSuggestionIndex(-1);
                  }}
                  onKeyDown={handleStudentSearchKeyDown}
                  placeholder="e.g. first.second@strathmore.edu"
                />
                <div className="page-sub" style={{ marginTop: '6px' }}>
                  Showing student accounts that already exist in the system.
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    maxHeight: '170px',
                    overflowY: 'auto',
                    background: '#fff',
                  }}
                >
                  {emailSearchResults.map((u) => {
                    const alreadyMember = members.some((m) => Number(m.userID) === Number(u.userID));
                    const optionIndex = emailSearchResults.findIndex((candidate) => candidate.userID === u.userID);
                    return (
                      <button
                        key={u.userID}
                        type="button"
                        onClick={() => handleStudentSearchSelect(u)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          background:
                            highlightedSuggestionIndex === optionIndex
                              ? 'rgba(11, 107, 203, 0.12)'
                              : Number(memberForm.userID) === Number(u.userID)
                              ? 'rgba(11, 107, 203, 0.08)'
                              : 'transparent',
                          padding: '9px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{u.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {u.email} · {u.role}
                          {alreadyMember ? ' · already in this room' : ''}
                        </div>
                      </button>
                    );
                  })}
                  {emailSearchResults.length === 0 && (
                    <div style={{ padding: '10px', fontSize: '12px', color: '#b42318' }}>
                      No account found for this email search.
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Student</label>
                <select
                  className="form-control"
                  value={memberForm.userID}
                  onChange={(e) => setMemberForm({ ...memberForm, userID: e.target.value })}
                >
                  <option value="">Choose student</option>
                  {emailSearchResults.map((u) => (
                    <option key={u.userID} value={u.userID}>{u.name} ({u.email})</option>
                  ))}
                </select>
                {selectedStudent && (
                  <div className="page-sub" style={{ marginTop: '6px' }}>
                    Selected: {selectedStudent.name} ({selectedStudent.email})
                  </div>
                )}
                {isSelectedStudentAlreadyMember && (
                  <div className="page-sub" style={{ marginTop: '6px', color: '#b42318' }}>
                    This student is already a member of the selected room.
                  </div>
                )}
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

          <div className="card">
            <div className="card-title">Create Class Group</div>
            <form onSubmit={handleCreateClassGroup}>
              <div className="form-group">
                <label className="form-label">Course Name</label>
                <input
                  className="form-control"
                  value={classGroupForm.courseName}
                  onChange={(e) =>
                    setClassGroupForm((prev) => ({ ...prev, courseName: e.target.value }))
                  }
                  placeholder="e.g. BBIT"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Year</label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  max="8"
                  value={classGroupForm.studyYear}
                  onChange={(e) =>
                    setClassGroupForm((prev) => ({ ...prev, studyYear: e.target.value }))
                  }
                  placeholder="e.g. 2"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Code</label>
                <input
                  className="form-control"
                  value={classGroupForm.unitCode}
                  onChange={(e) =>
                    setClassGroupForm((prev) => ({ ...prev, unitCode: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. BIT2105"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Class Group</label>
                <input
                  className="form-control"
                  value={classGroupForm.classGroup}
                  onChange={(e) =>
                    setClassGroupForm((prev) => ({ ...prev, classGroup: e.target.value }))
                  }
                  placeholder="e.g. Group B"
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={!isAdmin}>Save Class Group</button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">Allocate Group To Room</div>
            <form onSubmit={handleAllocateGroup}>
              <div className="form-group">
                <label className="form-label">Room</label>
                <select
                  className="form-control"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">Choose room</option>
                  {projects.map((p) => (
                    <option key={p.projectID} value={p.projectID}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Student Group</label>
                <select
                  className="form-control"
                  value={groupForm.groupName}
                  onChange={(e) => setGroupForm({ groupName: e.target.value })}
                >
                  <option value="">Choose group</option>
                  {availableGroups.map((groupName, index) => (
                    <option key={`${groupName}-${index}`} value={groupName}>{groupName}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={!isAdmin}>Allocate Group</button>
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
