import { useState, useEffect } from 'react';
import { useConfirmDialog } from './ConfirmDialog';
import { useToast } from '../contexts/ToastContext';

const ROLES = ['Client', 'Architect', 'Contractor', 'Vendor', 'Supervisor', 'Engineer', 'Consultant', 'Other'];

export default function ContactsDirectory({ projectId, canEdit, contacts, addContact, updateContact, deleteContact }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [form, setForm] = useState({ name: '', role: 'Client', phone: '', email: '', company: '', notes: '' });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const resetForm = () => { setForm({ name: '', role: 'Client', phone: '', email: '', company: '', notes: '' }); setEditId(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) { await updateContact(projectId, editId, form); toast.success('Contact updated'); }
    else { await addContact(projectId, form); toast.success('Contact added'); }
    resetForm();
  };

  const handleEdit = (c) => {
    setForm({ name: c.name || '', role: c.role || 'Client', phone: c.phone || '', email: c.email || '', company: c.company || '', notes: c.notes || '' });
    setEditId(c.id); setShowForm(true);
  };

  const handleDelete = async (c) => {
    const ok = await confirm({ title: 'Delete Contact', message: `Remove ${c.name} from this project?`, confirmText: 'Delete', danger: true });
    if (ok) { await deleteContact(projectId, c.id); toast.success('Contact deleted'); }
  };

  const filtered = contacts.filter(c => {
    if (filterRole && c.role !== filterRole) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (c.name || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="module-container">
      {dialog}
      <div className="module-header">
        <h2 className="section-title">👥 Contacts Directory</h2>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" placeholder="Search contacts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ maxWidth: 200, height: 38, fontSize: '0.82rem' }} />
          <select className="form-select" value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ maxWidth: 140, height: 38 }}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Add Contact</button>}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editId ? 'Edit' : 'Add'} Contact</h3><button className="modal-close" onClick={resetForm}>✕</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid-2">
                <div className="form-group"><label>Name *</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Full name" /></div>
                <div className="form-group"><label>Role</label><select className="form-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label>Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" /></div>
                <div className="form-group"><label>Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" /></div>
              </div>
              <div className="form-group"><label>Company / Firm</label><input className="form-input" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Company name" /></div>
              <div className="form-group"><label>Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional notes..." style={{ minHeight: 60 }} /></div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId ? '✓ Update' : '+ Add Contact'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {filtered.length === 0 && <div className="empty-state"><p>{contacts.length === 0 ? 'No contacts added yet.' : 'No contacts match your search.'}</p></div>}

      <div className="contacts-grid">
        {filtered.map(c => (
          <div key={c.id} className="contact-card">
            <div className="contact-card-top">
              <div className="contact-avatar">{(c.name || '?').charAt(0).toUpperCase()}</div>
              <div className="contact-info">
                <div className="contact-name">{c.name}</div>
                <div className="contact-role-badge">{c.role}</div>
                {c.company && <div className="contact-company">{c.company}</div>}
              </div>
            </div>
            <div className="contact-card-bottom">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="contact-action-btn" title="Call">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>{c.phone}</span>
                </a>
              )}
              {c.phone && (
                <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="contact-action-btn contact-wa" title="WhatsApp">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  <span>WhatsApp</span>
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="contact-action-btn" title="Email">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span>{c.email}</span>
                </a>
              )}
            </div>
            {canEdit && (
              <div className="contact-card-actions">
                <button className="expense-action-btn" onClick={() => handleEdit(c)} title="Edit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button className="expense-action-btn del" onClick={() => handleDelete(c)} title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
