import { useState, useEffect } from 'react';
import { addChecklist, updateChecklist, deleteChecklist, subscribeToChecklists } from '../services/localStorageService';

const TEMPLATES = {
  'RCC Casting': ['Shuttering alignment checked', 'Reinforcement cover verified', 'Bar bending schedule matched', 'Vibrator available', 'Cube samples taken', 'Curing arrangement ready', 'Level & plumb checked'],
  'Waterproofing': ['Surface cleaned & dried', 'Primer coat applied', 'Membrane laid properly', 'Overlap joints sealed', 'Flood test done', 'No leakage observed'],
  'Plastering': ['Wall surface cleaned', 'Chicken mesh at junctions', 'Dot/Guide marks done', 'Mix ratio verified', 'Thickness maintained', 'Curing started'],
  'Electrical': ['Conduit layout verified', 'Wire pulling done', 'Earthing connected', 'DB box mounted', 'Switch board level', 'Insulation test passed'],
  'Plumbing': ['Pipe layout verified', 'Pressure test done', 'Slope for drainage checked', 'No leakage at joints', 'Water meter installed'],
  'Tile Work': ['Surface leveling done', 'Layout pattern marked', 'Adhesive mix correct', 'Spacers used', 'Grouting done', 'Cleaning completed'],
};

export default function QualityChecklist({ projectId, canEdit }) {
  const [checklists, setChecklists] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', activity: '', inspector: '', date: new Date().toISOString().split('T')[0], items: [], notes: '' });
  const [editId, setEditId] = useState(null);

  useEffect(() => { return subscribeToChecklists(projectId, setChecklists); }, [projectId]);

  const resetForm = () => { setForm({ title: '', activity: '', inspector: '', date: new Date().toISOString().split('T')[0], items: [], notes: '' }); setEditId(null); setShowForm(false); };

  const applyTemplate = (templateName) => {
    const items = TEMPLATES[templateName].map(text => ({ text, status: 'pending', remark: '' }));
    setForm(p => ({ ...p, title: templateName + ' Checklist', activity: templateName, items }));
  };

  const addItem = () => { setForm(p => ({ ...p, items: [...p.items, { text: '', status: 'pending', remark: '' }] })); };
  const updateItem = (idx, field, value) => { setForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], [field]: value }; return { ...p, items }; }); };
  const removeItem = (idx) => { setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) await updateChecklist(projectId, editId, form);
    else await addChecklist(projectId, form);
    resetForm();
  };

  const handleEdit = (c) => { setForm({ title: c.title || '', activity: c.activity || '', inspector: c.inspector || '', date: c.date || '', items: c.items || [], notes: c.notes || '' }); setEditId(c.id); setShowForm(true); };

  const toggleItemStatus = async (checklistId, checklist, idx) => {
    if (!canEdit) return;
    const items = [...(checklist.items || [])];
    items[idx] = { ...items[idx], status: items[idx].status === 'pass' ? 'fail' : items[idx].status === 'fail' ? 'pending' : 'pass' };
    await updateChecklist(projectId, checklistId, { items });
  };

  return (
    <div className="module-container">
      <div className="module-header">
        <h2 className="section-title">✅ Quality Checklists</h2>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ New Checklist</button>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="modal-header"><h3>{editId ? 'Edit' : 'New'} Quality Checklist</h3><button className="modal-close" onClick={resetForm}>✕</button></div>
            <form onSubmit={handleSubmit}>
              {!editId && (
                <div className="form-group">
                  <label>Quick Templates</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.keys(TEMPLATES).map(t => (
                      <button key={t} type="button" className="preset-chip" onClick={() => applyTemplate(t)}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-grid-2">
                <div className="form-group"><label>Title *</label><input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. Slab Casting Checklist" /></div>
                <div className="form-group"><label>Activity</label><input className="form-input" value={form.activity} onChange={e => setForm(p => ({ ...p, activity: e.target.value }))} placeholder="e.g. Ground Floor Slab" /></div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label>Inspector</label><input className="form-input" value={form.inspector} onChange={e => setForm(p => ({ ...p, inspector: e.target.value }))} placeholder="Name" /></div>
                <div className="form-group"><label>Date</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
              </div>
              <div className="form-group">
                <label>Checklist Items</label>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <select className="form-select" value={item.status} onChange={e => updateItem(i, 'status', e.target.value)} style={{ width: 90, flexShrink: 0 }}>
                      <option value="pending">⬜</option><option value="pass">✅</option><option value="fail">❌</option>
                    </select>
                    <input className="form-input" value={item.text} onChange={e => updateItem(i, 'text', e.target.value)} placeholder="Check item..." style={{ flex: 1 }} />
                    <button type="button" className="expense-action-btn del" onClick={() => removeItem(i)}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-sm" onClick={addItem} style={{ marginTop: 4 }}>+ Add Item</button>
              </div>
              <div className="form-group"><label>Notes</label><input className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId ? '✓ Update' : '+ Create'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {checklists.length === 0 && <div className="empty-state"><p>No quality checklists created yet.{canEdit ? ' Use templates for quick setup.' : ''}</p></div>}

      {checklists.map(c => {
        const total = (c.items || []).length;
        const passed = (c.items || []).filter(i => i.status === 'pass').length;
        const failed = (c.items || []).filter(i => i.status === 'fail').length;
        const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
        return (
          <div key={c.id} className="checklist-card">
            <div className="checklist-card-header">
              <div style={{ flex: 1 }}>
                <strong>{c.title}</strong>
                <div className="expense-meta" style={{ marginTop: 4 }}>
                  {c.inspector && <span>👤 {c.inspector}</span>}
                  {c.date && <span>📅 {c.date}</span>}
                  <span style={{ color: failed > 0 ? 'var(--rust)' : 'var(--green)', fontWeight: 700 }}>{passed}/{total} passed</span>
                </div>
              </div>
              <div className="checklist-score" style={{ color: pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--rust)' }}>{pct}%</div>
              {canEdit && (
                <div className="expense-actions">
                  <button className="expense-action-btn" onClick={() => handleEdit(c)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button className="expense-action-btn del" onClick={() => { if (confirm('Delete?')) deleteChecklist(projectId, c.id); }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
              )}
            </div>
            <div className="checklist-items">
              {(c.items || []).map((item, i) => (
                <div key={i} className={`checklist-item checklist-${item.status}`} onClick={() => toggleItemStatus(c.id, c, i)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                  <span className="checklist-status">{item.status === 'pass' ? '✅' : item.status === 'fail' ? '❌' : '⬜'}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
