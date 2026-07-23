import { useState, useEffect, useMemo } from 'react';
import { addMaterial, updateMaterial, deleteMaterial, subscribeToMaterials, uploadPhoto } from '../services/localStorageService';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from './ConfirmDialog';
import { exportTableToPDF } from '../utils/pdfExporter';

const DEFAULT_UNITS = ['Bags', 'Tonnes', 'CFT', 'SqFt', 'RFT', 'Nos', 'Trips', 'Litres', 'Kg', 'Brass', 'm³', 'Other'];
const DEFAULT_CATEGORIES = ['Cement', 'Steel/TMT', 'Sand', 'Aggregate', 'Bricks', 'Blocks', 'RMC', 'Wood', 'Tiles', 'Paint', 'Plumbing', 'Electrical', 'Hardware', 'Other'];
const RMC_GRADES = ['M5', 'M10', 'M15', 'M20', 'M25', 'M30'];
const TX_TYPES = ['Receipt', 'Consumption', 'Subcontractor Payment'];
const CAT_COLORS = {
  Cement: '#7C7468', 'Steel/TMT': '#C4441E', Sand: '#C5A880', Aggregate: '#9F835C',
  Bricks: '#D65A31', Blocks: '#B8862E', RMC: '#3D7CB8', Wood: '#8F7D6B',
  Tiles: '#5B7553', Paint: '#4D6645', Plumbing: '#3D7CB8', Electrical: '#E8A838',
  Hardware: '#A39D94', Other: '#7C7468'
};

// Custom category/unit helpers using localStorage
function getCustomList(projectId, type) {
  try { return JSON.parse(localStorage.getItem(`project_${projectId}_custom_${type}`) || '[]'); } catch { return []; }
}
function saveCustomList(projectId, type, list) {
  localStorage.setItem(`project_${projectId}_custom_${type}`, JSON.stringify(list));
}

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

export default function MaterialTracker({ projectId, canEdit, contacts = [], project }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [materials, setMaterials] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterType, setFilterType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [activeView, setActiveView] = useState('stock'); // 'stock' | 'vendor' | 'kpi'
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCustomCatForm, setShowCustomCatForm] = useState(false);
  const [showCustomUnitForm, setShowCustomUnitForm] = useState(false);
  const [customCatInput, setCustomCatInput] = useState('');
  const [customUnitInput, setCustomUnitInput] = useState('');

  // Custom categories/units from localStorage
  const [customCategories, setCustomCategories] = useState(() => getCustomList(projectId, 'categories'));
  const [customUnits, setCustomUnits] = useState(() => getCustomList(projectId, 'units'));

  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);
  const allUnits = useMemo(() => [...DEFAULT_UNITS, ...customUnits], [customUnits]);

  // Vendor contacts (Vendor or Contractor role)
  const vendorContacts = useMemo(() =>
    contacts.filter(c => ['Vendor', 'Contractor'].includes(c.role)),
    [contacts]
  );

  const emptyForm = () => ({
    name: '', category: 'Cement', unit: 'Bags', txType: 'Receipt',
    quantity: '', rate: '', vendor: '', date: new Date().toISOString().split('T')[0],
    notes: '', billUrls: [], rmcGrade: 'M25', subcontractorName: '', subcontractorAmount: ''
  });

  const [form, setForm] = useState(emptyForm());

  useEffect(() => subscribeToMaterials(projectId, setMaterials), [projectId]);

  const resetForm = () => { setForm(emptyForm()); setEditId(null); setShowForm(false); };

  const handleAddCustomCategory = () => {
    const val = customCatInput.trim();
    if (!val) return;
    const updated = [...customCategories, val];
    setCustomCategories(updated);
    saveCustomList(projectId, 'categories', updated);
    setForm(p => ({ ...p, category: val }));
    setCustomCatInput('');
    setShowCustomCatForm(false);
    toast.success(`Category "${val}" added`);
  };

  const handleAddCustomUnit = () => {
    const val = customUnitInput.trim();
    if (!val) return;
    const updated = [...customUnits, val];
    setCustomUnits(updated);
    saveCustomList(projectId, 'units', updated);
    setForm(p => ({ ...p, unit: val }));
    setCustomUnitInput('');
    setShowCustomUnitForm(false);
    toast.success(`Unit "${val}" added`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.txType === 'Subcontractor Payment') {
      const amt = parseFloat(form.subcontractorAmount) || 0;
      if (amt <= 0) { toast.error('Amount must be > 0'); return; }
      const data = {
        name: `Subcontractor: ${form.subcontractorName || 'Payment'}`,
        category: 'Subcontractor Payment',
        unit: '₹',
        date: form.date,
        notes: form.notes,
        vendor: form.subcontractorName,
        rate: 0,
        received: 0,
        consumed: 0,
        subcontractorPayment: amt,
        billUrls: form.billUrls || []
      };
      try {
        if (editId) { await updateMaterial(projectId, editId, data); toast.success('Updated'); }
        else { await addMaterial(projectId, data); toast.success('Payment logged'); }
        resetForm();
      } catch (err) { toast.error('Failed: ' + err.message); }
      return;
    }

    const qty = parseFloat(form.quantity) || 0;
    if (qty <= 0) { toast.error('Quantity must be > 0'); return; }

    // Determine effective name (for RMC, append grade)
    const effectiveName = form.category === 'RMC'
      ? `RMC — ${form.rmcGrade}`
      : form.name;

    const data = {
      name: effectiveName,
      category: form.category,
      unit: form.category === 'RMC' ? 'm³' : form.unit,
      rmcGrade: form.category === 'RMC' ? form.rmcGrade : undefined,
      date: form.date,
      notes: form.notes,
      vendor: form.txType === 'Receipt' ? form.vendor : '',
      rate: form.txType === 'Receipt' ? (parseFloat(form.rate) || 0) : 0,
      received: form.txType === 'Receipt' ? qty : 0,
      consumed: form.txType === 'Consumption' ? qty : 0,
      billUrls: form.billUrls || []
    };
    try {
      if (editId) { await updateMaterial(projectId, editId, data); toast.success('Updated'); }
      else { await addMaterial(projectId, data); toast.success('Transaction logged'); }
      resetForm();
    } catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleEdit = (m) => {
    const isSub = m.category === 'Subcontractor Payment';
    const isR = (m.received || 0) > 0;
    setForm({
      name: m.name || '',
      category: m.category || 'Cement',
      unit: m.unit || 'Bags',
      txType: isSub ? 'Subcontractor Payment' : isR ? 'Receipt' : 'Consumption',
      quantity: String(isR ? m.received : m.consumed),
      rate: String(m.rate || ''),
      vendor: m.vendor || '',
      date: m.date || '',
      notes: m.notes || '',
      billUrls: m.billUrls || [],
      rmcGrade: m.rmcGrade || 'M25',
      subcontractorName: m.vendor || '',
      subcontractorAmount: String(m.subcontractorPayment || '')
    });
    setEditId(m.id);
    setShowForm(true);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true); setUploadProgress(0);
    try {
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const res = await uploadPhoto(projectId, 'material-bill', files[i]);
        uploadedUrls.push(res.url);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      setForm(prev => ({ ...prev, billUrls: [...(prev.billUrls || []), ...uploadedUrls] }));
      toast.success(`${uploadedUrls.length} bill(s) uploaded.`);
    } catch (err) { toast.error('Upload failed: ' + err.message); }
    setUploading(false); setUploadProgress(0);
  };

  const handleDelete = async (mid) => {
    const ok = await confirm({ title: 'Delete', message: 'Delete this transaction?', confirmText: 'Delete', danger: true });
    if (ok) { try { await deleteMaterial(projectId, mid); toast.success('Deleted'); } catch (e) { toast.error(e.message); } }
  };

  const handleShare = () => {
    if (!project?.slug) { toast.error('Project has no public link'); return; }
    const url = `${window.location.origin}/p/${project.slug}/ledger?view=materials`;
    navigator.clipboard.writeText(url);
    toast.success('Material ledger link copied!');
  };

  // ─── Computed stats ───
  const { stockItems, totalSpent, totalSubPaid, catBreakdown, lowStock, vendorBreakdown, materialKPIs } = useMemo(() => {
    const sm = {};
    const vb = {};
    let totalSpent = 0;
    let totalSubPaid = 0;

    materials.forEach(m => {
      if (m.category === 'Subcontractor Payment') {
        totalSubPaid += (m.subcontractorPayment || 0);
        const vk = m.vendor || 'Unknown';
        if (!vb[vk]) vb[vk] = { qty: 0, cost: 0, isSubcontractor: true };
        vb[vk].cost += (m.subcontractorPayment || 0);
        return;
      }
      const k = `${m.name}|${m.unit}`;
      if (!sm[k]) sm[k] = { name: m.name, unit: m.unit, category: m.category, rmcGrade: m.rmcGrade, totalReceived: 0, totalConsumed: 0, totalCost: 0 };
      sm[k].totalReceived += (m.received || 0);
      sm[k].totalConsumed += (m.consumed || 0);
      sm[k].totalCost += (m.received || 0) * (m.rate || 0);

      // Vendor breakdown
      if ((m.received || 0) > 0 && m.vendor) {
        const vk = m.vendor;
        if (!vb[vk]) vb[vk] = { qty: 0, cost: 0, entries: 0 };
        vb[vk].qty += (m.received || 0);
        vb[vk].cost += (m.received || 0) * (m.rate || 0);
        vb[vk].entries = (vb[vk].entries || 0) + 1;
      }
    });

    const items = Object.values(sm);
    totalSpent = items.reduce((s, i) => s + i.totalCost, 0);

    const cb = {};
    items.forEach(i => { if (!cb[i.category]) cb[i.category] = 0; cb[i.category] += i.totalCost; });

    const lowStock = items.filter(s => { const b = s.totalReceived - s.totalConsumed; return b < s.totalReceived * 0.2 && s.totalReceived > 0; });

    // Material-specific KPIs
    const materialKPIs = {};
    materials.forEach(m => {
      if (m.category === 'Subcontractor Payment') return;
      if ((m.received || 0) > 0) {
        const key = m.category === 'RMC' ? `RMC_${m.rmcGrade || 'M25'}` : m.category;
        if (!materialKPIs[key]) materialKPIs[key] = { total: 0, unit: m.unit, category: m.category, grade: m.rmcGrade };
        materialKPIs[key].total += (m.received || 0);
      }
    });

    return { stockItems: items, totalSpent, totalSubPaid, catBreakdown: cb, lowStock, vendorBreakdown: vb, materialKPIs };
  }, [materials]);

  const filteredTx = materials.filter(m => {
    if (filterType === 'Receipt' && (m.received || 0) <= 0) return false;
    if (filterType === 'Consumption' && (m.consumed || 0) <= 0) return false;
    if (filterType === 'SubPayment' && m.category !== 'Subcontractor Payment') return false;
    if (searchTerm && !`${m.name} ${m.category} ${m.vendor} ${m.notes}`.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const fmtAmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const catEntries = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]);
  const maxCatVal = catEntries.length ? catEntries[0][1] : 1;

  const vendorEntries = Object.entries(vendorBreakdown).sort((a, b) => b[1].cost - a[1].cost);
  const maxVendorCost = vendorEntries.length ? vendorEntries[0][1].cost : 1;

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

  const rcDonut = useMemo(() => {
    const tR = materials.filter(m => m.category !== 'Subcontractor Payment').reduce((s, m) => s + (m.received || 0), 0);
    const tC = materials.filter(m => m.category !== 'Subcontractor Payment').reduce((s, m) => s + (m.consumed || 0), 0);
    const total = tR + tC;
    if (!total) return { rPct: 50, cPct: 50 };
    return { rPct: (tR / total) * 100, cPct: (tC / total) * 100 };
  }, [materials]);

  const handleExportPDF = () => {
    const headers = ['Date', 'Type', 'Category', 'Material', 'Qty', 'Unit', 'Rate', 'Total', 'Vendor/Sub', 'Notes'];
    const rows = filteredTx.map(m => {
      const isSub = m.category === 'Subcontractor Payment';
      const isR = (m.received || 0) > 0;
      const qty = isSub ? '' : isR ? m.received : m.consumed;
      const total = isSub ? fmtAmt(m.subcontractorPayment) : (isR && m.rate > 0 ? fmtAmt(qty * m.rate) : '');
      return [
        m.date || '', isSub ? 'Sub Payment' : isR ? 'Receipt' : 'Consumption',
        m.category || '', m.name || '', qty, m.unit || '',
        m.rate > 0 ? fmtAmt(m.rate) : '', total, m.vendor || '', m.notes || ''
      ];
    });
    exportTableToPDF('Material Transactions', headers, rows);
  };

  // KPI highlight items
  const kpiHighlights = [
    { key: 'Bricks', label: 'Bricks', emoji: '🧱', unit: 'Nos' },
    { key: 'Sand', label: 'Sand', emoji: '🏜️', unit: 'Tonnes' },
    { key: 'Aggregate', label: 'Aggregate', emoji: '🪨', unit: 'Tonnes' },
    { key: 'Cement', label: 'Cement', emoji: '🏗️', unit: 'Bags' },
  ];

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
        .mt-stock-row { display:grid; grid-template-columns:32px 1.4fr .7fr .7fr .7fr .5fr .7fr; gap:8px; align-items:center; padding:10px 14px; border-radius:8px; font-size:.78rem; transition:all .15s; border:1px solid transparent; min-width: 550px; }
        .mt-stock-row:hover { background:var(--gold-light); border-color:var(--gold); }
        .mt-stock-row:nth-child(even) { background:var(--paper-2); }
        .mt-stock-row:nth-child(even):hover { background:var(--gold-light); }
        .mt-sort-btn { cursor:pointer; user-select:none; display:inline-flex; align-items:center; gap:2px; }
        .mt-sort-btn:hover { color:var(--gold-dark); }
        .mt-alert-pulse { animation:mt-pulse 2s infinite; }
        .mt-view-tab { padding:5px 12px; border-radius:6px; font-size:.65rem; font-weight:700; cursor:pointer; border:1.5px solid var(--hairline); background:var(--paper); color:var(--concrete); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:.04em; transition:all .15s; }
        .mt-view-tab.active { border-color:var(--ink); background:var(--ink); color:#fff; }
        .mt-view-tab:hover:not(.active) { border-color:var(--gold); color:var(--gold-dark); }
        .mt-vendor-row { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; border:1px solid var(--hairline); background:var(--paper); transition:all .15s; }
        .mt-vendor-row:hover { border-color:var(--gold); background:var(--gold-light); }
        .mt-kpi-hi { display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:10px; background:var(--paper); border:1px solid var(--hairline); transition:all .2s; }
        .mt-kpi-hi:hover { border-color:var(--gold); box-shadow:var(--shadow-sm); }
        .mt-tx-card { display:flex; flex-direction:column; padding:12px 14px; border-radius:8px; border:1px solid var(--hairline); background:#fff; transition:all .15s; }
        .mt-tx-card:hover { border-color:var(--gold); box-shadow:var(--shadow-sm); }
        .mt-tx-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
        .mt-tx-main { flex:1; min-width:0; }
        .mt-tx-amt-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:4px; }
        .mt-tx-meta { font-size:.65rem; color:var(--concrete); margin-top:4px; font-family:var(--font-mono); display:flex; gap:10px; flex-wrap:wrap; }
        .mt-tx-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
        @media (max-width: 768px) {
          .mt-stock-layout { grid-template-columns: 1fr !important; }
          .mt-tx-top { flex-wrap: wrap; }
          .mt-tx-actions { width:100%; justify-content:flex-end; padding-top:10px; border-top:1px solid var(--hairline); margin-top:6px; }
          .expense-action-btn { width:38px; height:38px; display:inline-flex; align-items:center; justify-content:center; }
        }
      `}} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 2, fontFamily: 'var(--font-display)' }}>📦 Material Control &amp; Inventory</h2>
          <p style={{ fontSize: '.72rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>{materials.length} transactions · {stockItems.length} unique materials{totalSubPaid > 0 ? ` · ${fmtAmt(totalSubPaid)} to subcontractors` : ''}</p>
        </div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyForm()); setShowForm(true); }}>+ Record Transaction</button>}
      </div>

      {/* ── Material KPI Highlights (Bricks / Sand / Aggregate / Cement / RMC by grade) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 'var(--sp-lg)' }}>
        {kpiHighlights.map(h => {
          const val = materialKPIs[h.key]?.total || 0;
          return (
            <div key={h.key} className="mt-kpi-hi">
              <span style={{ fontSize: '1.4rem' }}>{h.emoji}</span>
              <div>
                <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>{h.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: val > 0 ? 'var(--ink)' : 'var(--concrete)', fontFamily: 'var(--font-display)' }}>{val > 0 ? val.toFixed(1) : '—'}</div>
                <div style={{ fontSize: '.6rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>{h.unit} received</div>
              </div>
            </div>
          );
        })}
        {/* RMC per grade */}
        {RMC_GRADES.filter(g => materialKPIs[`RMC_${g}`]).map(g => {
          const val = materialKPIs[`RMC_${g}`]?.total || 0;
          return (
            <div key={g} className="mt-kpi-hi" style={{ borderColor: 'var(--blue)' }}>
              <span style={{ fontSize: '1.4rem' }}>🏭</span>
              <div>
                <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>RMC {g}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{val.toFixed(1)}</div>
                <div style={{ fontSize: '.6rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>m³ received</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Summary KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: 'var(--sp-lg)' }}>
        <div className="mt-kpi">
          <div className="mt-kpi-accent" style={{ background: 'var(--grad-gold)' }} />
          <span style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>Total Spend</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)', lineHeight: 1.2, marginTop: 4 }}>{fmtAmt(totalSpent)}</span>
          <span style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{materials.filter(m => (m.received || 0) > 0).length} purchase entries</span>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-accent" style={{ background: 'var(--grad-green)' }} />
          <span style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>Materials Tracked</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', lineHeight: 1.2, marginTop: 4 }}>{stockItems.length}</span>
          <span style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{allCategories.filter(c => stockItems.some(s => s.category === c)).length} categories active</span>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-accent" style={{ background: lowStock.length > 0 ? 'var(--grad-rust)' : 'var(--grad-green)' }} />
          <span style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>Low Stock Alerts</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: lowStock.length > 0 ? 'var(--rust)' : 'var(--green)', fontFamily: 'var(--font-display)', lineHeight: 1.2, marginTop: 4 }}>{lowStock.length}</span>
          <span style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{lowStock.length > 0 ? 'reorder required' : 'all levels healthy'}</span>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-accent" style={{ background: 'var(--grad-amber)' }} />
          <span style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>Sub Payments</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--amber)', fontFamily: 'var(--font-display)', lineHeight: 1.2, marginTop: 4 }}>{fmtAmt(totalSubPaid)}</span>
          <span style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>paid to subcontractors</span>
        </div>
      </div>

      {/* ── Low Stock Banner ── */}
      {lowStock.length > 0 && (
        <div style={{ background: 'var(--rust-light)', border: '1px solid var(--rust)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 'var(--sp-lg)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--rust)' }}>Reorder Alert — {lowStock.length} material(s) running low</div>
            <div style={{ fontSize: '.7rem', color: 'var(--rust)', opacity: .8, marginTop: 2 }}>{lowStock.map(s => `${s.name} (${(s.totalReceived - s.totalConsumed).toFixed(1)} ${s.unit} left)`).join(' · ')}</div>
          </div>
        </div>
      )}

      {/* ── Dashboard View Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
        {[{ id: 'stock', label: '📋 Stock Ledger' }, { id: 'vendor', label: '🏢 By Vendor' }, { id: 'charts', label: '📊 Charts' }].map(v => (
          <button key={v.id} className={`mt-view-tab ${activeView === v.id ? 'active' : ''}`} onClick={() => setActiveView(v.id)}>{v.label}</button>
        ))}
      </div>

      {/* ── Stock Ledger View ── */}
      {activeView === 'stock' && (
        <div className="mt-stock-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)', alignItems: 'start' }}>
          {sortedStock.length > 0 && (
            <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px', overflow: 'auto', maxHeight: '450px' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>📋 Live Stock Ledger — {sortedStock.length} items</div>
              <div className="mt-stock-row" style={{ fontWeight: 700, fontSize: '.6rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '2px solid var(--hairline)', paddingBottom: 8, marginBottom: 4 }}>
                <span></span>
                <span className="mt-sort-btn" onClick={() => toggleSort('name')}>Material<SortIcon k="name" /></span>
                <span>Category</span>
                <span className="mt-sort-btn" onClick={() => toggleSort('received')}>Received<SortIcon k="received" /></span>
                <span>Consumed</span>
                <span className="mt-sort-btn" onClick={() => toggleSort('balance')}>Balance<SortIcon k="balance" /></span>
                <span className="mt-sort-btn" onClick={() => toggleSort('cost')}>Spent<SortIcon k="cost" /></span>
              </div>
              {sortedStock.map((s, i) => {
                const bal = s.totalReceived - s.totalConsumed;
                const pct = s.totalReceived > 0 ? (bal / s.totalReceived) * 100 : 0;
                let sColor = 'var(--green)';
                if (bal <= 0) sColor = 'var(--rust)';
                else if (pct < 20) sColor = 'var(--amber)';
                const status = bal <= 0 ? 'Out' : pct < 20 ? 'Low' : 'Healthy';
                return (
                  <div key={i} className={`mt-stock-row ${status !== 'Healthy' ? 'mt-alert-pulse' : ''}`}>
                    <StockGauge pct={pct} />
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{s.name}</span>
                    <span><span style={{ fontSize: '.58rem', fontWeight: 600, padding: '2px 5px', borderRadius: 4, background: (CAT_COLORS[s.category] || '#ccc') + '18', color: CAT_COLORS[s.category] || 'var(--concrete)' }}>{s.category}</span></span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--green)' }}>+{s.totalReceived.toFixed(1)} {s.unit}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--rust)' }}>-{s.totalConsumed.toFixed(1)} {s.unit}</span>
                    <span style={{ fontWeight: 800, color: sColor, fontFamily: 'var(--font-mono)', fontSize: '.72rem' }}>{bal.toFixed(1)}</span>
                    <span style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{fmtAmt(s.totalCost)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Vendor View ── */}
      {activeView === 'vendor' && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: 'var(--sp-lg)' }}>
          <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>🏢 Material &amp; Payment by Vendor</div>
          {vendorEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--concrete)', fontSize: '.8rem' }}>No vendor data yet. Add receipts with a vendor name.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vendorEntries.map(([vendor, data]) => (
                <div key={vendor} className="mt-vendor-row">
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-light)', border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.8rem', color: 'var(--gold-dark)', flexShrink: 0 }}>
                    {vendor.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--ink)' }}>{vendor}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {data.isSubcontractor ? '🔧 Subcontractor' : `📦 ${data.qty?.toFixed(1)} units · ${data.entries || 0} entries`}
                    </div>
                    {/* Bar */}
                    <div style={{ height: 4, background: 'var(--hairline)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max((data.cost / maxVendorCost) * 100, 3)}%`, background: data.isSubcontractor ? 'var(--amber)' : 'var(--grad-gold)', borderRadius: 2, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '.88rem', color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{fmtAmt(data.cost)}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>{data.isSubcontractor ? 'paid' : 'spent'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Charts View ── */}
      {activeView === 'charts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
          {/* Category cost bar */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px' }}>
            <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>💰 Cost by Category</div>
            {catEntries.length === 0 ? <div style={{ color: 'var(--concrete)', fontSize: '.8rem', textAlign: 'center', padding: 20 }}>No data</div> : catEntries.map(([cat, val]) => (
              <div key={cat} className="mt-bar-row">
                <span style={{ width: 70, fontSize: '.62rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                <div style={{ flex: 1 }}>
                  <div className="mt-bar-fill" style={{ width: `${Math.max((val / maxCatVal) * 100, 4)}%`, background: CAT_COLORS[cat] || 'var(--gold)', opacity: .85 }} />
                </div>
                <span style={{ fontSize: '.58rem', fontWeight: 700, color: 'var(--concrete)', fontFamily: 'var(--font-mono)', minWidth: 55, textAlign: 'right' }}>{fmtAmt(val)}</span>
              </div>
            ))}
          </div>

          {/* Vendor cost bar */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px' }}>
            <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>🏢 Spend by Vendor</div>
            {vendorEntries.length === 0 ? <div style={{ color: 'var(--concrete)', fontSize: '.8rem', textAlign: 'center', padding: 20 }}>No vendor data</div> : vendorEntries.slice(0, 8).map(([vendor, data]) => (
              <div key={vendor} className="mt-bar-row">
                <span style={{ width: 70, fontSize: '.62rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendor}</span>
                <div style={{ flex: 1 }}>
                  <div className="mt-bar-fill" style={{ width: `${Math.max((data.cost / maxVendorCost) * 100, 4)}%`, background: data.isSubcontractor ? 'var(--amber)' : 'var(--grad-gold)', opacity: .85 }} />
                </div>
                <span style={{ fontSize: '.58rem', fontWeight: 700, color: 'var(--concrete)', fontFamily: 'var(--font-mono)', minWidth: 55, textAlign: 'right' }}>{fmtAmt(data.cost)}</span>
              </div>
            ))}
          </div>

          {/* Receipt vs Consumption Donut */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>📊 Flow Analysis</div>
            <svg viewBox="0 0 80 80" width="100" height="100" style={{ margin: '0 auto', display: 'block' }}>
              <circle cx="40" cy="40" r="30" fill="none" stroke="var(--green)" strokeWidth="10" strokeDasharray={`${rcDonut.rPct * 1.884} ${188.4 - rcDonut.rPct * 1.884}`} transform="rotate(-90 40 40)" />
              <circle cx="40" cy="40" r="30" fill="none" stroke="var(--rust)" strokeWidth="10" strokeDasharray={`${rcDonut.cPct * 1.884} ${188.4 - rcDonut.cPct * 1.884}`} strokeDashoffset={`-${rcDonut.rPct * 1.884}`} transform="rotate(-90 40 40)" />
              <circle cx="40" cy="40" r="22" fill="var(--paper)" />
              <text x="40" y="43" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--ink)" fontFamily="var(--font-mono)">{materials.length}</text>
            </svg>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '.62rem', color: 'var(--concrete)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }}></span>Received</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '.62rem', color: 'var(--concrete)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rust)' }}></span>Consumed</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Transaction Log ── */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>Transaction Ledger ({filteredTx.length})</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleExportPDF} style={{ padding: '4px 10px', borderRadius: 6, fontSize: '.65rem', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--gold)', background: 'var(--gold-light)', color: 'var(--gold-dark)', textTransform: 'uppercase', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4 }}>📄 PDF</button>
            {project?.slug && <button onClick={handleShare} style={{ padding: '4px 10px', borderRadius: 6, fontSize: '.65rem', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--gold)', background: 'var(--gold-light)', color: 'var(--gold-dark)', textTransform: 'uppercase', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4 }}>🔗 Share</button>}
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." style={{ padding: '5px 10px', border: '1px solid var(--hairline)', borderRadius: 6, fontSize: '.75rem', fontFamily: 'var(--font-body)', width: 130, background: 'var(--paper-2)' }} />
            {['All', 'Receipt', 'Consumption', 'SubPayment'].map(t => (
              <button key={t} onClick={() => setFilterType(t)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: '.65rem', fontWeight: 700, cursor: 'pointer', border: filterType === t ? '1.5px solid var(--ink)' : '1.5px solid var(--hairline)', background: filterType === t ? 'var(--ink)' : 'var(--paper)', color: filterType === t ? '#fff' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em', transition: 'all .15s' }}>
                {t === 'All' ? 'All' : t === 'Receipt' ? 'GRN In' : t === 'Consumption' ? 'Used' : 'Sub Pay'}
              </button>
            ))}
          </div>
        </div>
        {filteredTx.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: 'var(--concrete)', fontSize: '.8rem' }}>No transactions match current filters.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
          {filteredTx.map(m => {
            const isSub = m.category === 'Subcontractor Payment';
            const isR = !isSub && (m.received || 0) > 0;
            const qty = isSub ? null : isR ? m.received : m.consumed;
            const txAmt = isSub ? (m.subcontractorPayment || 0) : (isR && m.rate > 0 ? qty * m.rate : 0);
            const borderColor = isSub ? 'var(--amber)' : isR ? 'var(--green)' : 'var(--rust)';
            return (
              <div key={m.id} className="mt-tx-card" style={{ borderLeft: `4px solid ${borderColor}` }}>
                <div className="mt-tx-top">
                  <div className="mt-tx-main">
                    {/* Row 1: Category + Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.6rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: (CAT_COLORS[m.category] || '#ccc') + '18', color: CAT_COLORS[m.category] || 'var(--concrete)' }}>{m.category}</span>
                      <span style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--ink)' }}>{m.name}</span>
                    </div>
                    {/* Row 2: Qty + Amount together */}
                    <div className="mt-tx-amt-row">
                      {!isSub && qty !== null && (
                        <span style={{ fontSize: '.82rem', fontWeight: 800, color: isR ? 'var(--green)' : 'var(--rust)', fontFamily: 'var(--font-mono)' }}>{isR ? '+' : '-'}{qty} {m.unit}</span>
                      )}
                      {txAmt > 0 && (
                        <span style={{ fontSize: '.82rem', fontWeight: 800, color: isSub ? 'var(--amber)' : 'var(--ink)', fontFamily: 'var(--font-mono)', background: 'var(--paper-2)', padding: '1px 7px', borderRadius: 5, border: '1px solid var(--hairline)' }}>₹{Number(txAmt).toLocaleString('en-IN')}</span>
                      )}
                      {isR && m.rate > 0 && (
                        <span style={{ fontSize: '.6rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>@ ₹{Number(m.rate).toLocaleString('en-IN')}/{m.unit}</span>
                      )}
                    </div>
                    {/* Row 3: Meta */}
                    <div className="mt-tx-meta">
                      {m.date && <span>📅 {m.date}</span>}
                      {m.vendor && <span>🏢 {m.vendor}</span>}
                      {m.notes && <span>📝 {m.notes}</span>}
                      {m.billUrls && m.billUrls.length > 0 && m.billUrls.map((url, i) => {
                        const isPdf = url.toLowerCase().endsWith('.pdf');
                        return (
                          <span key={i} style={{ color: 'var(--gold-dark)', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--gold-light)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--gold)' }} onClick={() => window.open(url, '_blank')}>
                            {isPdf ? '📄 PDF' : '🖼️ Bill'} {m.billUrls.length > 1 ? i + 1 : ''}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="mt-tx-actions">
                      <button className="expense-action-btn" onClick={() => handleEdit(m)} title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                      <button className="expense-action-btn del" onClick={() => handleDelete(m.id)} title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editId ? 'Edit' : 'Record'} Material Transaction</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {/* Transaction Type */}
              <div className="form-group">
                <label>Transaction Type *</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {TX_TYPES.map(t => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8, border: form.txType === t ? '2px solid var(--ink)' : '1.5px solid var(--hairline)', background: form.txType === t ? 'var(--gold-light)' : 'var(--paper)', fontWeight: form.txType === t ? 700 : 500, fontSize: '.82rem', transition: 'all .15s' }}>
                      <input type="radio" name="txType" checked={form.txType === t} onChange={() => setForm(p => ({ ...p, txType: t }))} style={{ display: 'none' }} />
                      {t === 'Receipt' ? '📥 Receipt (GRN)' : t === 'Consumption' ? '📤 Consumption' : '🔧 Subcontractor Pay'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Subcontractor Payment Fields */}
              {form.txType === 'Subcontractor Payment' ? (
                <>
                  <div className="form-grid-2">
                    <div className="form-group"><label>Subcontractor Name *</label><input className="form-input" value={form.subcontractorName} onChange={e => setForm(p => ({ ...p, subcontractorName: e.target.value }))} required placeholder="Subcontractor / Labour contractor" list="mt-vendor-list" /></div>
                    <div className="form-group"><label>Amount Paid (₹) *</label><input className="form-input" type="number" min="0.01" step="any" value={form.subcontractorAmount} onChange={e => setForm(p => ({ ...p, subcontractorAmount: e.target.value }))} required /></div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group"><label>Date *</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required /></div>
                    <div className="form-group"><label>Notes</label><input className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Work description / challan no." /></div>
                  </div>
                </>
              ) : (
                <>
                  {/* Category */}
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Category</label>
                      <select className="form-select" value={form.category} onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') { setShowCustomCatForm(true); return; }
                        const newUnit = val === 'RMC' ? 'm³' : form.unit;
                        setForm(p => ({ ...p, category: val, unit: newUnit, name: val === 'RMC' ? '' : p.name }));
                      }}>
                        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__custom__">+ Add Custom Category</option>
                      </select>
                      {showCustomCatForm && (
                        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                          <input className="form-input" style={{ flex: 1, fontSize: '.78rem' }} value={customCatInput} onChange={e => setCustomCatInput(e.target.value)} placeholder="New category name" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomCategory())} />
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddCustomCategory}>Add</button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCustomCatForm(false)}>✕</button>
                        </div>
                      )}
                    </div>

                    {/* RMC Grade or Material Name */}
                    {form.category === 'RMC' ? (
                      <div className="form-group">
                        <label>RMC Grade *</label>
                        <select className="form-select" value={form.rmcGrade} onChange={e => setForm(p => ({ ...p, rmcGrade: e.target.value }))}>
                          {RMC_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="form-group"><label>Material Name *</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="OPC 53 Cement, Fe 550 TMT..." /></div>
                    )}
                  </div>

                  {/* Qty + Unit + Date */}
                  <div className="form-grid-3">
                    <div className="form-group"><label>Quantity *</label><input className="form-input" type="number" min="0.01" step="any" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} required /></div>
                    <div className="form-group">
                      <label>Unit</label>
                      {form.category === 'RMC' ? (
                        <input className="form-input" value="m³" readOnly style={{ background: 'var(--paper-2)', color: 'var(--concrete)' }} />
                      ) : (
                        <select className="form-select" value={form.unit} onChange={e => {
                          const val = e.target.value;
                          if (val === '__custom__') { setShowCustomUnitForm(true); return; }
                          setForm(p => ({ ...p, unit: val }));
                        }}>
                          {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
                          <option value="__custom__">+ Add Custom Unit</option>
                        </select>
                      )}
                      {showCustomUnitForm && (
                        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                          <input className="form-input" style={{ flex: 1, fontSize: '.78rem' }} value={customUnitInput} onChange={e => setCustomUnitInput(e.target.value)} placeholder="New unit" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomUnit())} />
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddCustomUnit}>Add</button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCustomUnitForm(false)}>✕</button>
                        </div>
                      )}
                    </div>
                    <div className="form-group"><label>Date *</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required /></div>
                  </div>

                  {/* Vendor (receipt only) + Rate */}
                  {form.txType === 'Receipt' && (
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label>Supplier / Vendor</label>
                        <input className="form-input" list="mt-vendor-list" value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Select or type vendor name" />
                        <datalist id="mt-vendor-list">
                          {vendorContacts.map(c => <option key={c.id} value={c.name}>{c.name} — {c.company || c.role}</option>)}
                        </datalist>
                        {vendorContacts.length > 0 && <div style={{ fontSize: '.6rem', color: 'var(--concrete)', marginTop: 3 }}>💡 {vendorContacts.length} vendor(s) from contacts</div>}
                      </div>
                      <div className="form-group"><label>Rate (₹/unit)</label><input className="form-input" type="number" min="0" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} /></div>
                    </div>
                  )}

                  <div className="form-group"><label>{form.txType === 'Receipt' ? 'Notes (Challan / Invoice)' : 'Usage Location'}</label><input className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
                </>
              )}

              {/* Bill attachments */}
              <div className="form-group">
                <label>Attach Bills / Receipts (Images or PDF)</label>
                <input type="file" accept="image/*,application/pdf" multiple className="form-input" onChange={handleFileChange} disabled={uploading} />
                {uploading && <div style={{ fontSize: '.78rem', color: 'var(--concrete)', marginTop: 4 }}>Uploading... {uploadProgress}%</div>}
                {form.billUrls && form.billUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {form.billUrls.map((u, idx) => {
                      const isPdf = u.toLowerCase().endsWith('.pdf');
                      return (
                        <div key={idx} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--hairline)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isPdf ? <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--rust)' }}>PDF</span> : <img src={u} alt="Bill Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          <button type="button" onClick={() => setForm(p => ({ ...p, billUrls: p.billUrls.filter((_, i) => i !== idx) }))} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10 }}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

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
