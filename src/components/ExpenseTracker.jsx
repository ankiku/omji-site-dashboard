import { useState, useEffect } from 'react';
import { addExpense, deleteExpense, updateExpense, subscribeToExpenses } from '../services/localStorageService';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from './ConfirmDialog';

const CATEGORIES = [
  'Material', 'Labour', 'Transport', 'Equipment', 'Subcontractor',
  'Electrical', 'Plumbing', 'Painting', 'Misc', 'Office', 'Other'
];

export default function ExpenseTracker({ projectId, canEdit, project }) {
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterCat, setFilterCat] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Material', description: '', amount: '', vendor: '', paymentMode: 'Cash'
  });

  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  useEffect(() => {
    const unsub = subscribeToExpenses(projectId, setExpenses);
    return unsub;
  }, [projectId]);

  const resetForm = () => {
    setForm({ date: new Date().toISOString().split('T')[0], category: 'Material', description: '', amount: '', vendor: '', paymentMode: 'Cash' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, amount: parseFloat(form.amount) || 0 };
    try {
      if (editingId) {
        await updateExpense(projectId, editingId, data);
        toast.success('Expense entry updated');
      } else {
        await addExpense(projectId, data);
        toast.success('Expense entry added');
      }
      resetForm();
    } catch (err) {
      toast.error('Failed to save expense: ' + err.message);
    }
  };

  const handleEdit = (exp) => {
    setForm({
      date: exp.date || '', category: exp.category || 'Material',
      description: exp.description || '', amount: String(exp.amount || ''),
      vendor: exp.vendor || '', paymentMode: exp.paymentMode || 'Cash'
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense entry?',
      confirmText: 'Delete',
      danger: true
    });
    if (ok) {
      try {
        await deleteExpense(projectId, id);
        toast.success('Expense entry deleted');
      } catch (err) {
        toast.error('Failed to delete expense: ' + err.message);
      }
    }
  };

  // Filtered expenses
  const filtered = expenses.filter(e => {
    if (filterCat && e.category !== filterCat) return false;
    if (filterMonth && !(e.date || '').startsWith(filterMonth)) return false;
    return true;
  });

  // Stats
  const totalAll = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalFiltered = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const budget = project?.budget || 0;
  const percentSpent = budget > 0 ? Math.round((totalAll / budget) * 100) : 0;
  const isOverBudget = budget > 0 && totalAll > budget;

  // Category breakdown
  const catBreakdown = {};
  expenses.forEach(e => {
    catBreakdown[e.category] = (catBreakdown[e.category] || 0) + (e.amount || 0);
  });
  const catEntries = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]);
  const maxCatAmount = catEntries.length > 0 ? catEntries[0][1] : 1;

  // Group by date
  const byDate = {};
  filtered.forEach(e => {
    const d = e.date || 'No Date';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  });
  const dateGroups = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' }); }
    catch { return d; }
  };

  const fmtAmount = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  // Unique months for filter
  const months = [...new Set(expenses.map(e => (e.date || '').substring(0, 7)).filter(Boolean))].sort().reverse();

  return (
    <div className="expense-tracker">
      {dialog}

      {/* Budget progress bar */}
      {budget > 0 && (
        <div className="section" style={{ marginBottom: 'var(--sp-lg)' }}>
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h2 className="section-title">📊 Budget Utilization</h2>
            <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: isOverBudget ? 'var(--rust)' : 'var(--concrete)' }}>
              {percentSpent}% Spent ({fmtAmount(totalAll)} / {fmtAmount(budget)})
            </span>
          </div>
          <div className="progress-bar-track" style={{ height: 10, background: 'var(--hairline)', borderRadius: 5, overflow: 'hidden' }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${Math.min(100, percentSpent)}%`,
                height: '100%',
                background: isOverBudget ? 'var(--rust)' : percentSpent > 85 ? 'var(--amber)' : 'var(--green)',
                borderRadius: 5,
                transition: 'width 0.5s ease'
              }}
            />
          </div>
          {isOverBudget && (
            <div style={{ marginTop: 8, color: 'var(--rust)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠ Alert: Project expenses have exceeded the allocated budget by {fmtAmount(totalAll - budget)}!</span>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="expense-summary">
        <div className="expense-summary-card">
          <div className="expense-summary-val">{fmtAmount(totalAll)}</div>
          <div className="expense-summary-lbl">Total Expenses</div>
        </div>
        <div className="expense-summary-card">
          <div className="expense-summary-val">{expenses.length}</div>
          <div className="expense-summary-lbl">Entries</div>
        </div>
        <div className="expense-summary-card">
          <div className="expense-summary-val">{Object.keys(catBreakdown).length}</div>
          <div className="expense-summary-lbl">Categories</div>
        </div>
        {filterCat || filterMonth ? (
          <div className="expense-summary-card" style={{ borderColor: 'var(--gold)' }}>
            <div className="expense-summary-val">{fmtAmount(totalFiltered)}</div>
            <div className="expense-summary-lbl">Filtered Total</div>
          </div>
        ) : (
          budget > 0 ? (
            <div className="expense-summary-card">
              <div className="expense-summary-val" style={{ color: isOverBudget ? 'var(--rust)' : 'var(--green)' }}>
                {fmtAmount(Math.max(0, budget - totalAll))}
              </div>
              <div className="expense-summary-lbl">{isOverBudget ? 'Over Budget' : 'Remaining Budget'}</div>
            </div>
          ) : null
        )}
      </div>

      {/* Category Breakdown Bar Chart */}
      {catEntries.length > 0 && (
        <div className="expense-cat-chart section">
          <div className="section-header"><h2 className="section-title">Category Breakdown</h2></div>
          <div className="expense-bars">
            {catEntries.map(([cat, amt]) => (
              <div key={cat} className="expense-bar-row">
                <span className="expense-bar-label">{cat}</span>
                <div className="expense-bar-track">
                  <div className="expense-bar-fill" style={{ width: `${(amt / maxCatAmount) * 100}%` }} />
                </div>
                <span className="expense-bar-amount">{fmtAmount(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="expense-controls">
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap', flex: 1 }}>
          <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ maxWidth: 180, height: 40 }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-select" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ maxWidth: 180, height: 40 }}>
            <option value="">All Months</option>
            {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>)}
          </select>
          {(filterCat || filterMonth) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setFilterCat(''); setFilterMonth(''); }}>Clear Filters</button>
          )}
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }} style={{ gap: 6, whiteSpace: 'nowrap' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Expense
          </button>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Expense' : 'Add Expense'}</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Date *</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required placeholder="0.00" />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Mode</label>
                  <select className="form-select" value={form.paymentMode} onChange={e => setForm(p => ({ ...p, paymentMode: e.target.value }))}>
                    {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Cement 200 bags OPC 53 grade" />
              </div>
              <div className="form-group">
                <label>Vendor / Paid To</label>
                <input className="form-input" value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="e.g. Rajasthan Cement Traders" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editingId ? '✓ Update' : '+ Add Expense'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense List grouped by date */}
      <div className="expense-list">
        {dateGroups.length === 0 && (
          <div className="empty-state"><p>No expenses recorded yet.{canEdit ? ' Click "Add Expense" to start tracking.' : ''}</p></div>
        )}
        {dateGroups.map(date => {
          const dayExpenses = byDate[date];
          const dayTotal = dayExpenses.reduce((s, e) => s + (e.amount || 0), 0);
          return (
            <div key={date} className="expense-day-group">
              <div className="expense-day-header">
                <span className="expense-day-date">{fmtDate(date)}</span>
                <span className="expense-day-total">{fmtAmount(dayTotal)}</span>
              </div>
              {dayExpenses.map(exp => (
                <div key={exp.id} className="expense-row">
                  <div className="expense-row-left">
                    <span className="expense-cat-badge">{exp.category}</span>
                    <div>
                      <div className="expense-desc">{exp.description || 'No description'}</div>
                      <div className="expense-meta">
                        {exp.vendor && <span>📍 {exp.vendor}</span>}
                        <span>💳 {exp.paymentMode || 'Cash'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="expense-row-right">
                    <span className="expense-amount">{fmtAmount(exp.amount)}</span>
                    {canEdit && (
                      <div className="expense-actions">
                        <button className="expense-action-btn" title="Edit" onClick={() => handleEdit(exp)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="expense-action-btn del" title="Delete" onClick={() => handleDelete(exp.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
