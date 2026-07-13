import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUsers, registerUser } from '../api';
import Sidebar from '../components/Sidebar';

export default function Users() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Member', groupName: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getUsers(token).then(setUsers).catch(() => setUsers([]));
  }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    const res = await registerUser(form, token);
    if (res.message === 'User registered successfully') {
      setMsg('User created successfully');
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'Member', groupName: '' });
      getUsers(token).then(setUsers);
    } else {
      setError(res.message || 'Error creating user');
    }
  };

  const roleColor = (role) => {
    if (role === 'Supervisor' || role === 'Admin') return 'badge-orange';
    if (role === 'GroupLeader') return 'badge-blue';
    return 'badge-grey';
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Users</div>
            <div className="page-sub">Manage system users and roles</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add User
          </button>
        </div>

        {msg && <div className="alert-banner alert-success">Success: {msg}</div>}

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Group</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userID}>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${roleColor(u.role)}`}>{u.role}</span></td>
                    <td>{u.groupName || '-'}</td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-green' : 'badge-grey'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <div className="modal-title">Add New User</div>
                <button className="modal-close" onClick={() => setShowModal(false)}>x</button>
              </div>
              {error && <div className="alert-banner alert-danger">Warning: {error}</div>}
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-control" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input type="password" className="form-control" value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-control" value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="Member">Member</option>
                    <option value="GroupLeader">Group Leader</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                </div>
                {form.role !== 'Supervisor' && (
                  <div className="form-group">
                    <label className="form-label">Group Name</label>
                    <input
                      className="form-control"
                      value={form.groupName}
                      onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                      placeholder="e.g. BBIT-Group-7"
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline"
                    onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create User</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
