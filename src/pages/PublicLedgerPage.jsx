import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { getProjectBySlug, getPublicExpenses, getPublicPayments, getPublicContacts, getPublicMaterials } from '../services/localStorageService';

const fmtAmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const CAT_COLORS = {
  Cement: '#7C7468', 'Steel/TMT': '#C4441E', Sand: '#C5A880', Aggregate: '#9F835C',
  Bricks: '#D65A31', Blocks: '#B8862E', RMC: '#3D7CB8', Wood: '#8F7D6B',
  Tiles: '#5B7553', Paint: '#4D6645', Plumbing: '#3D7CB8', Electrical: '#E8A838',
  Hardware: '#A39D94', Other: '#7C7468'
};

export default function PublicLedgerPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();

  const viewType = searchParams.get('view') || 'expenses'; // 'expenses', 'payments', or 'materials'
  const filterCategory = searchParams.get('category') || '';
  const filterContact = searchParams.get('contact') || '';
  const filterContactId = searchParams.get('contactId') || '';

  const [project, setProject] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [localCategory, setLocalCategory] = useState(filterCategory);
  const [localContactId, setLocalContactId] = useState(filterContactId);
  const [showVendorSummary, setShowVendorSummary] = useState(false);
  const [matFilterCat, setMatFilterCat] = useState('');
  const [matFilterVendor, setMatFilterVendor] = useState('');
  const [matSearch, setMatSearch] = useState('');
  const [matSummaryView, setMatSummaryView] = useState(''); // '' | 'vendor' | 'category'
  const [matSortBy, setMatSortBy] = useState('date-desc');

  useEffect(() => {
    async function load() {
      const p = await getProjectBySlug(slug);
      if (!p) { setNotFound(true); setLoading(false); return; }
      setProject(p);
      document.title = `${viewType === 'payments' ? 'Payment' : viewType === 'materials' ? 'Material' : 'Expense'} Ledger — ${p.name}`;

      const [exp, pay, con, mat] = await Promise.all([
        getPublicExpenses(slug),
        getPublicPayments(slug),
        getPublicContacts(slug),
        getPublicMaterials(slug)
      ]);
      setExpenses(exp);
      setPayments(pay);
      setContacts(con);
      setMaterials(mat);
      setLoading(false);
    }
    load();
  }, [slug, viewType]);

  const contactMap = useMemo(() => {
    const m = {};
    contacts.forEach(c => { m[c.id] = c; });
    return m;
  }, [contacts]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    let list = [...expenses].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    if (localCategory) list = list.filter(e => e.category === localCategory);
    if (localContactId) list = list.filter(e => e.contactId === localContactId);
    if (filterContact && !localContactId) {
      list = list.filter(e => {
        if (e.contactId) {
          const c = contactMap[e.contactId];
          return c && c.name.toLowerCase().includes(filterContact.toLowerCase());
        }
        return (e.vendor || '').toLowerCase().includes(filterContact.toLowerCase());
      });
    }
    return list;
  }, [expenses, localCategory, localContactId, filterContact, contactMap]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    let list = [...payments].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (localContactId) list = list.filter(p => p.contactId === localContactId);
    if (filterContact && !localContactId) {
      list = list.filter(p => {
        if (p.contactId) {
          const c = contactMap[p.contactId];
          return c && c.name.toLowerCase().includes(filterContact.toLowerCase());
        }
        return false;
      });
    }
    return list;
  }, [payments, localContactId, filterContact, contactMap]);

  // Vendor-wise payment summary
  const vendorPaySummary = useMemo(() => {
    const vm = {};
    filteredPayments.forEach(p => {
      if (!p.contactId) return;
      if (!vm[p.contactId]) vm[p.contactId] = { billed: 0, paid: 0, count: 0 };
      vm[p.contactId].billed += (p.amount || 0);
      vm[p.contactId].paid += (p.paidAmount || 0);
      vm[p.contactId].count += 1;
    });
    return Object.entries(vm).map(([cid, d]) => ({ name: contactMap[cid]?.name || 'Unknown', role: contactMap[cid]?.role || '', ...d })).sort((a, b) => b.billed - a.billed);
  }, [filteredPayments, contactMap]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    let list = materials.filter(m => m.category !== 'Subcontractor Payment');
    if (matFilterCat) list = list.filter(m => m.category === matFilterCat);
    if (matFilterVendor) list = list.filter(m => (m.vendor || '') === matFilterVendor);
    if (matSearch) list = list.filter(m => `${m.name} ${m.category} ${m.vendor}`.toLowerCase().includes(matSearch.toLowerCase()));
    // Sort
    list = [...list];
    switch (matSortBy) {
      case 'date-asc': list.sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)); break;
      case 'name-asc': list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'name-desc': list.sort((a, b) => (b.name || '').localeCompare(a.name || '')); break;
      case 'total-desc': list.sort((a, b) => { const at = (a.received||0)*(a.rate||0); const bt = (b.received||0)*(b.rate||0); return bt - at; }); break;
      case 'total-asc': list.sort((a, b) => { const at = (a.received||0)*(a.rate||0); const bt = (b.received||0)*(b.rate||0); return at - bt; }); break;
      default: list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)); break;
    }
    return list;
  }, [materials, matFilterCat, matFilterVendor, matSearch, matSortBy]);

  const matCategories = useMemo(() => [...new Set(materials.filter(m => m.category !== 'Subcontractor Payment').map(m => m.category).filter(Boolean))].sort(), [materials]);
  const matVendors = useMemo(() => [...new Set(materials.filter(m => m.category !== 'Subcontractor Payment' && (m.received||0) > 0 && m.vendor).map(m => m.vendor))].sort(), [materials]);
  const matTotalSpent = filteredMaterials.filter(m => (m.received || 0) > 0).reduce((s, m) => s + (m.received || 0) * (m.rate || 0), 0);
  const matTotalReceived = filteredMaterials.reduce((s, m) => s + (m.received || 0), 0);

  // Material vendor-wise summary
  const matVendorSummary = useMemo(() => {
    const vm = {};
    filteredMaterials.forEach(m => {
      if ((m.received||0) > 0 && m.vendor) {
        if (!vm[m.vendor]) vm[m.vendor] = { vendor: m.vendor, totalCost: 0, totalQty: 0, items: {}, txCount: 0 };
        vm[m.vendor].totalQty += (m.received||0);
        vm[m.vendor].totalCost += (m.received||0) * (m.rate||0);
        vm[m.vendor].txCount += 1;
        const mk = `${m.name} (${m.unit})`;
        if (!vm[m.vendor].items[mk]) vm[m.vendor].items[mk] = { qty: 0, cost: 0 };
        vm[m.vendor].items[mk].qty += (m.received||0);
        vm[m.vendor].items[mk].cost += (m.received||0) * (m.rate||0);
      }
    });
    return Object.values(vm).sort((a,b) => b.totalCost - a.totalCost);
  }, [filteredMaterials]);

  // Material category-wise summary
  const matCatSummary = useMemo(() => {
    const cm = {};
    filteredMaterials.forEach(m => {
      if ((m.received||0) > 0) {
        if (!cm[m.category]) cm[m.category] = { category: m.category, totalCost: 0, totalQty: 0, txCount: 0, items: {} };
        cm[m.category].totalQty += (m.received||0);
        cm[m.category].totalCost += (m.received||0) * (m.rate||0);
        cm[m.category].txCount += 1;
        const mk = `${m.name} (${m.unit})`;
        if (!cm[m.category].items[mk]) cm[m.category].items[mk] = { qty: 0, cost: 0 };
        cm[m.category].items[mk].qty += (m.received||0);
        cm[m.category].items[mk].cost += (m.received||0) * (m.rate||0);
      }
    });
    return Object.values(cm).sort((a,b) => b.totalCost - a.totalCost);
  }, [filteredMaterials]);

  // Category options
  const expenseCategories = useMemo(() => [...new Set(expenses.map(e => e.category).filter(Boolean))].sort(), [expenses]);

  // Contact options
  const contactOptions = useMemo(() => {
    const relevant = viewType === 'payments'
      ? contacts.filter(c => payments.some(p => p.contactId === c.id))
      : contacts.filter(c => expenses.some(e => e.contactId === c.id));
    return relevant;
  }, [contacts, expenses, payments, viewType]);

  // Stats
  const expTotal = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const payTotalBilled = filteredPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const payTotalPaid = filteredPayments.reduce((s, p) => s + (p.paidAmount || 0), 0);

  const buildShareUrl = () => {
    const base = `${window.location.origin}/p/${slug}/ledger?view=${viewType}`;
    const params = [];
    if (localCategory) params.push(`category=${encodeURIComponent(localCategory)}`);
    if (localContactId) params.push(`contactId=${encodeURIComponent(localContactId)}`);
    return params.length > 0 ? `${base}&${params.join('&')}` : base;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(buildShareUrl());
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return (<><Topbar publicMode /><div className="loader"><div className="spinner" /></div></>);
  }

  if (notFound) {
    return (<><Topbar publicMode /><div className="container page" style={{ textAlign: 'center' }}><h2 style={{ marginBottom: 'var(--sp-md)' }}>Project Not Found</h2><p style={{ color: 'var(--concrete)' }}>This share link may be invalid.</p></div></>);
  }

  return (
    <>
      <Topbar publicMode projectName={project?.name} />
      <div className="container page">
        <style dangerouslySetInnerHTML={{ __html: `
          .ledger-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-md); margin-bottom: var(--sp-lg); }
          .ledger-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: var(--sp-lg); }
          .ledger-kpi { background: var(--paper); border: 1px solid var(--hairline); border-radius: var(--radius); padding: 16px; position: relative; overflow: hidden; }
          .ledger-kpi-accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; }
          .ledger-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: var(--sp-lg); background: var(--paper); border: 1px solid var(--hairline); border-radius: var(--radius); padding: 12px 16px; }
          .ledger-item { background: var(--paper); border: 1px solid var(--hairline); border-radius: var(--radius); padding: 14px 18px; transition: all .15s; }
          .ledger-item:hover { border-color: var(--gold); box-shadow: var(--shadow-sm); }
          .ledger-bill-links { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
          .ledger-bill-chip { display: inline-flex; align-items: center; gap: 3px; font-size: .65rem; font-weight: 600; padding: 3px 8px; border-radius: 4px; border: 1px solid var(--gold); background: var(--gold-light); color: var(--gold-dark); cursor: pointer; text-decoration: none; transition: all .15s; }
          .ledger-bill-chip:hover { background: var(--gold); color: #fff; }
          .pay-progress-track { height: 6px; background: var(--hairline); border-radius: 3px; overflow: hidden; margin-top: 6px; }
          .pay-progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
          .share-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: var(--radius-sm); border: 1.5px solid var(--gold); background: var(--gold-light); color: var(--gold-dark); font-size: .72rem; font-weight: 700; cursor: pointer; transition: all .15s; }
          .share-btn:hover { background: var(--gold); color: #fff; }
          .ledger-vendor-row { display:grid; grid-template-columns:1fr auto auto auto; gap:12px; align-items:center; padding:10px 14px; border-radius:8px; border:1px solid var(--hairline); background:var(--paper); transition:all .15s; }
          .ledger-vendor-row:hover { border-color:var(--gold); background:var(--gold-light); }
          .ledger-summary-panel { background:var(--paper); border:1px solid var(--hairline); border-radius:var(--radius); overflow:hidden; margin-bottom:var(--sp-lg); }
          .ledger-summary-toggle { display:flex; align-items:center; gap:6px; padding:4px 10px; border-radius:6px; font-size:.65rem; font-weight:700; cursor:pointer; border:1.5px solid var(--hairline); background:var(--paper); color:var(--concrete); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:.04em; transition:all .15s; }
          .ledger-summary-toggle.active { border-color:var(--gold); background:var(--gold); color:#fff; }
          .ledger-summary-toggle:hover:not(.active) { border-color:var(--gold); color:var(--gold-dark); }
          .ledger-summary-card { padding:14px 18px; border-bottom:1px solid var(--hairline); transition:background .15s; }
          .ledger-summary-card:last-child { border-bottom:none; }
          .ledger-summary-card:hover { background:var(--gold-light); }
          .ledger-summary-sub { font-size:.65rem; color:var(--concrete); font-family:var(--font-mono); display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
          .ledger-summary-sub-item { background:var(--paper-2); padding:3px 8px; border-radius:4px; display:inline-flex; align-items:center; gap:4px; }
          .ledger-filter-select { padding:5px 10px; border-radius:6px; border:1px solid var(--hairline); font-size:.75rem; background:var(--paper-2); cursor:pointer; transition:border-color .15s; }
          .ledger-filter-select:focus { border-color:var(--gold); outline:none; }
          .ledger-active-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:20px; font-size:.65rem; font-weight:700; background:var(--gold-light); color:var(--gold-dark); border:1px solid var(--gold); font-family:var(--font-mono); }
          .ledger-active-chip button { background:none; border:none; cursor:pointer; color:var(--gold-dark); font-size:.7rem; padding:0; line-height:1; opacity:.7; }
          .ledger-active-chip button:hover { opacity:1; color:var(--rust); }
          @media (max-width: 600px) { .ledger-kpi-row { grid-template-columns: 1fr 1fr; } }
        `}} />

        {/* Header */}
        <div className="ledger-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>
              {viewType === 'payments' ? '💰 Payment Ledger' : viewType === 'materials' ? '📦 Material Ledger' : '📊 Expense Ledger'}
            </h1>
            <p className="mono" style={{ fontSize: '.75rem', color: 'var(--concrete)' }}>
              {project.name} — {filterContact || (localContactId && contactMap[localContactId]?.name) || 'All Entries'}
            </p>
          </div>
          <button className="share-btn" onClick={handleCopyLink}>📋 Copy Share Link</button>
        </div>

        {/* Filters */}
        <div className="ledger-filters">
          <span style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Filters:</span>

          <select value={viewType} onChange={e => { window.location.href = `/p/${slug}/ledger?view=${e.target.value}`; }} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--hairline)', fontSize: '.75rem', background: 'var(--paper-2)' }}>
            <option value="expenses">Expense Ledger</option>
            <option value="payments">Payment Ledger</option>
            <option value="materials">Material Ledger</option>
          </select>

          {viewType === 'expenses' && (
            <select value={localCategory} onChange={e => setLocalCategory(e.target.value)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--hairline)', fontSize: '.75rem', background: 'var(--paper-2)' }}>
              <option value="">All Categories</option>
              {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {viewType === 'materials' && (
            <>
              <select className="ledger-filter-select" value={matFilterCat} onChange={e => setMatFilterCat(e.target.value)}>
                <option value="">All Categories</option>
                {matCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="ledger-filter-select" value={matFilterVendor} onChange={e => setMatFilterVendor(e.target.value)}>
                <option value="">All Vendors</option>
                {matVendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select className="ledger-filter-select" value={matSortBy} onChange={e => setMatSortBy(e.target.value)}>
                <option value="date-desc">Date: New → Old</option>
                <option value="date-asc">Date: Old → New</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
                <option value="total-desc">Total: High → Low</option>
                <option value="total-asc">Total: Low → High</option>
              </select>
              <input value={matSearch} onChange={e => setMatSearch(e.target.value)} placeholder="Search material..." style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--hairline)', fontSize: '.75rem', background: 'var(--paper-2)', width: 140 }} />
            </>
          )}

          {viewType !== 'materials' && (
            <select value={localContactId} onChange={e => setLocalContactId(e.target.value)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--hairline)', fontSize: '.75rem', background: 'var(--paper-2)' }}>
              <option value="">All Contacts</option>
              {contactOptions.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
            </select>
          )}

          {(localCategory || localContactId || matFilterCat || matFilterVendor || matSearch) && (
            <>
              {matFilterCat && <span className="ledger-active-chip">📂 {matFilterCat} <button onClick={() => setMatFilterCat('')}>✕</button></span>}
              {matFilterVendor && <span className="ledger-active-chip">🏢 {matFilterVendor} <button onClick={() => setMatFilterVendor('')}>✕</button></span>}
              <button onClick={() => { setLocalCategory(''); setLocalContactId(''); setMatFilterCat(''); setMatFilterVendor(''); setMatSearch(''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--rust)', fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', background: 'var(--rust-light)', color: 'var(--rust)', transition: 'all .15s' }}>Clear All</button>
            </>
          )}
        </div>

        {/* ─── EXPENSES VIEW ─── */}
        {viewType === 'expenses' && (
          <>
            <div className="ledger-kpi-row">
              <div className="ledger-kpi">
                <div className="ledger-kpi-accent" style={{ background: 'var(--grad-gold)' }} />
                <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--concrete)' }}>Total Spend</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(expTotal)}</div>
                <span className="mono" style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>{filteredExpenses.length} entries</span>
              </div>
              <div className="ledger-kpi">
                <div className="ledger-kpi-accent" style={{ background: 'var(--grad-green)' }} />
                <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--concrete)' }}>Categories</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{new Set(filteredExpenses.map(e => e.category)).size}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredExpenses.length === 0 && <div className="empty-state"><p>No expenses match the current filters.</p></div>}
              {filteredExpenses.map(exp => {
                const contact = exp.contactId ? contactMap[exp.contactId] : null;
                return (
                  <div key={exp.id} className="ledger-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--gold-light)', color: 'var(--gold-dark)', textTransform: 'uppercase' }}>{exp.category}</span>
                          <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink)' }}>{exp.description || 'No description'}</span>
                        </div>
                        <div className="mono" style={{ fontSize: '.65rem', color: 'var(--concrete)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span>📅 {fmtDate(exp.date)}</span>
                          {contact && <span>👥 {contact.name}</span>}
                          {!contact && exp.vendor && <span>📍 {exp.vendor}</span>}
                          <span>💳 {exp.paymentMode || 'Cash'}</span>
                        </div>
                        {exp.billUrls && exp.billUrls.length > 0 && (
                          <div className="ledger-bill-links">
                            {exp.billUrls.map((url, i) => {
                              const isPdf = url.toLowerCase().endsWith('.pdf');
                              return <a key={i} className="ledger-bill-chip" href={url} target="_blank" rel="noopener noreferrer">{isPdf ? '📄 View PDF' : '🖼️ View Image'} {exp.billUrls.length > 1 ? i + 1 : ''}</a>;
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{fmtAmt(exp.amount)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── PAYMENTS VIEW ─── */}
        {viewType === 'payments' && (
          <>
            <div className="ledger-kpi-row">
              <div className="ledger-kpi">
                <div className="ledger-kpi-accent" style={{ background: 'var(--grad-gold)' }} />
                <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--concrete)' }}>Total Billed</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(payTotalBilled)}</div>
                <span className="mono" style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>{filteredPayments.length} milestones</span>
              </div>
              <div className="ledger-kpi">
                <div className="ledger-kpi-accent" style={{ background: 'var(--grad-green)' }} />
                <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--concrete)' }}>Collected</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(payTotalPaid)}</div>
              </div>
              <div className="ledger-kpi">
                <div className="ledger-kpi-accent" style={{ background: 'var(--grad-rust)' }} />
                <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--concrete)' }}>Outstanding</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: payTotalBilled - payTotalPaid > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(payTotalBilled - payTotalPaid)}</div>
              </div>
            </div>

            {/* Vendor-wise summary */}
            {vendorPaySummary.length > 0 && (
              <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 'var(--sp-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: showVendorSummary ? 12 : 0 }} onClick={() => setShowVendorSummary(v => !v)}>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-mono)' }}>📊 Vendor-wise Summary ({vendorPaySummary.length})</div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gold-dark)', fontWeight: 700 }}>{showVendorSummary ? '▲ Hide' : '▼ Show'}</span>
                </div>
                {showVendorSummary && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, fontSize: '.6rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', padding: '4px 10px', borderBottom: '1px solid var(--hairline)', marginBottom: 4 }}>
                      <span>Contact</span><span style={{ textAlign: 'right' }}>Billed</span><span style={{ textAlign: 'right' }}>Paid</span><span style={{ textAlign: 'right' }}>Due</span>
                    </div>
                    {vendorPaySummary.map((v, i) => (
                      <div key={i} className="ledger-vendor-row">
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--ink)' }}>{v.name}</div>
                          <div style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>{v.role} · {v.count} milestone{v.count !== 1 ? 's' : ''}</div>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--ink)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(v.billed)}</span>
                        <span style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--green)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(v.paid)}</span>
                        <span style={{ fontWeight: 700, fontSize: '.78rem', color: v.billed - v.paid > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(v.billed - v.paid)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredPayments.length === 0 && <div className="empty-state"><p>No payments match the current filters.</p></div>}
              {filteredPayments.map((p, index) => {
                const pct = p.amount > 0 ? Math.round((p.paidAmount / p.amount) * 100) : 0;
                const contact = p.contactId ? contactMap[p.contactId] : null;
                const progressColor = p.status === 'Paid' ? 'var(--green)' : p.status === 'Overdue' ? 'var(--rust)' : p.status === 'Partially Paid' ? 'var(--amber)' : 'var(--gold)';
                const statusBadge = p.status === 'Paid' ? 'paid' : p.status === 'Overdue' ? 'overdue' : p.status === 'Partially Paid' ? 'partial' : 'pending';

                return (
                  <div key={p.id} className="ledger-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="mono" style={{ fontSize: '.7rem', color: 'var(--concrete)', fontWeight: 800 }}>#{p.order || index + 1}</span>
                          <strong style={{ fontSize: '.88rem', color: 'var(--ink)' }}>{p.milestone}</strong>
                          <span style={{
                            fontSize: '.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4,
                            background: statusBadge === 'paid' ? 'var(--green-light)' : statusBadge === 'overdue' ? 'var(--rust-light)' : statusBadge === 'partial' ? 'var(--amber-light)' : 'var(--gold-light)',
                            color: statusBadge === 'paid' ? 'var(--green)' : statusBadge === 'overdue' ? 'var(--rust)' : statusBadge === 'partial' ? 'var(--amber)' : 'var(--gold-dark)'
                          }}>{p.status}</span>
                        </div>
                        <div className="mono" style={{ fontSize: '.65rem', color: 'var(--concrete)', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '.6rem', padding: '1px 5px', borderRadius: 4, background: 'var(--gold-light)', color: 'var(--gold-dark)' }}>{p.type}</span>
                          {contact && <span>👥 {contact.name}</span>}
                          {p.linkedPhase && <span>📋 {p.linkedPhase}</span>}
                          {p.dueDate && <span>📅 Due: {p.dueDate}</span>}
                          {p.paidDate && <span>✅ Paid: {p.paidDate}</span>}
                        </div>
                        {p.billUrls && p.billUrls.length > 0 && (
                          <div className="ledger-bill-links">
                            {p.billUrls.map((url, i) => {
                              const isPdf = url.toLowerCase().endsWith('.pdf');
                              return <a key={i} className="ledger-bill-chip" href={url} target="_blank" rel="noopener noreferrer">{isPdf ? '📄 View PDF' : '🖼️ View Image'} {p.billUrls.length > 1 ? i + 1 : ''}</a>;
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--ink)' }}>{fmtAmt(p.amount)}</div>
                        <div className="mono" style={{ fontSize: '.65rem', color: 'var(--concrete)' }}>Paid: {fmtAmt(p.paidAmount)}</div>
                      </div>
                    </div>
                    {p.amount > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.65rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                          <span>Progress</span><span>{pct}%</span>
                        </div>
                        <div className="pay-progress-track">
                          <div className="pay-progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: progressColor }} />
                        </div>
                      </div>
                    )}
                    {p.notes && <div className="mono" style={{ fontSize: '.68rem', color: 'var(--concrete)', background: 'var(--paper-2)', padding: '4px 8px', borderRadius: 4, marginTop: 8, display: 'inline-block' }}>📝 {p.notes}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── MATERIALS VIEW ─── */}
        {viewType === 'materials' && (
          <>
            <div className="ledger-kpi-row">
              <div className="ledger-kpi">
                <div className="ledger-kpi-accent" style={{ background: 'var(--grad-gold)' }} />
                <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--concrete)' }}>Total Material Spend</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(matTotalSpent)}</div>
                <span className="mono" style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>{filteredMaterials.filter(m => (m.received || 0) > 0).length} receipts</span>
              </div>
              <div className="ledger-kpi">
                <div className="ledger-kpi-accent" style={{ background: 'var(--grad-green)' }} />
                <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--concrete)' }}>Unique Materials</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{new Set(filteredMaterials.map(m => m.name)).size}</div>
              </div>
              <div className="ledger-kpi">
                <div className="ledger-kpi-accent" style={{ background: 'var(--grad-amber)' }} />
                <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--concrete)' }}>Vendors</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--amber)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{matVendorSummary.length}</div>
              </div>
              <div className="ledger-kpi">
                <div className="ledger-kpi-accent" style={{ background: 'var(--grad-rust)' }} />
                <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--concrete)' }}>Transactions</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--concrete)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{filteredMaterials.length}</div>
              </div>
            </div>

            {/* Summary view toggle buttons */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
              <button className={`ledger-summary-toggle ${matSummaryView === 'vendor' ? 'active' : ''}`} onClick={() => setMatSummaryView(v => v === 'vendor' ? '' : 'vendor')}>🏢 Vendor Summary</button>
              <button className={`ledger-summary-toggle ${matSummaryView === 'category' ? 'active' : ''}`} onClick={() => setMatSummaryView(v => v === 'category' ? '' : 'category')}>📂 Category Summary</button>
            </div>

            {/* Vendor-wise Summary */}
            {matSummaryView === 'vendor' && (
              <div className="ledger-summary-panel" style={{ marginBottom: 'var(--sp-lg)' }}>
                <div style={{ padding: '14px 18px', borderBottom: '2px solid var(--hairline)' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--font-mono)' }}>🏢 Vendor-wise Purchase Summary</div>
                  <div style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{matVendorSummary.length} vendors · Total: {fmtAmt(matTotalSpent)}</div>
                </div>
                <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                  {matVendorSummary.map((v, i) => (
                    <div key={i} className="ledger-summary-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--ink)' }}>🏢 {v.vendor}</div>
                          <div style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{v.txCount} purchase(s)</div>
                        </div>
                        <div style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{fmtAmt(v.totalCost)}</div>
                      </div>
                      <div className="ledger-summary-sub">
                        {Object.entries(v.items).map(([mat, d]) => (
                          <span key={mat} className="ledger-summary-sub-item">{mat}: {d.qty.toFixed(1)} — {fmtAmt(d.cost)}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {matVendorSummary.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--concrete)', fontSize: '.78rem' }}>No vendor data available.</div>}
                </div>
              </div>
            )}

            {/* Category-wise Summary */}
            {matSummaryView === 'category' && (
              <div className="ledger-summary-panel" style={{ marginBottom: 'var(--sp-lg)' }}>
                <div style={{ padding: '14px 18px', borderBottom: '2px solid var(--hairline)' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--font-mono)' }}>📂 Category-wise Purchase Summary</div>
                  <div style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{matCatSummary.length} categories · Total: {fmtAmt(matTotalSpent)}</div>
                </div>
                <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                  {matCatSummary.map((c, i) => (
                    <div key={i} className="ledger-summary-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: (CAT_COLORS[c.category] || '#ccc') + '18', color: CAT_COLORS[c.category] || 'var(--concrete)', textTransform: 'uppercase' }}>{c.category}</span>
                            <span style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>{c.txCount} receipt(s)</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{fmtAmt(c.totalCost)}</div>
                      </div>
                      <div className="ledger-summary-sub">
                        {Object.entries(c.items).map(([mat, d]) => (
                          <span key={mat} className="ledger-summary-sub-item">{mat}: {d.qty.toFixed(1)} — {fmtAmt(d.cost)}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {matCatSummary.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--concrete)', fontSize: '.78rem' }}>No category data available.</div>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredMaterials.length === 0 && <div className="empty-state"><p>No material transactions found.</p></div>}
              {filteredMaterials.map(m => {
                const isR = (m.received || 0) > 0;
                const qty = isR ? m.received : m.consumed;
                return (
                  <div key={m.id} className="ledger-item" style={{ borderLeft: `4px solid ${isR ? 'var(--green)' : 'var(--rust)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: (CAT_COLORS[m.category] || '#ccc') + '18', color: CAT_COLORS[m.category] || 'var(--gold-dark)', textTransform: 'uppercase' }}>{m.category}</span>
                          <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink)' }}>{m.name}</span>
                          <span style={{ fontSize: '.78rem', fontWeight: 800, color: isR ? 'var(--green)' : 'var(--rust)', fontFamily: 'var(--font-mono)' }}>{isR ? '+' : '-'}{qty} {m.unit}</span>
                        </div>
                        <div className="mono" style={{ fontSize: '.65rem', color: 'var(--concrete)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {m.date && <span>📅 {fmtDate(m.date)}</span>}
                          {m.vendor && <span>🏢 {m.vendor}</span>}
                          {m.notes && <span>📝 {m.notes}</span>}
                        </div>
                        {m.billUrls && m.billUrls.length > 0 && (
                          <div className="ledger-bill-links">
                            {m.billUrls.map((url, i) => {
                              const isPdf = url.toLowerCase().endsWith('.pdf');
                              return <a key={i} className="ledger-bill-chip" href={url} target="_blank" rel="noopener noreferrer">{isPdf ? '📄 View PDF' : '🖼️ View Image'} {m.billUrls.length > 1 ? i + 1 : ''}</a>;
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {isR && m.rate > 0 && <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{fmtAmt(qty * m.rate)}</div>}
                        {isR && m.rate > 0 && <div className="mono" style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>@ {fmtAmt(m.rate)}/{m.unit}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '32px 0 16px', color: 'var(--concrete)', fontSize: '.7rem' }}>
          Shared from <strong>{project.name}</strong> — Omji Construction Dashboard
        </div>
      </div>
    </>
  );
}
