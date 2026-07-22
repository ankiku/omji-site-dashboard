import { useState } from 'react';
import { useConfirmDialog } from './ConfirmDialog';
import { useToast } from '../contexts/ToastContext';

export default function MeetingMinutes({ projectId, canEdit, meetings, addMeeting, updateMeeting, deleteMeeting }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0], title: '', attendees: '',
    agenda: '', discussion: '', decisions: '', actionItems: ''
  });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const resetForm = () => {
    setForm({ date: new Date().toISOString().split('T')[0], title: '', attendees: '', agenda: '', discussion: '', decisions: '', actionItems: '' });
    setEditId(null); setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) { await updateMeeting(projectId, editId, form); toast.success('Meeting updated'); }
    else { await addMeeting(projectId, form); toast.success('Meeting logged'); }
    resetForm();
  };

  const handleEdit = (m) => {
    setForm({ date: m.date || '', title: m.title || '', attendees: m.attendees || '', agenda: m.agenda || '', discussion: m.discussion || '', decisions: m.decisions || '', actionItems: m.actionItems || '' });
    setEditId(m.id); setShowForm(true);
  };

  const handleDelete = async (m) => {
    const ok = await confirm({ title: 'Delete Meeting', message: `Delete meeting "${m.title}"?`, confirmText: 'Delete', danger: true });
    if (ok) { await deleteMeeting(projectId, m.id); toast.success('Meeting deleted'); }
  };

  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

  return (
    <div className="module-container">
      {dialog}
      <div className="module-header">
        <h2 className="section-title">🤝 Meeting Minutes</h2>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ New Meeting</button>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editId ? 'Edit' : 'Log'} Meeting</h3><button className="modal-close" onClick={resetForm}>✕</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid-2">
                <div className="form-group"><label>Date *</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required /></div>
                <div className="form-group"><label>Meeting Title *</label><input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. Weekly Site Review" /></div>
              </div>
              <div className="form-group"><label>Attendees</label><input className="form-input" value={form.attendees} onChange={e => setForm(p => ({ ...p, attendees: e.target.value }))} placeholder="Mr. Jain, Ar. Sharma, Site Engineer..." /></div>
              <div className="form-group"><label>Agenda</label><textarea className="form-textarea" value={form.agenda} onChange={e => setForm(p => ({ ...p, agenda: e.target.value }))} placeholder="Topics to discuss..." style={{ minHeight: 60 }} /></div>
              <div className="form-group"><label>Discussion Points</label><textarea className="form-textarea" value={form.discussion} onChange={e => setForm(p => ({ ...p, discussion: e.target.value }))} placeholder="Key discussion points..." style={{ minHeight: 80 }} /></div>
              <div className="form-group"><label>Decisions Made</label><textarea className="form-textarea" value={form.decisions} onChange={e => setForm(p => ({ ...p, decisions: e.target.value }))} placeholder="Decisions & approvals..." style={{ minHeight: 60 }} /></div>
              <div className="form-group"><label>Action Items</label><textarea className="form-textarea" value={form.actionItems} onChange={e => setForm(p => ({ ...p, actionItems: e.target.value }))} placeholder="Action items with assignees..." style={{ minHeight: 60 }} /></div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId ? '✓ Update' : '+ Log Meeting'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {meetings.length === 0 && <div className="empty-state"><p>No meetings recorded yet.{canEdit ? ' Log your first meeting.' : ''}</p></div>}

      <div className="log-list">
        {meetings.map(m => (
          <div key={m.id} className="log-card meeting-card">
            <div className="log-card-header" onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} style={{ cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <span className="log-date">{fmtDate(m.date)}</span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', marginLeft: 'var(--sp-sm)' }}>{m.title}</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'center' }}>
                {m.actionItems && <span className="log-badge">📌 Action Items</span>}
                {canEdit && (
                  <>
                    <button className="expense-action-btn" onClick={(e) => { e.stopPropagation(); handleEdit(m); }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button className="expense-action-btn del" onClick={(e) => { e.stopPropagation(); handleDelete(m); }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                  </>
                )}
                <span className="task-chevron" style={{ transform: expandedId === m.id ? 'rotate(180deg)' : 'none' }}>▾</span>
              </div>
            </div>
            {expandedId === m.id && (
              <div className="log-card-body" style={{ animation: 'slideDown 0.2s ease-out' }}>
                {m.attendees && <div className="meeting-section"><strong>Attendees:</strong><p>{m.attendees}</p></div>}
                {m.agenda && <div className="meeting-section"><strong>Agenda:</strong><p>{m.agenda}</p></div>}
                {m.discussion && <div className="meeting-section"><strong>Discussion:</strong><p style={{ whiteSpace: 'pre-wrap' }}>{m.discussion}</p></div>}
                {m.decisions && <div className="meeting-section meeting-decisions"><strong>✓ Decisions:</strong><p style={{ whiteSpace: 'pre-wrap' }}>{m.decisions}</p></div>}
                {m.actionItems && <div className="meeting-section meeting-actions"><strong>📌 Action Items:</strong><p style={{ whiteSpace: 'pre-wrap' }}>{m.actionItems}</p></div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
