import { useState, useEffect } from 'react';
import TaskCard from './TaskCard';
import ProgressBar from './ProgressBar';
import { addTask } from '../services/localStorageService';

const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Delayed'];

export default function ScheduleTab({
  tasks,
  phases,
  phaseFilter,
  setPhaseFilter,
  setActiveTab,
  projectId,
  canEdit,
  onPhotoClick
}) {
  const [expandedPhases, setExpandedPhases] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);

  // Expand the selected phase if phaseFilter changes
  useEffect(() => {
    if (phaseFilter) {
      setExpandedPhases(prev => ({ ...prev, [phaseFilter]: true }));
    }
  }, [phaseFilter]);

  const togglePhase = (phase) => {
    setExpandedPhases(prev => ({ ...prev, [phase]: !prev[phase] }));
  };

  const expandAll = () => {
    const all = {};
    phases.forEach(p => { all[p] = true; });
    setExpandedPhases(all);
  };

  const collapseAll = () => {
    setExpandedPhases({});
  };

  // Group tasks by phase, applying search query if present
  const tasksByPhase = {};
  phases.forEach(phase => {
    const phaseTasks = tasks.filter(t => t.phase === phase);
    const matchedTasks = phaseTasks.filter(t => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        t.activity?.toLowerCase().includes(query) ||
        t.taskNo?.toLowerCase().includes(query) ||
        t.trade?.toLowerCase().includes(query)
      );
    });
    tasksByPhase[phase] = matchedTasks;
  });

  return (
    <div className="schedule-tab-container">
      {/* Controls Bar */}
      <div className="schedule-controls" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--sp-sm)',
        marginBottom: 'var(--sp-lg)',
        paddingBottom: 'var(--sp-md)',
        borderBottom: '1px solid var(--hairline)'
      }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search tasks, task numbers, or trades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '38px',
              height: '42px',
              borderRadius: 'var(--radius)'
            }}
          />
          <svg
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '18px',
              height: '18px',
              color: 'var(--concrete)',
              pointerEvents: 'none'
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddTask(true)} style={{ gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Task
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={expandAll}>Expand All</button>
          <button className="btn btn-outline btn-sm" onClick={collapseAll}>Collapse All</button>
          {phaseFilter && (
            <button className="btn btn-outline btn-sm" onClick={() => setPhaseFilter(null)} style={{ borderColor: 'var(--gold)' }}>Clear Filter</button>
          )}
        </div>
      </div>

      {/* Active Phase Filter Alert / Back Navigation */}
      {phaseFilter && (
        <div className="phase-filter-alert" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px var(--sp-md)',
          background: 'var(--gold-light)',
          border: '1px solid var(--gold)',
          borderRadius: 'var(--radius)',
          marginBottom: 'var(--sp-md)',
          fontSize: '0.85rem',
          flexWrap: 'wrap',
          gap: 'var(--sp-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1.1rem' }}>📂</span>
            <span>Showing tasks for Phase: <strong style={{ color: 'var(--ink)' }}>{phaseFilter}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-xs)' }}>
            {setActiveTab && (
              <button className="btn btn-outline btn-xs" onClick={() => { setActiveTab('dashboard'); setPhaseFilter(null); }} style={{ height: '28px', fontSize: '0.72rem' }}>
                ← Back to Dashboard
              </button>
            )}
            <button className="btn btn-primary btn-xs" onClick={() => setPhaseFilter(null)} style={{ height: '28px', fontSize: '0.72rem', background: 'var(--ink)', color: '#fff', border: 'none' }}>
              Show Full Schedule
            </button>
          </div>
        </div>
      )}

      {/* Grouped Phases List */}
      <div className="phase-accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
        {phases.map(phase => {
          // If a phase filter is active and doesn't match this phase, hide it
          if (phaseFilter && phaseFilter !== phase) return null;

          const matchedTasks = tasksByPhase[phase] || [];
          const allPhaseTasks = tasks.filter(t => t.phase === phase);
          
          // Skip rendering if we are searching and there are zero matched tasks in this phase
          if (searchQuery && matchedTasks.length === 0) return null;

          const isExpanded = !!expandedPhases[phase];
          
          // Stats calculated from all tasks in this phase
          const completedCount = allPhaseTasks.filter(t => t.status === 'Completed').length;
          const delayedCount = allPhaseTasks.filter(t => t.status === 'Delayed').length;
          const totalCount = allPhaseTasks.length;
          const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          // Border color styling based on phase status
          let indicatorColor = 'var(--concrete)';
          if (percent === 100) {
            indicatorColor = 'var(--green)';
          } else if (delayedCount > 0) {
            indicatorColor = 'var(--rust)';
          } else if (completedCount > 0) {
            indicatorColor = 'var(--amber)';
          }

          return (
            <div
              key={phase}
              className={`phase-card ${isExpanded ? 'expanded' : ''}`}
              style={{
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius)',
                background: 'var(--paper)',
                overflow: 'hidden',
                boxShadow: isExpanded ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Accordion Header */}
              <div
                className="phase-card-header"
                onClick={() => togglePhase(phase)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  background: isExpanded ? 'var(--gold-light)' : 'linear-gradient(to right, var(--paper-2), #FFFFFF)',
                  userSelect: 'none',
                  borderBottom: isExpanded ? '1px solid var(--hairline)' : 'none',
                  transition: 'background-color 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: '4px',
                      height: '24px',
                      borderRadius: '2px',
                      background: indicatorColor,
                      flexShrink: 0
                    }}
                  />
                  <h3
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: '700',
                      fontFamily: 'var(--font-display)',
                      color: 'var(--ink)',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'normal'
                    }}
                  >
                    {phase}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', marginLeft: 'var(--sp-md)', flexShrink: 0 }}>
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--concrete)', fontWeight: '600' }}>
                    {completedCount}/{totalCount} Completed
                    {delayedCount > 0 && (
                      <span style={{ color: 'var(--rust)', marginLeft: '6px' }}>
                        · {delayedCount} Delayed
                      </span>
                    )}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', display: 'none' }}> {/* Optional small progress bar */}
                      <ProgressBar percent={percent} />
                    </div>
                    <span className="phase-progress-pct" style={{
                      minWidth: '40px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      color: 'var(--gold-dark)'
                    }}>
                      {percent}%
                    </span>
                  </div>

                  <span
                    className="task-chevron"
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      color: 'var(--concrete)',
                      fontSize: '0.9rem',
                      display: 'inline-block'
                    }}
                  >
                    ▾
                  </span>
                </div>
              </div>

              {/* Accordion Body */}
              {isExpanded && (
                <div
                  className="phase-card-body"
                  style={{
                    padding: 'var(--sp-md) var(--sp-md) var(--sp-sm)',
                    background: 'var(--paper-2)'
                  }}
                >
                  {matchedTasks.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--sp-lg)' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--concrete)' }}>
                        No tasks matching the search criteria.
                      </p>
                    </div>
                  ) : (
                    matchedTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        projectId={projectId}
                        canEdit={canEdit}
                        onPhotoClick={onPhotoClick}
                        phases={phases}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Global Empty State */}
        {phases.length === 0 && (
          <div className="empty-state">
            <p>No phases found in the project schedule.{canEdit ? ' Add your first task to get started.' : ''}</p>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <AddTaskModal projectId={projectId} phases={phases} tasks={tasks} onClose={() => setShowAddTask(false)} />
      )}
    </div>
  );
}

/* ─── Add Task Modal ─── */
function AddTaskModal({ projectId, phases, tasks, onClose }) {
  const [form, setForm] = useState({
    taskNo: String((tasks.length || 0) + 1),
    activity: '', phase: phases[0] || 'General', trade: '',
    duration: '', plannedStart: '', plannedFinish: '',
    status: 'Not Started', remarks: ''
  });
  const [newPhase, setNewPhase] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addTask(projectId, {
        taskNo: form.taskNo,
        activity: form.activity,
        phase: form.phase === '__new__' ? newPhase : form.phase,
        trade: form.trade,
        duration: form.duration ? Number(form.duration) : null,
        plannedStart: form.plannedStart ? new Date(form.plannedStart) : null,
        plannedFinish: form.plannedFinish ? new Date(form.plannedFinish) : null,
        status: form.status,
        remarks: form.remarks,
        order: (tasks.length || 0) + 1,
      });
      onClose();
    } catch (err) {
      alert('Failed to add task: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>➕ Add New Task</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group"><label>Task Number</label><input className="form-input" name="taskNo" value={form.taskNo} onChange={handleChange} /></div>
            <div className="form-group"><label>Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label>Activity Description *</label><input className="form-input" name="activity" value={form.activity} onChange={handleChange} required placeholder="e.g. Foundation PCC work" /></div>
          <div className="form-grid-2">
            <div className="form-group"><label>Phase</label>
              <select className="form-select" name="phase" value={form.phase} onChange={handleChange}>
                {phases.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="__new__">+ New Phase</option>
              </select>
              {form.phase === '__new__' && <input className="form-input" placeholder="Enter phase name" value={newPhase} onChange={e => setNewPhase(e.target.value)} style={{ marginTop: 8 }} required />}
            </div>
            <div className="form-group"><label>Trade</label><input className="form-input" name="trade" value={form.trade} onChange={handleChange} placeholder="e.g. Civil" /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label>Planned Start</label><input className="form-input" type="date" name="plannedStart" value={form.plannedStart} onChange={handleChange} /></div>
            <div className="form-group"><label>Planned Finish</label><input className="form-input" type="date" name="plannedFinish" value={form.plannedFinish} onChange={handleChange} /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label>Duration (days)</label><input className="form-input" name="duration" type="number" min="0" value={form.duration} onChange={handleChange} /></div>
            <div className="form-group"><label>Remarks</label><input className="form-input" name="remarks" value={form.remarks} onChange={handleChange} placeholder="Optional notes" /></div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : '+ Add Task'}</button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
