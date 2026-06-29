import { useState, useEffect } from 'react';
import { subscribeToUsers, createUser, updateUser, deleteUser, getAllProjects } from '../services/localStorageService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../components/ConfirmDialog';

export default function UsersPage() {
  const { userProfile } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'editor',
    assignedProjectIds: []
  });

  useEffect(() => {
    // Load projects list for project assignment
    const loadProjects = async () => {
      const list = await getAllProjects();
      setProjects(list);
    };
    loadProjects();

    // Subscribe to users list
    return subscribeToUsers(setUsers);
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'editor',
      assignedProjectIds: []
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (u) => {
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: u.password || '',
      role: u.role || 'editor',
      assignedProjectIds: u.assignedProjectIds || []
    });
    setEditId(u.id);
    setShowForm(true);
  };

  const handleDelete = async (id, email) => {
    if (id === 'admin-001') {
      toast.error('The primary admin account cannot be deleted.');
      return;
    }
    if (id === userProfile.id) {
      toast.error('You cannot delete your own account while logged in.');
      return;
    }
    const ok = await confirm({
      title: 'Delete User Account',
      message: `Are you sure you want to delete access for ${email}? This action is permanent.`,
      confirmText: 'Delete Access',
      danger: true
    });
    if (ok) {
      try {
        await deleteUser(id);
        toast.success('User deleted successfully');
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await updateUser(editId, form);
        toast.success('User updated successfully');
      } else {
        await createUser(form);
        toast.success('User account created successfully');
      }
      resetForm();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleProjectToggle = (projectId) => {
    setForm(prev => {
      const current = prev.assignedProjectIds;
      const updated = current.includes(projectId)
        ? current.filter(id => id !== projectId)
        : [...current, projectId];
      return { ...prev, assignedProjectIds: updated };
    });
  };

  return (
    <div className="project-list-container">
      {dialog}
      <div className="list-header" style={{ marginBottom: 'var(--sp-xl)' }}>
        <div>
          <h1 className="list-title">👥 User Access Management</h1>
          <p className="list-subtitle">Manage user permissions, roles, and project assignments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          + Add User Account
        </button>
      </div>

      <div className="grid-layout">
        {users.map(u => {
          const userProjects = projects.filter(p => u.assignedProjectIds?.includes(p.id));
          return (
            <div key={u.id} className="project-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '200px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className={`expense-cat-badge ${u.role === 'admin' ? 'rust' : 'gold'}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    {u.role}
                  </span>
                  <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--concrete)' }}>ID: {u.id}</span>
                </div>
                <h3 className="project-card-title">{u.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--concrete)', marginBottom: 14 }}>{u.email}</p>
                
                {u.role === 'admin' ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink)', fontStyle: 'italic' }}>
                    ★ Full access to all projects
                  </p>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                      Assigned Projects ({userProjects.length}):
                    </div>
                    {userProjects.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--rust)' }}>No projects assigned (View Only)</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {userProjects.map(p => (
                          <span key={p.id} className="expense-cat-badge" style={{ fontSize: '0.68rem', background: 'var(--paper-2)', color: 'var(--ink)' }}>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-sm)', marginTop: 20, borderTop: '1px solid var(--hairline)', paddingTop: 12 }}>
                <button className="btn btn-outline btn-sm" onClick={() => handleEdit(u)} style={{ height: '32px', fontSize: '0.75rem' }}>
                  Edit
                </button>
                {u.id !== 'admin-001' && u.id !== userProfile.id && (
                  <button className="btn btn-outline btn-sm btn-danger" onClick={() => handleDelete(u.id, u.email)} style={{ height: '32px', fontSize: '0.75rem', borderColor: 'var(--rust)', color: 'var(--rust)' }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? '✏️ Edit User Details' : '👥 Add New User Account'}</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Ramesh Sharma" />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select className="form-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                    <option value="editor">Editor (Limited Project Access)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Email Address *</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required placeholder="e.g. ramesh@omji.in" />
                </div>
                <div className="form-group">
                  <label>{editId ? 'Password (Leave to keep current)' : 'Password *'}</label>
                  <input className="form-input" type="text" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required={!editId} placeholder="e.g. securePass123" />
                </div>
              </div>

              {form.role === 'editor' && (
                <div className="form-group" style={{ marginTop: 'var(--sp-md)' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Assign Projects</label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '12px', background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {projects.map(p => {
                      const checked = form.assignedProjectIds.includes(p.id);
                      return (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
                          <input type="checkbox" checked={checked} onChange={() => handleProjectToggle(p.id)} />
                          <span>{p.name}</span>
                        </label>
                      );
                    })}
                    {projects.length === 0 && <span style={{ color: 'var(--concrete)', fontSize: '0.85rem' }}>No projects available to assign.</span>}
                  </div>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: 'var(--sp-lg)' }}>
                <button type="submit" className="btn btn-primary">
                  {editId ? 'Save Changes' : 'Create Account'}
                </button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
