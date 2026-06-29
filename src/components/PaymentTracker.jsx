import { useState, useEffect, useMemo } from 'react';
import { addPayment, updatePayment, deletePayment, subscribeToPayments } from '../services/localStorageService';

const PAY_TYPES = ['Client Payment', 'Contractor Payment', 'Advance', 'Retention', 'Final Bill'];
const PAY_STATUS = ['Pending', 'Partially Paid', 'Paid', 'Overdue'];

export default function PaymentTracker({ projectId, canEdit }) {
  const [payments, setPayments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterType, setFilterType] = useState('All');
  
  const [form, setForm] = useState({
    milestone: '',
    type: 'Client Payment',
    amount: '',
    paidAmount: '',
    status: 'Pending',
    dueDate: '',
    paidDate: '',
    linkedPhase: '',
    notes: '',
    order: ''
  });

  useEffect(() => {
    return subscribeToPayments(projectId, setPayments);
  }, [projectId]);

  const resetForm = () => {
    setForm({
      milestone: '',
      type: 'Client Payment',
      amount: '',
      paidAmount: '',
      status: 'Pending',
      dueDate: '',
      paidDate: '',
      linkedPhase: '',
      notes: '',
      order: String(payments.length + 1)
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      amount: parseFloat(form.amount) || 0,
      paidAmount: parseFloat(form.paidAmount) || 0,
      order: parseInt(form.order) || payments.length + 1
    };
    if (editId) {
      await updatePayment(projectId, editId, data);
    } else {
      await addPayment(projectId, data);
    }
    resetForm();
  };

  const handleEdit = (p) => {
    setForm({
      milestone: p.milestone || '',
      type: p.type || 'Client Payment',
      amount: String(p.amount || ''),
      paidAmount: String(p.paidAmount || ''),
      status: p.status || 'Pending',
      dueDate: p.dueDate || '',
      paidDate: p.paidDate || '',
      linkedPhase: p.linkedPhase || '',
      notes: p.notes || '',
      order: String(p.order || '')
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (pid) => {
    if (window.confirm('Delete this payment milestone?')) {
      await deletePayment(projectId, pid);
    }
  };

  const fmtAmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const { totalAmount, totalPaid, totalPending, collectionPct, pendingOverdue } = useMemo(() => {
    const totalAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.paidAmount || 0), 0);
    const totalPending = totalAmount - totalPaid;
    const collectionPct = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;
    const pendingOverdue = payments.filter(p => p.status === 'Overdue').reduce((s, p) => s + ((p.amount || 0) - (p.paidAmount || 0)), 0);

    return { totalAmount, totalPaid, totalPending, collectionPct, pendingOverdue };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return [...payments].sort((a,b) => (parseInt(a.order) || 0) - (parseInt(b.order) || 0)).filter(p => {
      if (filterType === 'All') return true;
      return p.type === filterType;
    });
  }, [payments, filterType]);

  // SVG circular collection ring calculation
  const ringR = 24;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (Math.min(100, collectionPct) / 100) * ringC;

  return (
    <div className="module-container">
      <style dangerouslySetInnerHTML={{ __html: `
        .pay-kpi-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--sp-md);
          margin-bottom: var(--sp-lg);
        }
        .pay-kpi-card {
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
        .pay-kpi-card:hover {
          border-color: var(--gold);
          transform: translateY(-1px);
        }
        .payment-milestone-list {
          display: flex;
          flex-direction: column;
          gap: var(--sp-md);
        }
        .premium-pay-row {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: var(--radius);
          padding: 16px var(--sp-lg);
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .premium-pay-row:hover {
          border-color: var(--gold);
          box-shadow: var(--shadow-sm);
        }
        .pay-status-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 3px 8px;
          border-radius: 4px;
        }
        .pay-status-badge.paid { background: var(--green-light); color: var(--green); }
        .pay-status-badge.overdue { background: var(--rust-light); color: var(--rust); }
        .pay-status-badge.partial { background: var(--amber-light); color: var(--amber); }
        .pay-status-badge.pending { background: var(--gold-light); color: var(--gold-dark); }
        
        .pay-progress-track {
          height: 6px;
          background: var(--hairline);
          border-radius: 3px;
          margin-top: 6px;
          overflow: hidden;
        }
        .pay-progress-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}} />

      {/* Header */}
      <div className="module-header" style={{ marginBottom: 'var(--sp-md)' }}>
        <div>
          <h2 className="section-title">💰 Payment & Milestone Billing</h2>
          <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--concrete)', marginTop: 2 }}>
            Track client draws, contractor disbursements, advances, and invoice collections.
          </p>
        </div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Create Milestone</button>}
      </div>

      {/* KPIs & Circular Gauge Row */}
      <div className="pay-kpi-row">
        
        <div className="pay-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Contract Value</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {fmtAmt(totalAmount)}
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>{payments.length} scheduled bills</span>
          </div>
        </div>

        <div className="pay-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Total Collected</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {fmtAmt(totalPaid)}
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Invoiced & cleared</span>
          </div>
          <svg width="56" height="56" style={{ flexShrink: 0 }}>
            <circle cx="28" cy="28" r={ringR} fill="none" stroke="var(--hairline)" strokeWidth="4" />
            <circle cx="28" cy="28" r={ringR} fill="none" stroke="var(--green)" strokeWidth="4"
              strokeDasharray={ringC} strokeDashoffset={ringOffset} strokeLinecap="round" transform="rotate(-90 28 28)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            <text x="28" y="31" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--green)" fontFamily="var(--font-mono)">
              {collectionPct}%
            </text>
          </svg>
        </div>

        <div className="pay-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Outstanding Draw</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: totalPending > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {fmtAmt(totalPending)}
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Unpaid/pending balance</span>
          </div>
        </div>

        <div className="pay-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Overdue Invoices</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: pendingOverdue > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {fmtAmt(pendingOverdue)}
            </div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Requires attention</span>
          </div>
        </div>

      </div>

      {/* Main List Section */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '18px', boxShadow: 'var(--shadow-sm)' }}>
        
        {/* Sub-Header / Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            📋 Billing Milestones ledger
          </h4>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['All', 'Client Payment', 'Contractor Payment', 'Advance'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className="btn btn-outline btn-sm"
                style={{
                  fontSize: '0.65rem',
                  padding: '3px 8px',
                  border: filterType === t ? '1.5px solid var(--ink)' : '1px solid var(--hairline)',
                  background: filterType === t ? 'var(--ink)' : 'transparent',
                  color: filterType === t ? '#fff' : 'var(--concrete)'
                }}
              >
                {t === 'All' ? 'All' : t.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Milestone cards */}
        {filteredPayments.length === 0 ? (
          <div className="empty-state">
            <p>No billing milestones match selection.</p>
          </div>
        ) : (
          <div className="payment-milestone-list">
            {filteredPayments.map((p, index) => {
              const pct = p.amount > 0 ? Math.round((p.paidAmount / p.amount) * 100) : 0;
              const statusClass = p.status.toLowerCase().replace(' ', '-');
              const statusBadgeColor = p.status === 'Paid' ? 'paid' : p.status === 'Overdue' ? 'overdue' : p.status === 'Partially Paid' ? 'partial' : 'pending';
              const progressFillColor = p.status === 'Paid' ? 'var(--green)' : p.status === 'Overdue' ? 'var(--rust)' : p.status === 'Partially Paid' ? 'var(--amber)' : 'var(--gold)';

              return (
                <div key={p.id} className="premium-pay-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--concrete)', fontWeight: 800 }}>#{p.order || index + 1}</span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--ink)' }}>{p.milestone}</strong>
                        <span className={`pay-status-badge ${statusBadgeColor}`}>{p.status}</span>
                      </div>
                      <div className="expense-meta" style={{ marginTop: 6, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span className="expense-cat-badge" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{p.type}</span>
                        {p.linkedPhase && <span>📋 {p.linkedPhase}</span>}
                        {p.dueDate && <span>📅 Due: {p.dueDate}</span>}
                        {p.paidDate && <span>✅ Paid: {p.paidDate}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--ink)' }}>{fmtAmt(p.amount)}</div>
                        <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--concrete)' }}>Paid: {fmtAmt(p.paidAmount)}</div>
                      </div>
                      
                      {canEdit && (
                        <div className="expense-actions">
                          <button className="expense-action-btn" onClick={() => handleEdit(p)} title="Edit milestone">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="expense-action-btn del" onClick={() => handleDelete(p.id)} title="Delete milestone">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Line */}
                  {p.amount > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                        <span>Milestone Progress</span>
                        <span>{pct}% Collected</span>
                      </div>
                      <div className="pay-progress-track">
                        <div className="pay-progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: progressFillColor }} />
                      </div>
                    </div>
                  )}

                  {p.notes && (
                    <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--concrete)', background: 'var(--paper-2)', padding: '4px 8px', borderRadius: 4, marginTop: 8, display: 'inline-block' }}>
                      📝 {p.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Payment Form */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>{editId ? 'Edit' : 'Create'} Billing Milestone</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Milestone Title / Stage *</label>
                <input className="form-input" value={form.milestone} onChange={e => setForm(p => ({ ...p, milestone: e.target.value }))} required placeholder="e.g. Roof Slab Casting Completed (15%)" />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Billing Type</label>
                  <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {PAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    {PAY_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Total Value (₹) *</label>
                  <input className="form-input" type="number" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Amount Settled (₹)</label>
                  <input className="form-input" type="number" min="0" value={form.paidAmount} onChange={e => setForm(p => ({ ...p, paidAmount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Sort Order</label>
                  <input className="form-input" type="number" min="1" value={form.order} onChange={e => setForm(p => ({ ...p, order: e.target.value }))} />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Due Date</label>
                  <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Settlement Date</label>
                  <input className="form-input" type="date" value={form.paidDate} onChange={e => setForm(p => ({ ...p, paidDate: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label>Linked Phase or Task</label>
                <input className="form-input" value={form.linkedPhase} onChange={e => setForm(p => ({ ...p, linkedPhase: e.target.value }))} placeholder="e.g. Phase 2: Ground Floor Structural Work" />
              </div>

              <div className="form-group">
                <label>Notes / Memo</label>
                <input className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Invoice #2034 submitted" />
              </div>

              <div className="modal-actions" style={{ marginTop: 'var(--sp-md)' }}>
                <button type="submit" className="btn btn-primary">{editId ? '✓ Save Changes' : '+ Add Milestone'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
