import { useState } from 'react';
import { updateTask } from '../services/localStorageService';
import { toInputDate } from '../utils/helpers';

const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Delayed'];

export default function TaskEditor({ task, projectId, onClose, phases = [] }) {
  const [form, setForm] = useState({
    taskNo: task.taskNo || '',
    activity: task.activity || '',
    phase: task.phase || '',
    trade: task.trade || '',
    structuralZone: task.structuralZone || '',
    duration: task.duration || '',
    plannedStart: toInputDate(task.plannedStart),
    plannedFinish: toInputDate(task.plannedFinish),
    actualStart: toInputDate(task.actualStart),
    actualFinish: toInputDate(task.actualFinish),
    status: task.status || 'Not Started',
    remarks: task.remarks || '',
  });
  const [saving, setSaving] = useState(false);
  const [newPhase, setNewPhase] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates = {
        taskNo: form.taskNo,
        activity: form.activity,
        phase: form.phase === '__new__' ? newPhase : form.phase,
        trade: form.trade,
        structuralZone: form.structuralZone,
        duration: form.duration ? Number(form.duration) : null,
        plannedStart: form.plannedStart ? new Date(form.plannedStart) : null,
        plannedFinish: form.plannedFinish ? new Date(form.plannedFinish) : null,
        actualStart: form.actualStart ? new Date(form.actualStart) : null,
        actualFinish: form.actualFinish ? new Date(form.actualFinish) : null,
        status: form.status,
        remarks: form.remarks,
      };

      // Auto-set actual dates based on status changes
      if (form.status === 'In Progress' && !form.actualStart) {
        updates.actualStart = new Date();
      }
      if (form.status === 'Completed') {
        if (!form.actualStart) updates.actualStart = new Date();
        if (!form.actualFinish) updates.actualFinish = new Date();
      }

      await updateTask(projectId, task.id, updates);
      onClose();
    } catch (err) {
      console.error('Error saving task:', err);
      alert('Failed to save task. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dark)" strokeWidth="2" style={{ marginRight: 8, verticalAlign: 'middle' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Task — {task.taskNo}
          </h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} className="task-edit-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Task Number</label>
              <input className="form-input" name="taskNo" value={form.taskNo} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Activity Description</label>
            <input className="form-input" name="activity" value={form.activity} onChange={handleChange} required />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Phase</label>
              <select className="form-select" name="phase" value={form.phase} onChange={handleChange}>
                {phases.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="__new__">+ New Phase</option>
              </select>
              {form.phase === '__new__' && (
                <input
                  className="form-input"
                  placeholder="Enter new phase name"
                  value={newPhase}
                  onChange={(e) => setNewPhase(e.target.value)}
                  style={{ marginTop: 8 }}
                  required
                />
              )}
            </div>
            <div className="form-group">
              <label>Trade / Subcontractor</label>
              <input className="form-input" name="trade" value={form.trade} onChange={handleChange} placeholder="e.g. Electrical" />
            </div>
          </div>

          <div className="form-group">
            <label>Structural Zone</label>
            <input className="form-input" name="structuralZone" value={form.structuralZone} onChange={handleChange} placeholder="e.g. Zone 1 (front block)" />
          </div>

          <div className="edit-section-divider">
            <span>Planned Schedule</span>
          </div>
          <div className="form-grid-2" style={{ marginTop: 0 }}>
            <div className="form-group">
              <label>Planned Start</label>
              <input className="form-input" type="date" name="plannedStart" value={form.plannedStart} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Planned Finish</label>
              <input className="form-input" type="date" name="plannedFinish" value={form.plannedFinish} onChange={handleChange} />
            </div>
          </div>

          <div className="edit-section-divider">
            <span>Actual Progress</span>
          </div>
          <div className="form-grid-2" style={{ marginTop: 0 }}>
            <div className="form-group">
              <label>Actual Start</label>
              <input className="form-input" type="date" name="actualStart" value={form.actualStart} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Actual Finish</label>
              <input className="form-input" type="date" name="actualFinish" value={form.actualFinish} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label>Duration (days)</label>
            <input className="form-input" name="duration" type="number" min="0" value={form.duration} onChange={handleChange} style={{ maxWidth: 200 }} />
          </div>

          <div className="form-group">
            <label>Remarks / Notes</label>
            <textarea className="form-textarea" name="remarks" value={form.remarks} onChange={handleChange} placeholder="Site observations, issues, notes..." />
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : '✓ Save Changes'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
