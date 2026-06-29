import { useState } from 'react';
import { changeUserPassword } from '../services/localStorageService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function ChangePasswordPage() {
  const { userProfile } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (form.newPassword.length < 4) {
      toast.error('Password must be at least 4 characters long.');
      return;
    }

    setSaving(true);
    try {
      await changeUserPassword(userProfile.id, form.currentPassword, form.newPassword);
      toast.success('Password changed successfully.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to update password.');
    }
    setSaving(false);
  };

  return (
    <div className="project-list-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="list-header" style={{ marginBottom: 'var(--sp-xl)' }}>
        <div>
          <h1 className="list-title">🔑 Change Password</h1>
          <p className="list-subtitle">Update your password to keep your account secure.</p>
        </div>
      </div>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 'var(--sp-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600 }}>Current Password *</label>
            <input
              type="password"
              className="form-input"
              value={form.currentPassword}
              onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label style={{ fontWeight: 600 }}>New Password *</label>
            <input
              type="password"
              className="form-input"
              value={form.newPassword}
              onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label style={{ fontWeight: 600 }}>Confirm New Password *</label>
            <input
              type="password"
              className="form-input"
              value={form.confirmPassword}
              onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-sm)' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
