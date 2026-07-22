import { useState, useEffect, useMemo } from 'react';
import { addSiteLog, updateSiteLog, deleteSiteLog, subscribeToSiteLogs } from '../services/localStorageService';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from './ConfirmDialog';

const WEATHER_OPTIONS = ['☀️ Sunny', '⛅ Partly Cloudy', '☁️ Overcast', '🌧️ Rain', '⛈️ Heavy Rain', '🌫️ Foggy'];
const SHIFT_OPTIONS = ['Day Shift', 'Night Shift'];
const ACTIVITY_OPTIONS = [
  'Excavation',
  'Reinforcement / Steel Binding',
  'Shuttering / Formwork',
  'Concrete Pouring',
  'Masonry / Brickwork',
  'Plastering & Waterproofing',
  'MEP (Electrical/Plumbing)',
  'Painting & Finishing',
  'Site Cleanup'
];

export default function DailySiteLog({ projectId, canEdit }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [logs, setLogs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWeather, setFilterWeather] = useState('All');
  
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weather: '☀️ Sunny',
    shift: 'Day Shift',
    temperature: '',
    manpowerCount: '',
    supervisors: '',
    visitors: '',
    workSummary: '',
    activities: [],
    materialsUsed: '',
    issues: '',
    safetyIncident: false,
    safetyIncidentDetails: '',
    safetyNotes: ''
  });

  useEffect(() => {
    return subscribeToSiteLogs(projectId, setLogs);
  }, [projectId]);

  const resetForm = () => {
    setForm({
      date: new Date().toISOString().split('T')[0],
      weather: '☀️ Sunny',
      shift: 'Day Shift',
      temperature: '',
      manpowerCount: '',
      supervisors: '',
      visitors: '',
      workSummary: '',
      activities: [],
      materialsUsed: '',
      issues: '',
      safetyIncident: false,
      safetyIncidentDetails: '',
      safetyNotes: ''
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await updateSiteLog(projectId, editId, form);
        toast.success('Site log entry updated.');
      } else {
        await addSiteLog(projectId, form);
        toast.success('Daily site log logged.');
      }
      resetForm();
    } catch (err) {
      toast.error('Failed to save site log: ' + err.message);
    }
  };

  const handleEdit = (log) => {
    setForm({
      date: log.date || '',
      weather: log.weather || '☀️ Sunny',
      shift: log.shift || 'Day Shift',
      temperature: log.temperature || '',
      manpowerCount: log.manpowerCount || '',
      supervisors: log.supervisors || '',
      visitors: log.visitors || '',
      workSummary: log.workSummary || '',
      activities: Array.isArray(log.activities) ? log.activities : [],
      materialsUsed: log.materialsUsed || '',
      issues: log.issues || '',
      safetyIncident: !!log.safetyIncident,
      safetyIncidentDetails: log.safetyIncidentDetails || '',
      safetyNotes: log.safetyNotes || ''
    });
    setEditId(log.id);
    setShowForm(true);
  };

  const handleDelete = async (logId) => {
    const ok = await confirm({
      title: 'Delete Site Log',
      message: 'Delete this daily site log entry?',
      confirmText: 'Delete',
      danger: true
    });
    if (ok) {
      try {
        await deleteSiteLog(projectId, logId);
        toast.success('Entry deleted.');
      } catch (err) {
        toast.error('Failed to delete: ' + err.message);
      }
    }
  };

  const handleActivityToggle = (act) => {
    setForm(prev => {
      const activities = [...prev.activities];
      if (activities.includes(act)) {
        return { ...prev, activities: activities.filter(a => a !== act) };
      } else {
        return { ...prev, activities: [...activities, act] };
      }
    });
  };

  // Computations
  const stats = useMemo(() => {
    const totalLogs = logs.length;
    const peakManpower = logs.reduce((max, l) => Math.max(max, parseInt(l.manpowerCount) || 0), 0);
    const incidentCount = logs.filter(l => l.safetyIncident).length;
    
    // Calculate safe days streak (consecutive days without safety incident starting from today or most recent log)
    const sortedLogs = [...logs].sort((a,b) => b.date.localeCompare(a.date));
    let safeStreak = 0;
    for (let l of sortedLogs) {
      if (l.safetyIncident) break;
      safeStreak++;
    }

    return { totalLogs, peakManpower, incidentCount, safeStreak };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchesSearch = `${l.workSummary || ''} ${l.supervisors || ''} ${l.visitors || ''} ${l.issues || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesWeather = filterWeather === 'All' || l.weather.includes(filterWeather);
      return matchesSearch && matchesWeather;
    });
  }, [logs, searchTerm, filterWeather]);

  const fmtDate = (d) => {
    try {
      return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <div className="module-container">
      {dialog}
      <style dangerouslySetInnerHTML={{ __html: `
        .log-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--sp-md);
          margin-bottom: var(--sp-lg);
        }
        .log-kpi-card {
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
        .log-kpi-card:hover {
          border-color: var(--gold);
          transform: translateY(-1px);
        }
        .log-layout-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: var(--sp-lg);
          align-items: start;
        }
        @media (max-width: 800px) {
          .log-layout-grid {
            grid-template-columns: 1fr;
          }
        }
        .premium-log-card {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: var(--radius);
          padding: 18px var(--sp-lg);
          margin-bottom: var(--sp-md);
          transition: all 0.2s;
        }
        .premium-log-card:hover {
          border-color: var(--gold);
          box-shadow: var(--shadow-sm);
        }
      `}} />

      {/* Header */}
      <div className="module-header" style={{ marginBottom: 'var(--sp-md)' }}>
        <div>
          <h2 className="section-title">📋 Daily Site Logs & Progress journals</h2>
          <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--concrete)', marginTop: 2 }}>
            Official daily diary documenting contractor progress, temperature logs, visitor checklists, and safety safety briefs.
          </p>
        </div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ New Journal Entry</button>}
      </div>

      {/* KPIs & Streak Counter */}
      <div className="log-kpi-grid">
        <div className="log-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Safe Work Streak</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {stats.safeStreak} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--concrete)' }}>consec. days</span>
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>No safety incidents</span>
          </div>
        </div>

        <div className="log-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Logs Recorded</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {stats.totalLogs} entries
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Muster logs active</span>
          </div>
        </div>

        <div className="log-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Peak Manpower</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--amber)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {stats.peakManpower} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--concrete)' }}>workers</span>
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Single-day maximum</span>
          </div>
        </div>

        <div className="log-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Incidents Logged</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: stats.incidentCount > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {stats.incidentCount}
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Requiring compliance review</span>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="log-layout-grid">
        
        {/* Left sidebar: Activity metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: '14px' }}>
              🌦️ Weather Filters
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['All', '☀️ Sunny', '🌧️ Rain', '⛅ Partly Cloudy'].map(w => (
                <button
                  key={w}
                  onClick={() => setFilterWeather(w === 'All' ? 'All' : w)}
                  className="btn btn-outline btn-sm"
                  style={{
                    justifyContent: 'flex-start',
                    fontSize: '0.75rem',
                    padding: '6px 12px',
                    borderColor: (w === 'All' && filterWeather === 'All') || filterWeather === w ? 'var(--gold-dark)' : 'var(--hairline)',
                    background: (w === 'All' && filterWeather === 'All') || filterWeather === w ? 'var(--gold-light)' : 'transparent',
                    color: 'var(--ink)'
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar: List & filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', boxShadow: 'var(--shadow-sm)' }}>
            <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--concrete)' }}>
              JOURNAL FEED ({filteredLogs.length})
            </span>
            <input
              className="form-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search daily logs..."
              style={{ width: '220px', padding: '6px 12px', fontSize: '0.78rem' }}
            />
          </div>

          <div>
            {filteredLogs.length === 0 ? (
              <div className="empty-state" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)' }}>
                <p>No site log entries found matching criteria.</p>
              </div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className="premium-log-card" style={{ borderLeft: log.safetyIncident ? '4px solid var(--rust)' : '1px solid var(--hairline)' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--ink)' }}>{fmtDate(log.date)}</span>
                        <span className="badge badge-completed" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>{log.shift}</span>
                        <span style={{ fontSize: '0.75rem' }}>{log.weather}</span>
                        {log.temperature && <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--concrete)' }}>🌡️ {log.temperature}</span>}
                      </div>

                      <div className="expense-meta" style={{ marginTop: 6, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {log.manpowerCount && <span>👷 {log.manpowerCount} workers</span>}
                        {log.supervisors && <span>👤 Supervisor: <strong>{log.supervisors}</strong></span>}
                      </div>
                    </div>

                    {canEdit && (
                      <div className="expense-actions">
                        <button className="expense-action-btn" onClick={() => handleEdit(log)} title="Edit log">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="expense-action-btn del" onClick={() => handleDelete(log.id)} title="Delete log">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {Array.isArray(log.activities) && log.activities.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                      {log.activities.map(act => (
                        <span key={act} style={{ fontSize: '0.62rem', padding: '2px 6px', background: 'var(--paper-2)', border: '1px solid var(--hairline)', borderRadius: 4, color: 'var(--concrete)', fontWeight: 700 }}>
                          ✓ {act}
                        </span>
                      ))}
                    </div>
                  )}

                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-light)', marginTop: 10, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {log.workSummary}
                  </p>

                  {log.materialsUsed && (
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--concrete)' }}>
                      📦 <strong>Materials details:</strong> {log.materialsUsed}
                    </div>
                  )}

                  {log.visitors && (
                    <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--concrete)' }}>
                      🏢 <strong>Visitors checklist:</strong> {log.visitors}
                    </div>
                  )}

                  {log.issues && (
                    <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--rust)', fontWeight: 600 }}>
                      ⚠️ <strong>Disruptions / Blockers:</strong> {log.issues}
                    </div>
                  )}

                  {log.safetyIncident ? (
                    <div style={{ background: 'var(--rust-light)', border: '1px solid var(--rust)', borderRadius: 6, padding: '8px 12px', marginTop: 10, fontSize: '0.75rem', color: 'var(--rust)' }}>
                      🛑 <strong>Safety incident flagged:</strong> {log.safetyIncidentDetails}
                    </div>
                  ) : (
                    log.safetyNotes && (
                      <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600 }}>
                        🛡️ <strong>Safety compliance note:</strong> {log.safetyNotes}
                      </div>
                    )
                  )}

                </div>
              ))
            )}
          </div>

        </div>

      </div>

      {/* Form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>{editId ? 'Modify' : 'Log Daily'} Construction Journal</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Date *</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Shift *</label>
                  <select className="form-select" value={form.shift} onChange={e => setForm(p => ({ ...p, shift: e.target.value }))}>
                    {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Weather</label>
                  <select className="form-select" value={form.weather} onChange={e => setForm(p => ({ ...p, weather: e.target.value }))}>
                    {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Temperature</label>
                  <input className="form-input" value={form.temperature} onChange={e => setForm(p => ({ ...p, temperature: e.target.value }))} placeholder="e.g. 38°C" />
                </div>
                <div className="form-group">
                  <label>Total manpower</label>
                  <input className="form-input" type="number" value={form.manpowerCount} onChange={e => setForm(p => ({ ...p, manpowerCount: e.target.value }))} placeholder="e.g. 25" />
                </div>
                <div className="form-group">
                  <label>Supervisors present</label>
                  <input className="form-input" value={form.supervisors} onChange={e => setForm(p => ({ ...p, supervisors: e.target.value }))} placeholder="e.g. Eng. Sharma" />
                </div>
              </div>

              <div className="form-group">
                <label>Visitors Log</label>
                <input className="form-input" value={form.visitors} onChange={e => setForm(p => ({ ...p, visitors: e.target.value }))} placeholder="Inspectors, architects, client team..." />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Construction Tasks Active (Select Multiple)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px', padding: 8, background: 'var(--paper-2)', borderRadius: 6, border: '1px solid var(--hairline)' }}>
                  {ACTIVITY_OPTIONS.map(act => {
                    const isChecked = form.activities.includes(act);
                    return (
                      <label key={act} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', padding: '3px 4px' }}>
                        <input type="checkbox" checked={isChecked} onChange={() => handleActivityToggle(act)} />
                        <span>{act}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label>Progress Summary / Notes *</label>
                <textarea className="form-textarea" value={form.workSummary} onChange={e => setForm(p => ({ ...p, workSummary: e.target.value }))} required placeholder="Detailed log of today's work milestones..." style={{ minHeight: 70 }} />
              </div>

              <div className="form-group">
                <label>Materials Used / Received</label>
                <textarea className="form-textarea" value={form.materialsUsed} onChange={e => setForm(p => ({ ...p, materialsUsed: e.target.value }))} placeholder="Receipts / Consumption details..." style={{ minHeight: 50 }} />
              </div>

              {/* Safety section */}
              <div style={{ padding: '12px', background: 'var(--paper-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)' }}>🛡️ Safety Compliance Log</h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', marginBottom: 8 }}>
                  <input type="checkbox" checked={form.safetyIncident} onChange={e => setForm(p => ({ ...p, safetyIncident: e.target.checked }))} />
                  <span style={{ color: form.safetyIncident ? 'var(--rust)' : 'var(--green)' }}>
                    {form.safetyIncident ? '⚠️ Report Safety Incident / Hazard' : '✓ Safe Day (Zero Incidents)'}
                  </span>
                </label>
                {form.safetyIncident && (
                  <textarea className="form-textarea" value={form.safetyIncidentDetails} onChange={e => setForm(p => ({ ...p, safetyIncidentDetails: e.target.value }))} placeholder="Details about safety incident/corrective actions..." required style={{ minHeight: 50, marginBottom: 8 }} />
                )}
                <input className="form-input" value={form.safetyNotes} onChange={e => setForm(p => ({ ...p, safetyNotes: e.target.value }))} placeholder="General Safety Observations (PPE, safety fencing)..." />
              </div>

              <div className="form-group">
                <label>General Disruptions / Issues</label>
                <input className="form-input" value={form.issues} onChange={e => setForm(p => ({ ...p, issues: e.target.value }))} placeholder="Scaffolding breakdown, power cuts, delay items..." />
              </div>

              <div className="modal-actions" style={{ marginTop: 'var(--sp-md)' }}>
                <button type="submit" className="btn btn-primary">{editId ? '✓ Save Changes' : '+ Log Entry'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
