import { useState, useEffect, useMemo } from 'react';
import { addIssue, updateIssue, deleteIssue, subscribeToIssues } from '../services/localStorageService';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from './ConfirmDialog';

const PRIORITIES = ['Critical', 'Major', 'Minor'];
const ISSUE_STATUS = ['Open', 'In Progress', 'Resolved', 'Closed'];
const ISSUE_TYPES = ['Defect', 'Snag', 'NCR (Non-Conformance)', 'Safety Hazard', 'Design Clash', 'Material Defect', 'Other'];

export default function IssueTracker({ projectId, canEdit }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const [issues, setIssues] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [form, setForm] = useState({
    title: '',
    type: 'Snag',
    priority: 'Major',
    status: 'Open',
    assignedTo: '',
    location: '',
    description: '',
    resolution: '',
    reportedDate: new Date().toISOString().split('T')[0],
    resolvedDate: '',
    rectificationCost: '',
    blockerStatus: false,
    qaSignOff: false
  });

  useEffect(() => {
    return subscribeToIssues(projectId, setIssues);
  }, [projectId]);

  const resetForm = () => {
    setForm({
      title: '',
      type: 'Snag',
      priority: 'Major',
      status: 'Open',
      assignedTo: '',
      location: '',
      description: '',
      resolution: '',
      reportedDate: new Date().toISOString().split('T')[0],
      resolvedDate: '',
      rectificationCost: '',
      blockerStatus: false,
      qaSignOff: false
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        rectificationCost: form.rectificationCost ? parseFloat(form.rectificationCost) : ''
      };
      if (editId) {
        await updateIssue(projectId, editId, data);
        toast.success('Snag record updated successfully');
      } else {
        await addIssue(projectId, data);
        toast.success('Snag registered successfully');
      }
      resetForm();
    } catch (err) {
      toast.error('Error saving snag: ' + err.message);
    }
  };

  const handleEdit = (issue) => {
    setForm({
      title: issue.title || '',
      type: issue.type || 'Snag',
      priority: issue.priority || 'Major',
      status: issue.status || 'Open',
      assignedTo: issue.assignedTo || '',
      location: issue.location || '',
      description: issue.description || '',
      resolution: issue.resolution || '',
      reportedDate: issue.reportedDate || '',
      resolvedDate: issue.resolvedDate || '',
      rectificationCost: issue.rectificationCost || '',
      blockerStatus: !!issue.blockerStatus,
      qaSignOff: !!issue.qaSignOff
    });
    setEditId(issue.id);
    setShowForm(true);
  };

  const handleDelete = async (issueId) => {
    const ok = await confirm({
      title: 'Delete Snag Item',
      message: 'Are you sure you want to permanently delete this snag listing?',
      confirmText: 'Delete',
      danger: true
    });
    if (ok) {
      try {
        await deleteIssue(projectId, issueId);
        toast.success('Snag record removed');
      } catch (err) {
        toast.error('Failed to delete snag: ' + err.message);
      }
    }
  };

  // Computations
  const stats = useMemo(() => {
    const total = issues.length;
    const active = issues.filter(i => i.status === 'Open' || i.status === 'In Progress').length;
    const critical = issues.filter(i => i.priority === 'Critical' && i.status !== 'Closed' && i.status !== 'Resolved').length;
    const totalRectificationCost = issues.reduce((acc, curr) => acc + (parseFloat(curr.rectificationCost) || 0), 0);
    const resolved = issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;

    // Status breakdown
    const statusCounts = { Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0 };
    issues.forEach(i => {
      if (statusCounts[i.status] !== undefined) statusCounts[i.status]++;
    });

    return { total, active, critical, totalRectificationCost, resolutionRate, statusCounts };
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return issues.filter(i => {
      if (filterStatus && i.status !== filterStatus) return false;
      if (filterPriority && i.priority !== filterPriority) return false;
      if (searchTerm && !`${i.title} ${i.location} ${i.assignedTo} ${i.description}`.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [issues, filterStatus, filterPriority, searchTerm]);

  const priorityColor = (p) => p === 'Critical' ? 'var(--rust)' : p === 'Major' ? 'var(--amber)' : 'var(--concrete)';
  const statusColor = (s) => s === 'Open' ? 'var(--rust)' : s === 'In Progress' ? 'var(--amber)' : s === 'Resolved' ? 'var(--green)' : 'var(--concrete)';

  return (
    <div className="module-container">
      {dialog}
      <style dangerouslySetInnerHTML={{ __html: `
        .snag-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--sp-md);
          margin-bottom: var(--sp-lg);
        }
        .snag-kpi-card {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: var(--radius);
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          transition: all 0.2s;
        }
        .snag-kpi-card:hover {
          border-color: var(--gold);
          transform: translateY(-1px);
        }
        .snag-dashboard-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: var(--sp-lg);
          align-items: start;
        }
        @media (max-width: 800px) {
          .snag-dashboard-layout {
            grid-template-columns: 1fr;
          }
        }
        .status-pill-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .status-pill-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 6px 12px;
          background: var(--paper-2);
          border: 1px solid var(--hairline);
          border-radius: 6px;
        }
        .premium-issue-card {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: var(--radius);
          padding: 16px var(--sp-lg);
          margin-bottom: var(--sp-md);
          transition: all 0.2s;
        }
        .premium-issue-card:hover {
          border-color: var(--gold);
          box-shadow: var(--shadow-sm);
        }
      `}} />

      {/* Header */}
      <div className="module-header" style={{ marginBottom: 'var(--sp-md)' }}>
        <div>
          <h2 className="section-title">🛡️ QA snags & Defect registers</h2>
          <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--concrete)', marginTop: 2 }}>
            Field non-conformance logs, safety hazards, subcontractor rectifications, and QA approvals.
          </p>
        </div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Register Defect / Snag</button>}
      </div>

      {/* KPIs widgets */}
      <div className="snag-kpi-grid">
        <div className="snag-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Active Snags</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: stats.active > 0 ? 'var(--rust)' : 'var(--green)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {stats.active} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--concrete)' }}>/ {stats.total} total</span>
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Unresolved snags</span>
          </div>
        </div>

        <div className="snag-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Critical Blockers</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: stats.critical > 0 ? 'var(--rust)' : 'var(--ink)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {stats.critical}
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Blocking workflow</span>
          </div>
        </div>

        <div className="snag-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Estimated Rectification Cost</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              ₹{stats.totalRectificationCost.toLocaleString('en-IN')}
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Combined estimates</span>
          </div>
        </div>

        <div className="snag-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Resolution Rate</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {stats.resolutionRate}%
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Closed & approved</span>
          </div>
        </div>
      </div>

      {/* Main dashboard body */}
      <div className="snag-dashboard-layout">
        
        {/* Left Side: Status Breakdown widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: '14px' }}>
              📊 Status Breakdown
            </h4>
            
            <div className="status-pill-list">
              {Object.entries(stats.statusCounts).map(([status, count]) => {
                const color = statusColor(status);
                return (
                  <div key={status} className="status-pill-item">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }}></span>
                      {status}
                    </span>
                    <span className="mono" style={{ fontWeight: 700 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: List + Filter controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          
          {/* Controls */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto' }}>
                <option value="">All Statuses</option>
                {ISSUE_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="form-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto' }}>
                <option value="">All Priorities</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {(filterStatus || filterPriority) && (
                <button className="btn btn-outline btn-sm" onClick={() => { setFilterStatus(''); setFilterPriority(''); }} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                  Clear
                </button>
              )}
            </div>

            <input
              className="form-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search snags by description..."
              style={{ width: '220px', padding: '6px 12px', fontSize: '0.78rem' }}
            />
          </div>

          {/* Snags Feed List */}
          <div>
            {filteredIssues.length === 0 ? (
              <div className="empty-state" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)' }}>
                <p>No snag records found.</p>
              </div>
            ) : (
              filteredIssues.map(issue => (
                <div key={issue.id} className="premium-issue-card" style={{ borderLeft: issue.blockerStatus ? '4px solid var(--rust)' : '1px solid var(--hairline)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="issue-priority-dot" style={{ background: priorityColor(issue.priority) }} title={issue.priority} />
                        <strong style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>{issue.title}</strong>
                        {issue.blockerStatus && <span className="badge badge-delayed" style={{ fontSize: '0.6rem', padding: '2px 6px', fontWeight: 800 }}>🛑 BLOCKER</span>}
                        {issue.qaSignOff && <span className="badge badge-completed" style={{ fontSize: '0.6rem', padding: '2px 6px', fontWeight: 800 }}>✓ QA PASS</span>}
                      </div>

                      <div className="expense-meta" style={{ marginTop: 6, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span className="expense-cat-badge" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{issue.type}</span>
                        <span style={{ color: statusColor(issue.status), fontWeight: 700, fontSize: '0.72rem' }}>Status: {issue.status}</span>
                        {issue.location && <span>📍 Location: <strong>{issue.location}</strong></span>}
                        {issue.assignedTo && <span>👤 Assigned: <strong>{issue.assignedTo}</strong></span>}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div>
                        {issue.rectificationCost ? (
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--rust)', fontFamily: 'var(--font-mono)' }}>
                            ₹{parseFloat(issue.rectificationCost).toLocaleString('en-IN')}
                          </div>
                        ) : null}
                        <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--concrete)' }}>Reported: {issue.reportedDate}</div>
                      </div>

                      {canEdit && (
                        <div className="expense-actions">
                          <button className="expense-action-btn" onClick={() => handleEdit(issue)} title="Edit snag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="expense-action-btn del" onClick={() => handleDelete(issue.id)} title="Delete snag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {issue.description && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--ink-light)', marginTop: 8, background: 'var(--paper-2)', padding: '6px 10px', borderRadius: 4 }}>
                      {issue.description}
                    </p>
                  )}
                  {issue.resolution && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--concrete)', marginTop: 6 }}>
                      🔧 <strong>Method Statement:</strong> {issue.resolution}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

        </div>

      </div>

      {/* Modal form */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>{editId ? 'Modify' : 'Log QA'} Snag or Non-Conformance</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Defect Title / Stage *</label>
                <input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. Honeycombing visible on GF Column C3 base" />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Defect Type</label>
                  <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority / Severity</label>
                  <select className="form-select" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    {ISSUE_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Assigned Contractor / Trade</label>
                  <input className="form-input" value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} placeholder="e.g. Masonry Team A" />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Specific Location</label>
                  <input className="form-input" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Ground Floor, Column C3" />
                </div>
                <div className="form-group">
                  <label>Rectification Estimate (₹)</label>
                  <input type="number" className="form-input" value={form.rectificationCost} onChange={e => setForm(p => ({ ...p, rectificationCost: e.target.value }))} placeholder="e.g. 15000" />
                </div>
              </div>

              {/* Flags */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'var(--paper-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={form.blockerStatus} onChange={e => setForm(p => ({ ...p, blockerStatus: e.target.checked }))} />
                  <span style={{ color: form.blockerStatus ? 'var(--rust)' : 'var(--concrete)' }}>🛑 Blocks Work</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={form.qaSignOff} onChange={e => setForm(p => ({ ...p, qaSignOff: e.target.checked }))} />
                  <span style={{ color: form.qaSignOff ? 'var(--green)' : 'var(--concrete)' }}>✓ QA Approved</span>
                </label>
              </div>

              <div className="form-group">
                <label>Description of Issue</label>
                <textarea className="form-textarea" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Details about the non-conformance..." style={{ minHeight: 60 }} />
              </div>

              <div className="form-group">
                <label>Resolution Plan / Rectification Method Statement</label>
                <textarea className="form-textarea" value={form.resolution} onChange={e => setForm(p => ({ ...p, resolution: e.target.value }))} placeholder="MethodStatement: Epoxy injection / Re-casting / Patching..." style={{ minHeight: 60 }} />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Reported Date</label>
                  <input className="form-input" type="date" value={form.reportedDate} onChange={e => setForm(p => ({ ...p, reportedDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Resolved Date</label>
                  <input className="form-input" type="date" value={form.resolvedDate} onChange={e => setForm(p => ({ ...p, resolvedDate: e.target.value }))} />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 'var(--sp-md)' }}>
                <button type="submit" className="btn btn-primary">{editId ? '✓ Save Changes' : '+ Register Snag'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
