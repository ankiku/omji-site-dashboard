import { useMemo, useState } from 'react';
import { exportTableToPDF } from '../utils/pdfExporter';

const fmtAmt = (n) => String.fromCharCode(8377) + Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const CLIENT_PAY_TYPES = [
  'Client Payment', 'Advance', 'Retention', 'Final Bill',
  'Client Direct Payment (to Vendor)', 'Vendor', 'Omji Cash/RTGS',
];

const STATUS_STYLES = {
  'Paid':           { bg: 'var(--green-light)',  color: 'var(--green)' },
  'Partially Paid': { bg: 'var(--amber-light)', color: 'var(--amber)' },
  'Overdue':        { bg: 'var(--rust-light)',   color: 'var(--rust)' },
  'Pending':        { bg: 'var(--gold-light)',   color: 'var(--gold-dark)' },
};

export default function PublicPaymentView({ payments = [], contacts = [], project }) {
  const [filterType, setFilterType] = useState('All');
  const [activeSection, setActiveSection] = useState('schedule'); // 'schedule' | 'history'

  const contactMap = useMemo(() => {
    const m = {};
    contacts.forEach(c => { m[c.id] = c; });
    return m;
  }, [contacts]);

  const clientPayments = useMemo(() => {
    return payments
      .map(p => {
        if (p.status === 'Paid' && (!p.paidAmount || p.paidAmount === 0)) {
          return { ...p, paidAmount: p.amount || 0 };
        }
        return p;
      })
      .filter(p => CLIENT_PAY_TYPES.includes(p.type))
      .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
  }, [payments]);

  // Phase-wise grouping: group by linkedPhase, sorted by earliest dueDate
  const phaseGroups = useMemo(() => {
    const groups = {};
    clientPayments.forEach(p => {
      const phase = p.linkedPhase || 'General';
      if (!groups[phase]) groups[phase] = [];
      groups[phase].push(p);
    });
    // Sort phases by earliest due date
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aDate = a.map(p => p.dueDate).filter(Boolean).sort()[0] || '9999';
      const bDate = b.map(p => p.dueDate).filter(Boolean).sort()[0] || '9999';
      return aDate.localeCompare(bDate);
    });
  }, [clientPayments]);

  const { totalInvoiced, totalCollected, totalPending, collectionPct,
          pendingOverdue, directToVendor, cashRtgs } = useMemo(() => {
    const totalInvoiced  = clientPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const totalCollected = clientPayments.reduce((s, p) => s + parseFloat(p.paidAmount || 0), 0);
    const totalPending   = totalInvoiced - totalCollected;
    const collectionPct  = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;
    const pendingOverdue = clientPayments
      .filter(p => p.status === 'Overdue')
      .reduce((s, p) => s + (parseFloat(p.amount || 0) - parseFloat(p.paidAmount || 0)), 0);
    const directToVendor = clientPayments
      .filter(p => p.type === 'Client Direct Payment (to Vendor)' || p.type === 'Vendor')
      .reduce((s, p) => s + parseFloat(p.paidAmount || 0), 0);
    const cashRtgs = clientPayments
      .filter(p => p.type === 'Omji Cash/RTGS')
      .reduce((s, p) => s + parseFloat(p.paidAmount || 0), 0);
    return { totalInvoiced, totalCollected, totalPending, collectionPct, pendingOverdue, directToVendor, cashRtgs };
  }, [clientPayments]);

  const displayPayments = useMemo(() => {
    if (filterType === 'All') return clientPayments;
    if (filterType === 'Cash / RTGS') return clientPayments.filter(p => p.type === 'Omji Cash/RTGS');
    if (filterType === 'Direct to Vendor') return clientPayments.filter(p =>
      p.type === 'Client Direct Payment (to Vendor)' || p.type === 'Vendor');
    if (filterType === 'Invoices') return clientPayments.filter(p =>
      ['Client Payment', 'Advance', 'Retention', 'Final Bill'].includes(p.type));
    return clientPayments;
  }, [clientPayments, filterType]);

  const handleDownloadPDF = () => {
    const projectName = project?.name || 'Project';
    const headers = ['#', 'Milestone', 'Type', 'Phase', 'Due Date', 'Paid Date', 'Status', 'Invoiced', 'Paid', 'Balance'];
    const rows = clientPayments.map((p, i) => {
      const amt = parseFloat(p.amount || 0);
      const paid = parseFloat(p.paidAmount || 0);
      return [
        String(p.order || i + 1),
        p.milestone || 'Unnamed',
        p.type || '',
        p.linkedPhase || 'General',
        fmtDate(p.dueDate),
        fmtDate(p.paidDate),
        p.status || '',
        fmtAmt(amt),
        fmtAmt(paid),
        fmtAmt(amt - paid),
      ];
    });
    const summary = `
      <div style="text-align:right;">
        <div style="font-size:0.65rem;color:#7C7468;font-weight:700;text-transform:uppercase;">Project</div>
        <div style="font-size:1rem;font-weight:800;color:#1C1A17;">${projectName}</div>
        <div style="margin-top:8px;font-size:0.65rem;color:#7C7468;font-weight:700;text-transform:uppercase;">Total Invoiced / Paid / Balance</div>
        <div style="font-size:0.9rem;font-weight:700;font-family:monospace;">${fmtAmt(totalInvoiced)} / ${fmtAmt(totalCollected)} / ${fmtAmt(totalPending)}</div>
      </div>`;
    exportTableToPDF(`Payment Statement — ${projectName}`, headers, rows, summary);
  };

  const ringR = 26;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (Math.min(100, collectionPct) / 100) * ringC;
  const FILTERS = ['All', 'Invoices', 'Cash / RTGS', 'Direct to Vendor'];
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="module-container">
      <style>{`
        .ppv-banner { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; background:var(--paper); border:1.5px solid var(--gold); border-radius:var(--radius); padding:16px 20px; margin-bottom:var(--sp-lg); }
        .ppv-banner-item { display:flex; flex-direction:column; gap:3px; }
        .ppv-kpi-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:var(--sp-md); margin-bottom:var(--sp-lg); }
        .ppv-kpi-card { background:var(--paper); border:1px solid var(--hairline); border-radius:var(--radius); padding:16px; display:flex; align-items:center; justify-content:space-between; transition:border-color .2s; }
        .ppv-kpi-card:hover { border-color:var(--gold); }
        .ppv-row { background:var(--paper); border:1px solid var(--hairline); border-radius:var(--radius); padding:16px 20px; transition:all .2s; }
        .ppv-row:hover { border-color:var(--gold); box-shadow:var(--shadow-sm); }
        .ppv-status { font-size:.62rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:3px 8px; border-radius:4px; }
        .ppv-track { height:6px; background:var(--hairline); border-radius:3px; margin-top:8px; overflow:hidden; }
        .ppv-fill { height:100%; border-radius:3px; transition:width .6s cubic-bezier(.4,0,.2,1); }
        .ppv-type-chip { font-size:.58rem; font-weight:700; text-transform:uppercase; letter-spacing:.03em; padding:2px 7px; border-radius:3px; background:var(--gold-light); color:var(--gold-dark); border:1px solid var(--gold); }
        .ppv-notice { display:flex; align-items:center; gap:10px; background:rgba(197,168,128,.08); border:1.5px solid var(--gold); border-radius:var(--radius); padding:12px 16px; margin-bottom:var(--sp-lg); font-size:.78rem; color:var(--ink); }
        .ppv-phase-card { background:var(--paper); border:1px solid var(--hairline); border-radius:var(--radius); overflow:hidden; margin-bottom:var(--sp-md); }
        .ppv-phase-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--canvas); border-bottom:1px solid var(--hairline); flex-wrap:wrap; gap:8px; }
        .ppv-phase-row { display:flex; justify-content:space-between; align-items:center; padding:10px 16px; border-bottom:1px solid var(--hairline); flex-wrap:wrap; gap:8px; transition:background .15s; }
        .ppv-phase-row:last-child { border-bottom:none; }
        .ppv-phase-row:hover { background:var(--gold-light); }
        .ppv-phase-row.overdue { background:rgba(185,28,28,.04); border-left:3px solid var(--rust); }
        .ppv-phase-row.upcoming { background:rgba(197,168,128,.06); border-left:3px solid var(--gold); }
        .ppv-dl-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:6px; font-size:0.72rem; font-weight:700; cursor:pointer; border:1.5px solid var(--gold); background:var(--gold-light); color:var(--gold-dark); transition:all .15s; text-transform:uppercase; letter-spacing:.04em; }
        .ppv-dl-btn:hover { background:var(--gold); color:#fff; }
        .ppv-section-tabs { display:flex; gap:4px; background:var(--canvas); border:1px solid var(--hairline); border-radius:var(--radius); padding:4px; margin-bottom:var(--sp-lg); }
        .ppv-section-tab { flex:1; padding:8px; border:none; border-radius:6px; font-size:0.72rem; font-weight:700; cursor:pointer; transition:all .15s; background:transparent; color:var(--concrete); }
        .ppv-section-tab.active { background:var(--ink); color:#fff; }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:'var(--sp-md)' }}>
        <div>
          <h2 className="section-title">Payment Summary</h2>
          <p className="mono" style={{ fontSize:'0.72rem', color:'var(--concrete)', marginTop:2 }}>
            All payments made to date &mdash; cash, bank transfers and direct vendor payments.
          </p>
        </div>
        <button className="ppv-dl-btn" onClick={handleDownloadPDF}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Statement
        </button>
      </div>

      {/* Read-only notice */}
      <div className="ppv-notice">
        <span>&#128274;</span>
        <span>This is a <strong>view-only</strong> summary shared by Omji Construction. For any queries, please contact your project manager.</span>
      </div>

      {/* Grand Totals Banner */}
      <div className="ppv-banner">
        <div className="ppv-banner-item">
          <span className="mono" style={{ fontSize:'.6rem', fontWeight:700, color:'var(--concrete)', textTransform:'uppercase' }}>Total Invoiced</span>
          <span style={{ fontSize:'1.35rem', fontWeight:800, color:'var(--ink)', fontFamily:'var(--font-display)' }}>{fmtAmt(totalInvoiced)}</span>
          <span className="mono" style={{ fontSize:'.6rem', color:'var(--concrete)' }}>{clientPayments.length} milestones</span>
        </div>
        <div className="ppv-banner-item">
          <span className="mono" style={{ fontSize:'.6rem', fontWeight:700, color:'var(--concrete)', textTransform:'uppercase' }}>Total Paid</span>
          <span style={{ fontSize:'1.35rem', fontWeight:800, color:'var(--green)', fontFamily:'var(--font-display)' }}>{fmtAmt(totalCollected)}</span>
          <span className="mono" style={{ fontSize:'.6rem', color:'var(--concrete)' }}>{collectionPct}% collected</span>
        </div>
        <div className="ppv-banner-item">
          <span className="mono" style={{ fontSize:'.6rem', fontWeight:700, color:'var(--concrete)', textTransform:'uppercase' }}>Outstanding</span>
          <span style={{ fontSize:'1.35rem', fontWeight:800, color:totalPending > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily:'var(--font-display)' }}>{fmtAmt(totalPending)}</span>
          <span className="mono" style={{ fontSize:'.6rem', color:'var(--concrete)' }}>
            {pendingOverdue > 0 ? `Warning: ${fmtAmt(pendingOverdue)} overdue` : 'No overdue items'}
          </span>
        </div>
        <div className="ppv-banner-item">
          <span className="mono" style={{ fontSize:'.6rem', fontWeight:700, color:'var(--concrete)', textTransform:'uppercase' }}>Cash / RTGS</span>
          <span style={{ fontSize:'1.35rem', fontWeight:800, color:'var(--ink)', fontFamily:'var(--font-display)' }}>{fmtAmt(cashRtgs)}</span>
          <span className="mono" style={{ fontSize:'.6rem', color:'var(--concrete)' }}>Direct to Omji</span>
        </div>
        <div className="ppv-banner-item">
          <span className="mono" style={{ fontSize:'.6rem', fontWeight:700, color:'var(--concrete)', textTransform:'uppercase' }}>Direct to Vendor</span>
          <span style={{ fontSize:'1.35rem', fontWeight:800, color:'#3D7CB8', fontFamily:'var(--font-display)' }}>{fmtAmt(directToVendor)}</span>
          <span className="mono" style={{ fontSize:'.6rem', color:'var(--concrete)' }}>Paid by you to vendor</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="ppv-kpi-row">
        <div className="ppv-kpi-card">
          <div>
            <span className="mono" style={{ fontSize:'0.62rem', color:'var(--concrete)', textTransform:'uppercase' }}>Collection Progress</span>
            <div style={{ fontSize:'1.5rem', fontWeight:800, color:'var(--green)', fontFamily:'var(--font-display)', marginTop:4 }}>{collectionPct}%</div>
            <span className="mono" style={{ fontSize:'0.6rem', color:'var(--concrete)' }}>of total invoiced</span>
          </div>
          <svg width="60" height="60" style={{ flexShrink:0 }}>
            <circle cx="30" cy="30" r={ringR} fill="none" stroke="var(--hairline)" strokeWidth="5" />
            <circle cx="30" cy="30" r={ringR} fill="none" stroke="var(--green)" strokeWidth="5"
              strokeDasharray={ringC} strokeDashoffset={ringOffset}
              strokeLinecap="round" transform="rotate(-90 30 30)" />
            <text x="30" y="34" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--ink)">{collectionPct}%</text>
          </svg>
        </div>
        <div className="ppv-kpi-card">
          <div>
            <span className="mono" style={{ fontSize:'0.62rem', color:'var(--concrete)', textTransform:'uppercase' }}>Amount Settled</span>
            <div style={{ fontSize:'1.25rem', fontWeight:800, color:'var(--green)', fontFamily:'var(--font-display)', marginTop:4 }}>{fmtAmt(totalCollected)}</div>
            <span className="mono" style={{ fontSize:'0.6rem', color:'var(--concrete)' }}>cleared to date</span>
          </div>
          <span style={{ fontSize:'1.8rem', opacity:0.25 }}>&#10003;</span>
        </div>
        <div className="ppv-kpi-card">
          <div>
            <span className="mono" style={{ fontSize:'0.62rem', color:'var(--concrete)', textTransform:'uppercase' }}>Balance Due</span>
            <div style={{ fontSize:'1.25rem', fontWeight:800, color:totalPending > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily:'var(--font-display)', marginTop:4 }}>{fmtAmt(totalPending)}</div>
            <span className="mono" style={{ fontSize:'0.6rem', color:'var(--concrete)' }}>remaining balance</span>
          </div>
          <span style={{ fontSize:'1.8rem', opacity:0.25 }}>&#128203;</span>
        </div>
        <div className="ppv-kpi-card">
          <div>
            <span className="mono" style={{ fontSize:'0.62rem', color:'var(--concrete)', textTransform:'uppercase' }}>Direct to Vendor</span>
            <div style={{ fontSize:'1.25rem', fontWeight:800, color:'#3D7CB8', fontFamily:'var(--font-display)', marginTop:4 }}>{fmtAmt(directToVendor)}</div>
            <span className="mono" style={{ fontSize:'0.6rem', color:'var(--concrete)' }}>paid by you directly</span>
          </div>
          <span style={{ fontSize:'1.8rem', opacity:0.25 }}>&#127970;</span>
        </div>
      </div>

      {/* Section switcher */}
      <div className="ppv-section-tabs">
        <button className={`ppv-section-tab ${activeSection === 'schedule' ? 'active' : ''}`} onClick={() => setActiveSection('schedule')}>
          Phase-wise Schedule
        </button>
        <button className={`ppv-section-tab ${activeSection === 'history' ? 'active' : ''}`} onClick={() => setActiveSection('history')}>
          Payment History
        </button>
      </div>

      {/* ═══ PHASE-WISE SCHEDULE ═══ */}
      {activeSection === 'schedule' && (
        <div>
          {phaseGroups.length === 0 ? (
            <div className="empty-state"><p>No payment milestones found.</p></div>
          ) : (
            phaseGroups.map(([phase, pList]) => {
              const phaseTotal   = pList.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
              const phasePaid    = pList.reduce((s, p) => s + parseFloat(p.paidAmount || 0), 0);
              const phasePending = phaseTotal - phasePaid;
              const phasePct     = phaseTotal > 0 ? Math.round((phasePaid / phaseTotal) * 100) : 0;
              const allPaid      = pList.every(p => p.status === 'Paid');
              const hasOverdue   = pList.some(p => p.status === 'Overdue');
              return (
                <div key={phase} className="ppv-phase-card">
                  <div className="ppv-phase-header">
                    <div>
                      <div style={{ fontWeight:800, fontSize:'0.88rem', color:'var(--ink)' }}>{phase}</div>
                      <div className="mono" style={{ fontSize:'0.62rem', color:'var(--concrete)', marginTop:2 }}>
                        {pList.length} milestone{pList.length !== 1 ? 's' : ''} &bull; {phasePct}% settled
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'0.9rem', fontWeight:800, color:'var(--ink)' }}>{fmtAmt(phaseTotal)}</div>
                      <div className="mono" style={{ fontSize:'0.62rem', color:phasePending > 0 ? 'var(--rust)' : 'var(--green)', fontWeight:700 }}>
                        {phasePending > 0 ? `Balance: ${fmtAmt(phasePending)}` : 'Fully Paid'}
                      </div>
                    </div>
                  </div>
                  {/* Phase progress bar */}
                  <div style={{ padding:'8px 16px 0', background:'var(--canvas)' }}>
                    <div className="ppv-track" style={{ marginTop:0 }}>
                      <div className="ppv-fill" style={{ width:`${Math.min(phasePct,100)}%`, background: allPaid ? 'var(--green)' : hasOverdue ? 'var(--rust)' : 'var(--gold)' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.58rem', color:'var(--concrete)', fontFamily:'var(--font-mono)', padding:'3px 0 8px' }}>
                      <span>{fmtAmt(phasePaid)} paid</span>
                      <span>{phasePct}% of {fmtAmt(phaseTotal)}</span>
                    </div>
                  </div>
                  {/* Individual milestones in phase */}
                  {pList.map((p, idx) => {
                    const isOverdue = p.status === 'Overdue';
                    const isPending = p.status === 'Pending' || p.status === 'Partially Paid';
                    const isPaid    = p.status === 'Paid';
                    const dueStr    = p.dueDate ? fmtDate(p.dueDate) : null;
                    const isUrgent  = p.dueDate && p.dueDate >= today && !isPaid;
                    const statusStyle = STATUS_STYLES[p.status] || STATUS_STYLES['Pending'];
                    return (
                      <div key={p.id || idx} className={`ppv-phase-row ${isOverdue ? 'overdue' : isUrgent ? 'upcoming' : ''}`}>
                        <div style={{ flex:1, minWidth:'180px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span className="mono" style={{ fontSize:'0.62rem', color:'var(--concrete)' }}>#{p.order || idx + 1}</span>
                            <span style={{ fontSize:'0.83rem', fontWeight:700, color:'var(--ink)' }}>{p.milestone || 'Unnamed'}</span>
                            <span className="ppv-status" style={{ background:statusStyle.bg, color:statusStyle.color }}>{p.status}</span>
                          </div>
                          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:4, fontSize:'0.7rem', color:'var(--concrete)' }}>
                            <span className="ppv-type-chip">{p.type}</span>
                            {dueStr && (
                              <span style={{ color: isOverdue ? 'var(--rust)' : isPaid ? 'var(--green)' : 'var(--concrete)', fontWeight: isOverdue ? 700 : 400 }}>
                                {isOverdue ? 'Overdue since: ' : 'Due: '}{dueStr}
                              </span>
                            )}
                            {p.paidDate && <span style={{ color:'var(--green)' }}>Paid: {fmtDate(p.paidDate)}</span>}
                          </div>
                          {!isPaid && p.dueDate && (
                            <div style={{ marginTop:5, fontSize:'0.68rem', fontWeight:700, color: isOverdue ? 'var(--rust)' : 'var(--gold-dark)', background: isOverdue ? 'rgba(185,28,28,.06)' : 'rgba(197,168,128,.12)', display:'inline-block', padding:'2px 8px', borderRadius:4 }}>
                              {isOverdue
                                ? `Overdue — Please clear ${fmtAmt(parseFloat(p.amount||0) - parseFloat(p.paidAmount||0))}`
                                : `Payment of ${fmtAmt(parseFloat(p.amount||0) - parseFloat(p.paidAmount||0))} due by ${dueStr}`
                              }
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign:'right', minWidth:'100px', flexShrink:0 }}>
                          <div style={{ fontSize:'0.95rem', fontWeight:800, color:'var(--ink)' }}>{fmtAmt(p.amount)}</div>
                          <div className="mono" style={{ fontSize:'0.62rem', color:'var(--green)', fontWeight:600 }}>Paid: {fmtAmt(p.paidAmount)}</div>
                          {parseFloat(p.amount||0) - parseFloat(p.paidAmount||0) > 0 && (
                            <div className="mono" style={{ fontSize:'0.62rem', color:'var(--rust)', fontWeight:700 }}>Due: {fmtAmt(parseFloat(p.amount||0) - parseFloat(p.paidAmount||0))}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ PAYMENT HISTORY ═══ */}
      {activeSection === 'history' && (
        <div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'var(--sp-lg)' }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilterType(f)} style={{ padding:'5px 14px', borderRadius:6, fontSize:'0.7rem', fontWeight:700, cursor:'pointer', transition:'all .15s', border:filterType === f ? '1.5px solid var(--ink)' : '1px solid var(--hairline)', background:filterType === f ? 'var(--ink)' : 'transparent', color:filterType === f ? '#fff' : 'var(--concrete)' }}>
                {f}
              </button>
            ))}
            <span className="mono" style={{ fontSize:'0.65rem', color:'var(--concrete)', alignSelf:'center', marginLeft:'auto' }}>
              {displayPayments.length} record{displayPayments.length !== 1 ? 's' : ''}
            </span>
          </div>

          {displayPayments.length === 0 ? (
            <div className="empty-state"><p>No payment records found for this filter.</p></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--sp-md)' }}>
              {displayPayments.map((p, idx) => {
                const pct = parseFloat(p.amount) > 0 ? Math.round((parseFloat(p.paidAmount || 0) / parseFloat(p.amount)) * 100) : 0;
                const statusStyle = STATUS_STYLES[p.status] || STATUS_STYLES['Pending'];
                const fillColor = p.status === 'Paid' ? 'var(--green)' : p.status === 'Overdue' ? 'var(--rust)' : p.status === 'Partially Paid' ? 'var(--amber)' : 'var(--gold)';
                const contact = p.contactId ? contactMap[p.contactId] : null;
                const vendorContact = p.vendorContactId ? contactMap[p.vendorContactId] : null;
                const isDirect = p.type === 'Client Direct Payment (to Vendor)';
                return (
                  <div key={p.id || idx} className="ppv-row">
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px' }}>
                      <div style={{ flex:1, minWidth:'220px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                          <span className="mono" style={{ fontSize:'0.68rem', color:'var(--concrete)', fontWeight:800 }}>#{p.order || idx + 1}</span>
                          <strong style={{ fontSize:'0.9rem', color:'var(--ink)' }}>{p.milestone || 'Unnamed'}</strong>
                          <span className="ppv-status" style={{ background:statusStyle.bg, color:statusStyle.color }}>{p.status}</span>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'10px', marginTop:'8px', fontSize:'0.72rem', color:'var(--concrete)' }}>
                          <span className="ppv-type-chip">{p.type}</span>
                          {isDirect && vendorContact && <span>Vendor: <strong style={{ color:'var(--ink)' }}>{vendorContact.name}</strong></span>}
                          {!isDirect && contact && <span>{contact.name}</span>}
                          {p.linkedPhase && <span>Phase: {p.linkedPhase}</span>}
                          {p.dueDate && <span>Due: {fmtDate(p.dueDate)}</span>}
                          {p.paidDate && <span>Paid on: <strong style={{ color:'var(--ink)' }}>{fmtDate(p.paidDate)}</strong></span>}
                        </div>
                        {p.notes && (
                          <div className="mono" style={{ fontSize:'0.68rem', color:'var(--concrete)', background:'var(--canvas)', padding:'4px 8px', borderRadius:4, marginTop:8, display:'inline-block' }}>
                            Note: {p.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign:'right', minWidth:'110px', flexShrink:0 }}>
                        <div style={{ fontSize:'1.05rem', fontWeight:800, color:'var(--ink)' }}>{fmtAmt(p.amount)}</div>
                        <div className="mono" style={{ fontSize:'0.65rem', color:'var(--green)', fontWeight:600 }}>Paid: {fmtAmt(p.paidAmount)}</div>
                        {parseFloat(p.amount || 0) - parseFloat(p.paidAmount || 0) > 0 && (
                          <div className="mono" style={{ fontSize:'0.65rem', color:'var(--rust)', fontWeight:600 }}>Due: {fmtAmt(parseFloat(p.amount || 0) - parseFloat(p.paidAmount || 0))}</div>
                        )}
                        {p.billUrls && p.billUrls.length > 0 && (
                          <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', justifyContent:'flex-end', marginTop:6 }}>
                            {p.billUrls.map((url, i) => {
                              const isPdf = url.toLowerCase().endsWith('.pdf');
                              return (
                                <span key={i} onClick={() => window.open(url, '_blank')} style={{ cursor:'pointer', fontSize:'0.6rem', fontWeight:700, background:'var(--gold-light)', color:'var(--gold-dark)', border:'1px solid var(--gold)', borderRadius:4, padding:'2px 6px', display:'inline-flex', alignItems:'center', gap:3 }}>
                                  {isPdf ? 'PDF' : 'Img'} {p.billUrls.length > 1 ? `Bill ${i + 1}` : 'View Bill'}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {parseFloat(p.amount || 0) > 0 && (
                      <div style={{ marginTop:'10px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', color:'var(--concrete)', fontFamily:'var(--font-mono)', marginBottom:2 }}>
                          <span>Payment Progress</span><span>{pct}% Collected</span>
                        </div>
                        <div className="ppv-track">
                          <div className="ppv-fill" style={{ width:`${Math.min(pct,100)}%`, background:fillColor }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop:'var(--sp-xl)', padding:'12px 16px', background:'var(--canvas)', borderRadius:'var(--radius)', borderLeft:'3px solid var(--gold)', fontSize:'0.75rem', color:'var(--concrete)' }}>
        This payment summary is generated by <strong style={{ color:'var(--ink)' }}>Omji Construction</strong>.
        All amounts are in Indian Rupees. For billing queries, contact your project manager directly.
      </div>
    </div>
  );
}
