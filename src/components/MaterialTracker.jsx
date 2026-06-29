import { useState, useEffect, useMemo } from 'react';
import { addMaterial, updateMaterial, deleteMaterial, subscribeToMaterials } from '../services/localStorageService';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from './ConfirmDialog';

const UNITS = ['Bags','Tonnes','CFT','SqFt','RFT','Nos','Trips','Litres','Kg','Brass','Other'];
const MAT_CATEGORIES = ['Cement','Steel/TMT','Sand','Aggregate','Bricks','Blocks','Wood','Tiles','Paint','Plumbing','Electrical','Hardware','Other'];
const CAT_COLORS = { Cement:'#7C7468', 'Steel/TMT':'#C4441E', Sand:'#C5A880', Aggregate:'#9F835C', Bricks:'#D65A31', Blocks:'#B8862E', Wood:'#8F7D6B', Tiles:'#5B7553', Paint:'#4D6645', Plumbing:'#3D7CB8', Electrical:'#E8A838', Hardware:'#A39D94', Other:'#7C7468' };

// SVG Gauge component for stock level
const StockGauge = ({ pct, size = 28 }) => {
  const r = (size - 4) / 2, c = 2 * Math.PI * r;
  const color = pct <= 0 ? '#C4441E' : pct < 20 ? '#B8862E' : '#4D6645';
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--hairline)" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={c} strokeDashoffset={c - (Math.max(0, Math.min(100, pct)) / 100) * c}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)' }} />
      <text x={size/2} y={size/2 + 3} textAnchor="middle" fontSize="7" fontWeight="800" fill={color} fontFamily="var(--font-mono)">{Math.round(pct)}%</text>
    </svg>
  );
};

export default function MaterialTracker({ projectId, canEdit }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [materials, setMaterials] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterType, setFilterType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [form, setForm] = useState({ name:'', category:'Cement', unit:'Bags', txType:'Receipt', quantity:'', rate:'', vendor:'', date: new Date().toISOString().split('T')[0], notes:'' });

  useEffect(() => subscribeToMaterials(projectId, setMaterials), [projectId]);

  const resetForm = () => { setForm({ name:'', category:'Cement', unit:'Bags', txType:'Receipt', quantity:'', rate:'', vendor:'', date: new Date().toISOString().split('T')[0], notes:'' }); setEditId(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseFloat(form.quantity) || 0;
    if (qty <= 0) { toast.error('Quantity must be > 0'); return; }
    const data = { name: form.name, category: form.category, unit: form.unit, date: form.date, notes: form.notes, vendor: form.txType === 'Receipt' ? form.vendor : '', rate: form.txType === 'Receipt' ? (parseFloat(form.rate) || 0) : 0, received: form.txType === 'Receipt' ? qty : 0, consumed: form.txType === 'Consumption' ? qty : 0 };
    try {
      if (editId) { await updateMaterial(projectId, editId, data); toast.success('Updated'); }
      else { await addMaterial(projectId, data); toast.success('Transaction logged'); }
      resetForm();
    } catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleEdit = (m) => { const isR = (m.received||0) > 0; setForm({ name: m.name||'', category: m.category||'Cement', unit: m.unit||'Bags', txType: isR ? 'Receipt' : 'Consumption', quantity: String(isR ? m.received : m.consumed), rate: String(m.rate||''), vendor: m.vendor||'', date: m.date||'', notes: m.notes||'' }); setEditId(m.id); setShowForm(true); };

  const handleDelete = async (mid) => { const ok = await confirm({ title: 'Delete', message: 'Delete this transaction?', confirmText: 'Delete', danger: true }); if (ok) { try { await deleteMaterial(projectId, mid); toast.success('Deleted'); } catch(e) { toast.error(e.message); } } };

  const { stockItems, totalSpent, totalReceived, totalConsumed, catBreakdown, lowStock } = useMemo(() => {
    const sm = {};
    materials.forEach(m => {
      const k = `${m.name}|${m.unit}`;
      if (!sm[k]) sm[k] = { name: m.name, unit: m.unit, category: m.category, totalReceived: 0, totalConsumed: 0, totalCost: 0 };
      sm[k].totalReceived += (m.received||0);
      sm[k].totalConsumed += (m.consumed||0);
      sm[k].totalCost += (m.received||0) * (m.rate||0);
    });
    const items = Object.values(sm);
    const totalSpent = items.reduce((s, i) => s + i.totalCost, 0);
    const totalReceived = materials.reduce((s, m) => s + (m.received||0), 0);
    const totalConsumed = materials.reduce((s, m) => s + (m.consumed||0), 0);
    const cb = {};
    items.forEach(i => { if (!cb[i.category]) cb[i.category] = 0; cb[i.category] += i.totalCost; });
    const lowStock = items.filter(s => { const b = s.totalReceived - s.totalConsumed; return b < s.totalReceived * 0.2 && s.totalReceived > 0; });
    return { stockItems: items, totalSpent, totalReceived, totalConsumed, catBreakdown: cb, lowStock };
  }, [materials]);

  const filteredTx = materials.filter(m => {
    if (filterType === 'Receipt' && (m.received||0) <= 0) return false;
    if (filterType === 'Consumption' && (m.consumed||0) <= 0) return false;
    if (searchTerm && !`${m.name} ${m.category} ${m.vendor} ${m.notes}`.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const fmtAmt = (n) => '₹' + Number(n||0).toLocaleString('en-IN');
  const catEntries = Object.entries(catBreakdown).sort((a,b) => b[1]-a[1]);
  const maxCatVal = catEntries.length ? catEntries[0][1] : 1;

  // Sorted stock items
  const sortedStock = useMemo(() => {
    return [...stockItems].sort((a, b) => {
      let va, vb;
      if (sortKey === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (sortKey === 'balance') { va = a.totalReceived - a.totalConsumed; vb = b.totalReceived - b.totalConsumed; }
      else if (sortKey === 'cost') { va = a.totalCost; vb = b.totalCost; }
      else if (sortKey === 'received') { va = a.totalReceived; vb = b.totalReceived; }
      else { va = a.name; vb = b.name; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [stockItems, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortIcon = ({ k }) => sortKey === k ? <span style={{ marginLeft: 2 }}>{sortDir === 'asc' ? '▲' : '▼'}</span> : null;

  // Receipt vs Consumption donut data
  const rcDonut = useMemo(() => {
    const total = totalReceived + totalConsumed;
    if (!total) return { rPct: 50, cPct: 50 };
    return { rPct: (totalReceived / total) * 100, cPct: (totalConsumed / total) * 100 };
  }, [totalReceived, totalConsumed]);

  return (
    <div className="module-container">
      {dialog}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes mt-count { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mt-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(196,68,30,.25); } 50% { box-shadow:0 0 0 8px rgba(196,68,30,0); } }
        .mt-kpi { display:flex; flex-direction:column; padding:16px; border-radius:12px; background:var(--paper); border:1px solid var(--hairline); position:relative; overflow:hidden; transition:all .2s; animation:mt-count .4s ease; }
        .mt-kpi:hover { border-color:var(--gold); transform:translateY(-2px); box-shadow:var(--shadow-md); }
        .mt-kpi-accent { position:absolute; top:0; left:0; right:0; height:3px; }
        .mt-bar-row { display:flex; align-items:center; gap:10px; padding:6px 0; }
        .mt-bar-fill { height:8px; border-radius:4px; transition:width .6s cubic-bezier(.4,0,.2,1); min-width:2px; }
        .mt-stock-row { display:grid; grid-template-columns:32px 1.4fr .7fr .7fr .7fr .5fr .7fr; gap:8px; align-items:center; padding:10px 14px; border-radius:8px; font-size:.78rem; transition:all .15s; border:1px solid transparent; }
        .mt-stock-row:hover { background:var(--gold-light); border-color:var(--gold); }
        .mt-stock-row:nth-child(even) { background:var(--paper-2); }
        .mt-stock-row:nth-child(even):hover { background:var(--gold-light); }
        .mt-sort-btn { cursor:pointer; user-select:none; display:inline-flex; align-items:center; gap:2px; }
        .mt-sort-btn:hover { color:var(--gold-dark); }
        .mt-alert-pulse { animation:mt-pulse 2s infinite; }
      `}} />

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--sp-lg)' }}>
        <div>
          <h2 style={{ fontSize:'1.15rem', fontWeight:800, color:'var(--ink)', marginBottom:2, fontFamily:'var(--font-display)' }}>📦 Material Control & Inventory</h2>
          <p style={{ fontSize:'.72rem', color:'var(--concrete)', fontFamily:'var(--font-mono)' }}>{materials.length} transactions · {stockItems.length} unique materials</p>
        </div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Record Transaction</button>}
      </div>

      {/* KPI Dashboard Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'12px', marginBottom:'var(--sp-lg)' }}>
        <div className="mt-kpi">
          <div className="mt-kpi-accent" style={{ background:'var(--grad-gold)' }} />
          <span style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--concrete)', fontFamily:'var(--font-mono)' }}>Total Spend</span>
          <span style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--ink)', fontFamily:'var(--font-display)', lineHeight:1.2, marginTop:4 }}>{fmtAmt(totalSpent)}</span>
          <span style={{ fontSize:'.62rem', color:'var(--concrete)', fontFamily:'var(--font-mono)', marginTop:2 }}>{materials.filter(m=>(m.received||0)>0).length} purchase entries</span>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-accent" style={{ background:'var(--grad-green)' }} />
          <span style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--concrete)', fontFamily:'var(--font-mono)' }}>Materials Tracked</span>
          <span style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--green)', fontFamily:'var(--font-display)', lineHeight:1.2, marginTop:4 }}>{stockItems.length}</span>
          <span style={{ fontSize:'.62rem', color:'var(--concrete)', fontFamily:'var(--font-mono)', marginTop:2 }}>{MAT_CATEGORIES.filter(c => stockItems.some(s=>s.category===c)).length} categories active</span>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-accent" style={{ background: lowStock.length > 0 ? 'var(--grad-rust)' : 'var(--grad-green)' }} />
          <span style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--concrete)', fontFamily:'var(--font-mono)' }}>Low Stock Alerts</span>
          <span style={{ fontSize:'1.6rem', fontWeight:800, color: lowStock.length > 0 ? 'var(--rust)' : 'var(--green)', fontFamily:'var(--font-display)', lineHeight:1.2, marginTop:4 }}>{lowStock.length}</span>
          <span style={{ fontSize:'.62rem', color:'var(--concrete)', fontFamily:'var(--font-mono)', marginTop:2 }}>{lowStock.length > 0 ? 'reorder required' : 'all levels healthy'}</span>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-accent" style={{ background:'var(--grad-amber)' }} />
          <span style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--concrete)', fontFamily:'var(--font-mono)' }}>Transactions</span>
          <span style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--amber)', fontFamily:'var(--font-display)', lineHeight:1.2, marginTop:4 }}>{materials.length}</span>
          <span style={{ fontSize:'.62rem', color:'var(--concrete)', fontFamily:'var(--font-mono)', marginTop:2 }}>receipts & consumptions</span>
        </div>
      </div>

      {/* Low Stock Alerts Banner */}
      {lowStock.length > 0 && (
        <div style={{ background:'var(--rust-light)', border:'1px solid var(--rust)', borderRadius:'var(--radius-sm)', padding:'12px 16px', marginBottom:'var(--sp-lg)', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:'1.2rem' }}>⚠️</span>
          <div>
            <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--rust)' }}>Reorder Alert — {lowStock.length} material(s) running low</div>
            <div style={{ fontSize:'.7rem', color:'var(--rust)', opacity:.8, marginTop:2 }}>{lowStock.map(s => `${s.name} (${(s.totalReceived-s.totalConsumed).toFixed(1)} ${s.unit} left)`).join(' · ')}</div>
          </div>
        </div>
      )}

      {/* Three-Panel: Category + Donut + Stock Ledger */}
      <div className="mt-mobile-stack" style={{ display:'grid', gridTemplateColumns: catEntries.length > 0 ? '220px 1fr' : '1fr', gap:'var(--sp-md)', marginBottom:'var(--sp-lg)', alignItems:'start' }}>

        {/* Left Panel: Category Cost + Receipt vs Consumption Donut */}
        {catEntries.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--sp-md)' }}>
            {/* Category Cost Breakdown */}
            <div style={{ background:'var(--paper)', border:'1px solid var(--hairline)', borderRadius:'var(--radius)', padding:'16px' }}>
              <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--concrete)', fontFamily:'var(--font-mono)', marginBottom:12 }}>💰 Cost by Category</div>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {catEntries.map(([cat, val]) => (
                  <div key={cat} className="mt-bar-row">
                    <span style={{ width:62, fontSize:'.62rem', fontWeight:600, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat}</span>
                    <div style={{ flex:1 }}>
                      <div className="mt-bar-fill" style={{ width:`${Math.max((val/maxCatVal)*100, 4)}%`, background: CAT_COLORS[cat] || 'var(--gold)', opacity:.85 }} />
                    </div>
                    <span style={{ fontSize:'.58rem', fontWeight:700, color:'var(--concrete)', fontFamily:'var(--font-mono)', minWidth:50, textAlign:'right' }}>{fmtAmt(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Receipt vs Consumption Donut */}
            <div style={{ background:'var(--paper)', border:'1px solid var(--hairline)', borderRadius:'var(--radius)', padding:'16px', textAlign:'center' }}>
              <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--concrete)', fontFamily:'var(--font-mono)', marginBottom:12 }}>📊 Flow Analysis</div>
              <svg viewBox="0 0 80 80" width="100" height="100" style={{ margin:'0 auto', display:'block' }}>
                <circle cx="40" cy="40" r="30" fill="none" stroke="var(--green)" strokeWidth="10" strokeDasharray={`${rcDonut.rPct * 1.884} ${188.4 - rcDonut.rPct * 1.884}`} transform="rotate(-90 40 40)" />
                <circle cx="40" cy="40" r="30" fill="none" stroke="var(--rust)" strokeWidth="10" strokeDasharray={`${rcDonut.cPct * 1.884} ${188.4 - rcDonut.cPct * 1.884}`} strokeDashoffset={`-${rcDonut.rPct * 1.884}`} transform="rotate(-90 40 40)" />
                <circle cx="40" cy="40" r="22" fill="var(--paper)" />
                <text x="40" y="43" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--ink)" fontFamily="var(--font-mono)">{materials.length}</text>
              </svg>
              <div style={{ display:'flex', justifyContent:'center', gap:14, marginTop:8 }}>
                <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.62rem', color:'var(--concrete)' }}><span style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)' }}></span>Received</span>
                <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.62rem', color:'var(--concrete)' }}><span style={{ width:7, height:7, borderRadius:'50%', background:'var(--rust)' }}></span>Consumed</span>
              </div>
            </div>
          </div>
        )}

        {/* Stock Ledger Table with Gauges + Sorting */}
        {sortedStock.length > 0 && (
          <div style={{ background:'var(--paper)', border:'1px solid var(--hairline)', borderRadius:'var(--radius)', padding:'16px', overflow:'auto' }}>
            <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--concrete)', fontFamily:'var(--font-mono)', marginBottom:12 }}>📋 Live Stock Ledger — {sortedStock.length} items</div>
            {/* Sortable Header */}
            <div className="mt-stock-row" style={{ fontWeight:700, fontSize:'.6rem', color:'var(--concrete)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'.04em', borderBottom:'2px solid var(--hairline)', paddingBottom:8, marginBottom:4 }}>
              <span></span>
              <span className="mt-sort-btn" onClick={() => toggleSort('name')}>Material<SortIcon k="name" /></span>
              <span>Category</span>
              <span className="mt-sort-btn" onClick={() => toggleSort('received')}>Received<SortIcon k="received" /></span>
              <span>Consumed</span>
              <span className="mt-sort-btn" onClick={() => toggleSort('balance')}>Bal<SortIcon k="balance" /></span>
              <span className="mt-sort-btn" onClick={() => toggleSort('cost')}>Spent<SortIcon k="cost" /></span>
            </div>
            {sortedStock.map((s,i) => {
              const bal = s.totalReceived - s.totalConsumed;
              const pct = s.totalReceived > 0 ? (bal / s.totalReceived) * 100 : 0;
              let status = 'Healthy', sColor = 'var(--green)', sBg = 'var(--green-light)';
              if (bal <= 0) { status = 'Out'; sColor = 'var(--rust)'; sBg = 'var(--rust-light)'; }
              else if (pct < 20) { status = 'Low'; sColor = 'var(--amber)'; sBg = 'var(--amber-light)'; }
              return (
                <div key={i} className={`mt-stock-row ${status === 'Low' || status === 'Out' ? 'mt-alert-pulse' : ''}`}>
                  <StockGauge pct={pct} />
                  <span style={{ fontWeight:700, color:'var(--ink)' }}>{s.name}</span>
                  <span><span style={{ fontSize:'.58rem', fontWeight:600, padding:'2px 5px', borderRadius:4, background: (CAT_COLORS[s.category]||'#ccc')+'18', color: CAT_COLORS[s.category]||'var(--concrete)' }}>{s.category}</span></span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'.7rem', color:'var(--green)' }}>+{s.totalReceived.toFixed(1)} {s.unit}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'.7rem', color:'var(--rust)' }}>-{s.totalConsumed.toFixed(1)} {s.unit}</span>
                  <span style={{ fontWeight:800, color:sColor, fontFamily:'var(--font-mono)', fontSize:'.72rem' }}>{bal.toFixed(1)}</span>
                  <span style={{ fontSize:'.62rem', fontWeight:700, color:'var(--ink)', fontFamily:'var(--font-mono)' }}>{fmtAmt(s.totalCost)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction Log with Search */}
      <div style={{ background:'var(--paper)', border:'1px solid var(--hairline)', borderRadius:'var(--radius)', padding:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
          <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--concrete)', fontFamily:'var(--font-mono)' }}>Transaction Ledger ({filteredTx.length})</div>
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search..." style={{ padding:'5px 10px', border:'1px solid var(--hairline)', borderRadius:6, fontSize:'.75rem', fontFamily:'var(--font-body)', width:140, background:'var(--paper-2)' }} />
            {['All','Receipt','Consumption'].map(t => (
              <button key={t} onClick={() => setFilterType(t)} style={{ padding:'4px 10px', borderRadius:6, fontSize:'.65rem', fontWeight:700, cursor:'pointer', border: filterType===t ? '1.5px solid var(--ink)' : '1.5px solid var(--hairline)', background: filterType===t ? 'var(--ink)' : 'var(--paper)', color: filterType===t ? '#fff' : 'var(--concrete)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'.04em', transition:'all .15s' }}>
                {t === 'All' ? 'All' : t === 'Receipt' ? 'GRN In' : 'Used'}
              </button>
            ))}
          </div>
        </div>
        {filteredTx.length === 0 && <div style={{ textAlign:'center', padding:'30px', color:'var(--concrete)', fontSize:'.8rem' }}>No transactions match current filters.</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:400, overflowY:'auto' }}>
          {filteredTx.map(m => {
            const isR = (m.received||0) > 0;
            const qty = isR ? m.received : m.consumed;
            return (
              <div key={m.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderRadius:8, border:'1px solid var(--hairline)', borderLeft:`4px solid ${isR ? 'var(--green)' : 'var(--rust)'}`, background:'#fff', transition:'all .15s' }} className="bh-item">
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:'.6rem', fontWeight:600, padding:'2px 6px', borderRadius:4, background:(CAT_COLORS[m.category]||'#ccc')+'18', color:CAT_COLORS[m.category]||'var(--concrete)' }}>{m.category}</span>
                    <span style={{ fontSize:'.8rem', fontWeight:700, color:'var(--ink)' }}>{m.name}</span>
                    <span style={{ fontSize:'.78rem', fontWeight:800, color: isR ? 'var(--green)' : 'var(--rust)', fontFamily:'var(--font-mono)' }}>{isR ? '+' : '-'}{qty} {m.unit}</span>
                  </div>
                  <div style={{ fontSize:'.65rem', color:'var(--concrete)', marginTop:3, fontFamily:'var(--font-mono)', display:'flex', gap:10, flexWrap:'wrap' }}>
                    {m.date && <span>📅 {m.date}</span>}
                    {isR && m.vendor && <span>🏢 {m.vendor}</span>}
                    {m.notes && <span>📝 {m.notes}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {isR && m.rate > 0 && <span style={{ fontSize:'.75rem', fontWeight:700, color:'var(--ink)', fontFamily:'var(--font-mono)' }}>{fmtAmt(qty*m.rate)}</span>}
                  {canEdit && (
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="expense-action-btn" onClick={() => handleEdit(m)} title="Edit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                      <button className="expense-action-btn del" onClick={() => handleDelete(m.id)} title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Edit' : 'Record'} Material Transaction</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Transaction Type *</label>
                <div style={{ display:'flex', gap:16 }}>
                  {['Receipt','Consumption'].map(t => (
                    <label key={t} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:'8px 14px', borderRadius:8, border: form.txType===t ? '2px solid var(--ink)' : '1.5px solid var(--hairline)', background: form.txType===t ? 'var(--gold-light)' : 'var(--paper)', fontWeight: form.txType===t ? 700 : 500, fontSize:'.82rem', transition:'all .15s' }}>
                      <input type="radio" name="txType" checked={form.txType===t} onChange={() => setForm(p=>({...p,txType:t}))} style={{ display:'none' }} />
                      {t === 'Receipt' ? '📥 Receipt (GRN)' : '📤 Consumption (Issue)'}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label>Material Name *</label><input className="form-input" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} required placeholder="OPC 53 Cement, Fe 550 TMT..." /></div>
                <div className="form-group"><label>Category</label><select className="form-select" value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}>{MAT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div className="form-grid-3">
                <div className="form-group"><label>Quantity *</label><input className="form-input" type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => setForm(p=>({...p,quantity:e.target.value}))} required /></div>
                <div className="form-group"><label>Unit</label><select className="form-select" value={form.unit} onChange={e => setForm(p=>({...p,unit:e.target.value}))}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
                <div className="form-group"><label>Date *</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} required /></div>
              </div>
              {form.txType === 'Receipt' && (
                <div className="form-grid-2">
                  <div className="form-group"><label>Supplier</label><input className="form-input" value={form.vendor} onChange={e => setForm(p=>({...p,vendor:e.target.value}))} placeholder="Vendor name" /></div>
                  <div className="form-group"><label>Rate (₹/unit)</label><input className="form-input" type="number" min="0" value={form.rate} onChange={e => setForm(p=>({...p,rate:e.target.value}))} /></div>
                </div>
              )}
              <div className="form-group"><label>{form.txType === 'Receipt' ? 'Notes (Challan / Invoice)' : 'Usage Location'}</label><input className="form-input" value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} /></div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId ? '✓ Update' : '+ Add Transaction'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
