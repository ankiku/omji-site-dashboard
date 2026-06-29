import { useState, useEffect, useMemo } from 'react';
import { addLabour, updateLabour, deleteLabour, subscribeToLabour } from '../services/localStorageService';

const TRADES = ['Mason', 'Helper', 'Carpenter', 'Plumber', 'Electrician', 'Painter', 'Welder', 'Bar Bender', 'Tile Worker', 'Supervisor', 'Other'];
const TRADE_ICONS = { Mason: '🧱', Helper: '🤝', Carpenter: '🪵', Plumber: '🪠', Electrician: '⚡', Painter: '🎨', Welder: '🔥', 'Bar Bender': '💪', 'Tile Worker': '📐', Supervisor: '📋', Other: '👷' };

export default function LabourTracker({ projectId, canEdit }) {
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTrade, setFilterTrade] = useState('All');
  
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    workerName: '',
    trade: 'Helper',
    contractor: '',
    count: '1',
    wage: '',
    hours: '8',
    present: true
  });

  useEffect(() => {
    return subscribeToLabour(projectId, setRecords);
  }, [projectId]);

  const resetForm = () => {
    setForm({
      date: new Date().toISOString().split('T')[0],
      workerName: '',
      trade: 'Helper',
      contractor: '',
      count: '1',
      wage: '',
      hours: '8',
      present: true
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      count: parseInt(form.count) || 1,
      wage: parseFloat(form.wage) || 0,
      hours: parseFloat(form.hours) || 8
    };
    if (editId) {
      await updateLabour(projectId, editId, data);
    } else {
      await addLabour(projectId, data);
    }
    resetForm();
  };

  const handleEdit = (r) => {
    setForm({
      date: r.date || '',
      workerName: r.workerName || '',
      trade: r.trade || 'Helper',
      contractor: r.contractor || '',
      count: String(r.count || 1),
      wage: String(r.wage || ''),
      hours: String(r.hours || 8),
      present: r.present !== false
    });
    setEditId(r.id);
    setShowForm(true);
  };

  const handleDelete = async (r) => {
    if (window.confirm(`Delete this labour record?`)) {
      await deleteLabour(projectId, r.id);
    }
  };

  // Advanced Stats Computations
  const stats = useMemo(() => {
    const totalWages = records.reduce((s, r) => s + (r.count || 1) * (r.wage || 0), 0);
    const totalMandays = records.reduce((s, r) => s + (r.count || 1), 0);
    
    const contractors = new Set();
    const tradeBreakdown = {};
    
    records.forEach(r => {
      if (r.contractor) contractors.add(r.contractor);
      tradeBreakdown[r.trade] = (tradeBreakdown[r.trade] || 0) + (r.count || 1);
    });

    const tradeEntries = Object.entries(tradeBreakdown).sort((a, b) => b[1] - a[1]);
    const topTrade = tradeEntries.length > 0 ? `${tradeEntries[0][0]} (${tradeEntries[0][1]} d)` : 'None';

    return {
      totalWages,
      totalMandays,
      contractorsCount: contractors.size,
      topTrade,
      tradeEntries
    };
  }, [records]);

  // Filters & Search
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = `${r.workerName || ''} ${r.contractor || ''} ${r.trade}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTrade = filterTrade === 'All' || r.trade === filterTrade;
      return matchSearch && matchTrade;
    });
  }, [records, searchTerm, filterTrade]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const byDate = {};
    filteredRecords.forEach(r => {
      const d = r.date || 'No Date';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(r);
    });
    return Object.keys(byDate).sort((a, b) => b.localeCompare(a)).map(date => ({
      date,
      records: byDate[date],
      totalWages: byDate[date].reduce((s, r) => s + (r.count || 1) * (r.wage || 0), 0),
      totalWorkers: byDate[date].reduce((s, r) => s + (r.count || 1), 0)
    }));
  }, [filteredRecords]);

  const fmtAmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const maxTradeCount = stats.tradeEntries.length > 0 ? stats.tradeEntries[0][1] : 1;

  return (
    <div className="module-container">
      <style dangerouslySetInnerHTML={{ __html: `
        .labour-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--sp-md);
          margin-bottom: var(--sp-lg);
        }
        .labour-kpi-card {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: var(--radius);
          padding: var(--sp-md) var(--sp-lg);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition: all 0.2s ease;
        }
        .labour-kpi-card:hover {
          transform: translateY(-1px);
          border-color: var(--gold);
          box-shadow: var(--shadow-sm);
        }
        .labour-kpi-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          height: 3px;
          width: 100%;
          background: var(--grad-gold);
        }
        .labour-kpi-card.green::before { background: var(--grad-green); }
        .labour-kpi-card.amber::before { background: var(--grad-amber); }
        .labour-kpi-card.rust::before { background: var(--grad-rust); }
        
        .labour-dashboard-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: var(--sp-lg);
          align-items: start;
        }
        @media (max-width: 800px) {
          .labour-dashboard-layout {
            grid-template-columns: 1fr;
          }
        }
        .trade-share-bar {
          height: 6px;
          border-radius: 3px;
          background: var(--hairline);
          margin-top: 4px;
          overflow: hidden;
        }
        .trade-share-fill {
          height: 100%;
          background: var(--gold-dark);
          border-radius: 3px;
        }
        .daily-group-box {
          border: 1px solid var(--hairline);
          border-radius: var(--radius);
          background: var(--paper);
          margin-bottom: var(--sp-md);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .daily-group-header {
          background: var(--paper-2);
          padding: 12px var(--sp-lg);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--hairline);
        }
      `}} />

      {/* Header */}
      <div className="module-header" style={{ marginBottom: 'var(--sp-md)' }}>
        <div>
          <h2 className="section-title">👷 Workforce & Labor Tracking</h2>
          <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--concrete)', marginTop: 2 }}>
            Real-time daily muster rolls, trade allocations, and wage analysis.
          </p>
        </div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Add Attendance Record</button>}
      </div>

      {/* KPI Stats widgets */}
      <div className="labour-kpi-grid">
        <div className="labour-kpi-card green">
          <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Deployments</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{stats.totalMandays} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--concrete)' }}>man-days</span></span>
        </div>
        <div className="labour-kpi-card amber">
          <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Wage Cost</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--amber)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(stats.totalWages)}</span>
        </div>
        <div className="labour-kpi-card">
          <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contractors Active</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{stats.contractorsCount}</span>
        </div>
        <div className="labour-kpi-card rust">
          <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top Trade Allocation</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--rust)', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.topTrade}</span>
        </div>
      </div>

      {/* Main dashboard content */}
      <div className="labour-dashboard-layout">
        
        {/* Left Side: Trade-wise deploy chart widget */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: '14px' }}>
              📊 Workforce Distribution
            </h4>
            
            {stats.tradeEntries.length === 0 ? (
              <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--concrete)' }}>No trade data logged yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.tradeEntries.map(([trade, count]) => {
                  const pct = Math.round((count / maxTradeCount) * 100);
                  const icon = TRADE_ICONS[trade] || '👷';
                  return (
                    <div key={trade}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                        <span>{icon} {trade}</span>
                        <span className="mono" style={{ color: 'var(--concrete)' }}>{count} d</span>
                      </div>
                      <div className="trade-share-bar">
                        <div className="trade-share-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Log Feed + Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          
          {/* Filters Bar */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--concrete)' }}>FILTER TRADE:</span>
              <select className="form-select" value={filterTrade} onChange={e => setFilterTrade(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto' }}>
                <option value="All">All Trades</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            
            <input
              className="form-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search contractor or worker..."
              style={{ width: '220px', padding: '6px 12px', fontSize: '0.78rem' }}
            />
          </div>

          {/* Grouped Muster logs list */}
          <div>
            {groupedByDate.length === 0 ? (
              <div className="empty-state" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)' }}>
                <p>No workforce attendance logs match the criteria.</p>
              </div>
            ) : (
              groupedByDate.map(group => (
                <div key={group.date} className="daily-group-box">
                  <div className="daily-group-header">
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)' }}>
                      📅 {new Date(group.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span className="badge badge-completed" style={{ fontSize: '0.62rem', padding: '3px 8px' }}>
                        {group.totalWorkers} workers deployed
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--gold-dark)', fontFamily: 'var(--font-mono)' }}>
                        {fmtAmt(group.totalWages)}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '8px var(--sp-lg)' }}>
                    {group.records.map(r => (
                      <div key={r.id} className="expense-row" style={{ border: 'none', borderBottom: '1px solid var(--hairline)', borderRadius: 0, padding: '10px 0', marginBottom: 0 }}>
                        <div className="expense-row-left">
                          <span style={{ fontSize: '1.1rem', marginRight: '8px' }}>{TRADE_ICONS[r.trade] || '👷'}</span>
                          <div>
                            <div className="expense-desc" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                              {r.workerName || r.trade} · <span style={{ color: 'var(--concrete)' }}>{r.count} worker{r.count > 1 ? 's' : ''}</span>
                            </div>
                            <div className="expense-meta" style={{ marginTop: 2 }}>
                              <span className="expense-cat-badge" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{r.trade}</span>
                              {r.contractor && <span>🏗️ Contractor: <strong>{r.contractor}</strong></span>}
                              {r.hours && <span>⏱️ {r.hours} hrs shift</span>}
                            </div>
                          </div>
                        </div>

                        <div className="expense-row-right">
                          <span className="expense-amount" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                            {r.wage ? fmtAmt(r.count * r.wage) : '—'}
                          </span>
                          {canEdit && (
                            <div className="expense-actions" style={{ marginLeft: '12px' }}>
                              <button className="expense-action-btn" onClick={() => handleEdit(r)} title="Edit record">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button className="expense-action-btn del" onClick={() => handleDelete(r)} title="Delete record">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </div>

      {/* Modal Attendance Form */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{editId ? 'Modify' : 'Log Daily'} Labor Attendance</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Date *</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Work Trade *</label>
                  <select className="form-select" value={form.trade} onChange={e => setForm(p => ({ ...p, trade: e.target.value }))}>
                    {TRADES.map(t => <option key={t} value={t}>{TRADE_ICONS[t]} {t}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Group / Worker Name</label>
                  <input className="form-input" value={form.workerName} onChange={e => setForm(p => ({ ...p, workerName: e.target.value }))} placeholder="e.g. Mason Team A" />
                </div>
                <div className="form-group">
                  <label>Contractor Name</label>
                  <input className="form-input" value={form.contractor} onChange={e => setForm(p => ({ ...p, contractor: e.target.value }))} placeholder="e.g. Balaji Enterprises" />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Head Count *</label>
                  <input className="form-input" type="number" min="1" value={form.count} onChange={e => setForm(p => ({ ...p, count: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Daily Wage * (₹ / person)</label>
                  <input className="form-input" type="number" min="0" value={form.wage} onChange={e => setForm(p => ({ ...p, wage: e.target.value }))} required placeholder="e.g. 450" />
                </div>
                <div className="form-group">
                  <label>Shift Hours</label>
                  <input className="form-input" type="number" min="1" max="24" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 'var(--sp-md)' }}>
                <button type="submit" className="btn btn-primary">{editId ? '✓ Save Changes' : '+ Log Attendance'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
