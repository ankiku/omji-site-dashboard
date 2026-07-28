import { useState, useEffect, useMemo } from 'react';
import { addPayment, updatePayment, deletePayment, subscribeToPayments, uploadPhoto } from '../services/localStorageService';
import { exportTableToPDF } from '../utils/pdfExporter';
import { useToast } from '../contexts/ToastContext';

const PAY_TYPES = ['Client Payment', 'Contractor Disbursement', 'Vendor Disbursement', 'Client Direct Payment (to Vendor)', 'Advance', 'Retention', 'Final Bill'];
const PAY_STATUS = ['Pending', 'Partially Paid', 'Paid', 'Overdue'];

export default function PaymentTracker({ projectId, canEdit, contacts = [], project, mode = 'all' }) {
  const [payments, setPayments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterType, setFilterType] = useState('All');
  const [showVendorSummary, setShowVendorSummary] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({
    milestone: '',
    type: mode === 'vendor' ? 'Vendor Disbursement' : 'Client Payment',
    amount: '',
    paidAmount: '',
    status: 'Pending',
    dueDate: '',
    paidDate: '',
    linkedPhase: '',
    contactId: '',
    vendorContactId: '',
    notes: '',
    order: '',
    billUrls: []
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    return subscribeToPayments(projectId, setPayments);
  }, [projectId]);

  const resetForm = () => {
    setForm({
      milestone: '',
      type: mode === 'vendor' ? 'Vendor Disbursement' : 'Client Payment',
      amount: '',
      paidAmount: '',
      status: 'Pending',
      dueDate: '',
      paidDate: '',
      linkedPhase: '',
      contactId: '',
      vendorContactId: '',
      notes: '',
      order: String(payments.length + 1),
      billUrls: []
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
      order: parseInt(form.order) || payments.length + 1,
      billUrls: form.billUrls || []
    };
    if (data.status === 'Paid' && (!data.paidAmount || data.paidAmount === 0)) {
      data.paidAmount = data.amount;
    }
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
      contactId: p.contactId || '',
      vendorContactId: p.vendorContactId || '',
      notes: p.notes || '',
      order: String(p.order || ''),
      billUrls: p.billUrls || []
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadPhoto(projectId, 'payment-bill', file);
        uploadedUrls.push(res.url);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      setForm(prev => ({ ...prev, billUrls: [...(prev.billUrls || []), ...uploadedUrls] }));
      toast.success(`${uploadedUrls.length} document(s) uploaded.`);
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async (pid) => {
    if (window.confirm('Delete this payment milestone?')) {
      await deletePayment(projectId, pid);
    }
  };

  const fmtAmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const modeFilteredPayments = useMemo(() => {
    return payments.map(p => {
      // Auto-correct missing paidAmount if marked as 'Paid'
      if (p.status === 'Paid' && (!p.paidAmount || p.paidAmount === 0)) {
        return { ...p, paidAmount: p.amount || 0 };
      }
      return p;
    }).filter(p => {
      if (mode === 'vendor') return ['Vendor Disbursement', 'Contractor Disbursement', 'Client Direct Payment (to Vendor)'].includes(p.type);
      if (mode === 'client') return ['Client Payment', 'Advance', 'Retention', 'Final Bill', 'Client Direct Payment (to Vendor)'].includes(p.type);
      return true;
    });
  }, [payments, mode]);

  const { totalAmount, totalPaid, totalPending, collectionPct, pendingOverdue, clientCollections, vendorDisbursements, directPayments, vendorWise } = useMemo(() => {
    const totalAmount = modeFilteredPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalPaid = modeFilteredPayments.reduce((s, p) => s + (p.paidAmount || 0), 0);
    const totalPending = totalAmount - totalPaid;
    const collectionPct = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;
    const pendingOverdue = modeFilteredPayments.filter(p => p.status === 'Overdue').reduce((s, p) => s + ((p.amount || 0) - (p.paidAmount || 0)), 0);

    const clientCollections = modeFilteredPayments.filter(p => p.type.includes('Client Payment') || p.type.includes('Advance')).reduce((s, p) => s + (p.paidAmount || 0), 0);
    const vendorDisbursements = modeFilteredPayments.filter(p => p.type.includes('Disbursement')).reduce((s, p) => s + (p.paidAmount || 0), 0);
    const directPayments = modeFilteredPayments.filter(p => p.type.includes('Direct Payment')).reduce((s, p) => s + (p.paidAmount || 0), 0);

    // Vendor-wise summary
    const vendorWise = {};
    modeFilteredPayments.forEach(p => {
      const isDirect = p.type === 'Client Direct Payment (to Vendor)';
      const targetId = (isDirect && p.vendorContactId) ? p.vendorContactId : p.contactId;

      if (!targetId) return;
      if (!vendorWise[targetId]) vendorWise[targetId] = { billed: 0, paid: 0, count: 0, directPaid: 0, wePaid: 0 };
      
      const amt = (p.amount || 0);
      const pd = (p.paidAmount || 0);
      
      vendorWise[targetId].billed += amt;
      vendorWise[targetId].paid += pd;
      vendorWise[targetId].count += 1;
      
      if (isDirect) {
        vendorWise[targetId].directPaid += pd;
      } else if (p.type.includes('Disbursement') || p.type.includes('Vendor')) {
        vendorWise[targetId].wePaid += pd;
      }
    });

    return { totalAmount, totalPaid, totalPending, collectionPct, pendingOverdue, clientCollections, vendorDisbursements, directPayments, vendorWise };
  }, [modeFilteredPayments]);

  const filteredPayments = useMemo(() => {
    let list = [...modeFilteredPayments];
    if (filterType !== 'All') {
      if (filterType === 'Client Direct') {
        list = list.filter(p => p.type.includes('Direct Payment'));
      } else if (filterType === 'Contractor') {
        list = list.filter(p => p.type.includes('Contractor Disbursement'));
      } else {
        list = list.filter(p => p.type === filterType);
      }
    }
    return list.sort((a, b) => Number(b.order) - Number(a.order));
  }, [payments, filterType]);

  const handleExportPDF = () => {
    const headers = ['Milestone', 'Type', 'Status', 'Contact', 'Due Date', 'Paid Date', 'Phase', 'Billed', 'Paid', 'Pending'];
    const rows = filteredPayments.map(p => {
      let contactName = '';
      if (p.contactId) contactName = contacts.find(c => c.id === p.contactId)?.name || 'Unknown';
      const pAmt = p.amount || 0;
      const pPaid = p.paidAmount || 0;
      return [
        p.milestone || '', p.type || '', p.status || '', contactName,
        p.dueDate || '-', p.paidDate || '-', p.linkedPhase || '-',
        fmtAmt(pAmt), fmtAmt(pPaid), fmtAmt(pAmt - pPaid)
      ];
    });
    exportTableToPDF('Payment Ledger', headers, rows);
  };

  const ringR = 24;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (Math.min(100, collectionPct) / 100) * ringC;

  const vendorSummaryEntries = Object.entries(vendorWise).map(([cid, data]) => {
    const contact = contacts.find(c => c.id === cid);
    return { name: contact?.name || 'Unknown', role: contact?.role || '', ...data };
  }).sort((a, b) => b.billed - a.billed);

  const isDirectPayment = form.type === 'Client Direct Payment (to Vendor)';

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
        .pay-kpi-card:hover { border-color: var(--gold); transform: translateY(-1px); }
        .payment-milestone-list { display: flex; flex-direction: column; gap: var(--sp-md); }
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
        .premium-pay-row:hover { border-color: var(--gold); box-shadow: var(--shadow-sm); }
        .pay-status-badge {
          font-size: 0.65rem; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.04em; padding: 3px 8px; border-radius: 4px;
        }
        .pay-status-badge.paid { background: var(--green-light); color: var(--green); }
        .pay-status-badge.overdue { background: var(--rust-light); color: var(--rust); }
        .pay-status-badge.partial { background: var(--amber-light); color: var(--amber); }
        .pay-status-badge.pending { background: var(--gold-light); color: var(--gold-dark); }
        .pay-progress-track { height: 6px; background: var(--hairline); border-radius: 3px; margin-top: 6px; overflow: hidden; }
        .pay-progress-fill { height: 100%; border-radius: 3px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
        .pay-vendor-row { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px; border:1px solid var(--hairline); background:var(--paper); transition:all .15s; }
        .pay-vendor-row:hover { border-color:var(--gold); background:var(--gold-light); }
        .pay-totals-banner { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; background:var(--paper); border:1.5px solid var(--gold); border-radius:var(--radius); padding:14px 18px; margin-bottom:var(--sp-lg); }
        .pay-totals-item { display:flex; flex-direction:column; gap:2px; }
      `}} />

      {/* ── Header ── */}
      <div className="module-header" style={{ marginBottom: 'var(--sp-md)' }}>
        <div>
          <h2 className="section-title">
            {mode === 'vendor' ? '🧾 Vendor & Subcontractor Billing' : mode === 'client' ? '💳 Client Billing & Collections' : '💰 Payment & Milestone Billing'}
          </h2>
          <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--concrete)', marginTop: 2 }}>
            {mode === 'vendor' ? 'Track contractor disbursements, vendor payments, and client direct pays.' : mode === 'client' ? 'Track client draws, advances, and invoice collections.' : 'Track client draws, contractor disbursements, advances, and invoice collections.'}
          </p>
        </div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Create Milestone</button>}
      </div>

      {/* ── Grand Totals Banner ── */}
      <div className="pay-totals-banner">
        {/* ── Dynamic Totals Banner ── */}
        <div className="pay-totals-item">
          <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase' }}>{mode === 'client' ? 'Total Invoiced' : 'Total Billed'}</span>
          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{fmtAmt(totalAmount)}</span>
          <span className="mono" style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>{modeFilteredPayments.length} milestones</span>
        </div>
        
        {mode !== 'client' && (
          <div className="pay-totals-item">
            <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase' }}>We Paid</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--amber)', fontFamily: 'var(--font-display)' }}>{fmtAmt(vendorDisbursements)}</span>
            <span className="mono" style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>disbursed by us</span>
          </div>
        )}

        {mode !== 'client' && (
          <div className="pay-totals-item">
            <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase' }}>Client Paid</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--blue, #3D7CB8)', fontFamily: 'var(--font-display)' }}>{fmtAmt(directPayments)}</span>
            <span className="mono" style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>direct to vendor</span>
          </div>
        )}

        <div className="pay-totals-item">
          <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase' }}>{mode === 'client' ? 'Total Collected' : 'Total Paid'}</span>
          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>{fmtAmt(totalPaid)}</span>
          <span className="mono" style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>{collectionPct}% {mode === 'client' ? 'collected' : 'paid'}</span>
        </div>

        <div className="pay-totals-item">
          <span className="mono" style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase' }}>Outstanding</span>
          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: totalPending > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-display)' }}>{fmtAmt(totalPending)}</span>
          <span className="mono" style={{ fontSize: '.6rem', color: 'var(--concrete)' }}>{pendingOverdue > 0 ? `⚠️ ${fmtAmt(pendingOverdue)} overdue` : 'No overdue'}</span>
        </div>
      </div>

      {/* ── KPIs with ring ── */}
      <div className="pay-kpi-row">
        <div className="pay-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Contract Value</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(totalAmount)}</div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>{payments.length} scheduled bills</span>
          </div>
        </div>

        <div className="pay-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Total Collected</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(totalPaid)}</div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Invoiced &amp; cleared</span>
          </div>
          <svg width="56" height="56" style={{ flexShrink: 0 }}>
            <circle cx="28" cy="28" r={ringR} fill="none" stroke="var(--hairline)" strokeWidth="4" />
            <circle cx="28" cy="28" r={ringR} fill="none" stroke="var(--green)" strokeWidth="4"
              strokeDasharray={ringC} strokeDashoffset={ringOffset} strokeLinecap="round" transform="rotate(-90 28 28)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            <text x="28" y="31" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--green)" fontFamily="var(--font-mono)">{collectionPct}%</text>
          </svg>
        </div>

        <div className="pay-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Outstanding</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: totalPending > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(totalPending)}</div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Unpaid/pending balance</span>
          </div>
        </div>

        <div className="pay-kpi-card">
          <div>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', textTransform: 'uppercase' }}>Overdue Invoices</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: pendingOverdue > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{fmtAmt(pendingOverdue)}</div>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--concrete)' }}>Requires attention</span>
          </div>
        </div>
      </div>

      {/* ── Vendor-wise Summary ── */}
      {mode !== 'client' && vendorSummaryEntries.length > 0 && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 'var(--sp-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showVendorSummary ? 12 : 0, cursor: 'pointer' }} onClick={() => setShowVendorSummary(v => !v)}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-mono)' }}>📊 Vendor / Contact Wise Payment Summary ({vendorSummaryEntries.length})</div>
            <span style={{ fontSize: '.75rem', color: 'var(--gold-dark)', fontWeight: 700 }}>{showVendorSummary ? '▲ Hide' : '▼ Show'}</span>
          </div>
          {showVendorSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', gap: 12, fontSize: '.6rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', padding: '4px 10px', borderBottom: '1px solid var(--hairline)', marginBottom: 4 }}>
                <span>Contact</span><span style={{ textAlign: 'right' }}>Billed</span><span style={{ textAlign: 'right' }}>We Paid</span><span style={{ textAlign: 'right' }}>Client Paid</span><span style={{ textAlign: 'right' }}>Total Paid</span><span style={{ textAlign: 'right' }}>Outstanding</span>
              </div>
              {vendorSummaryEntries.map((v, i) => (
                <div key={i} className="pay-vendor-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--ink)' }}>{v.name}</div>
                    <div style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>{v.role} · {v.count} milestone{v.count !== 1 ? 's' : ''}</div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--ink)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(v.billed)}</span>
                  <span style={{ fontWeight: 700, fontSize: '.78rem', color: v.wePaid > 0 ? 'var(--amber)' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(v.wePaid)}</span>
                  <span style={{ fontWeight: 700, fontSize: '.78rem', color: v.directPaid > 0 ? 'var(--blue)' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(v.directPaid)}</span>
                  <span style={{ fontWeight: 700, fontSize: '.78rem', color: v.paid > 0 ? 'var(--green)' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(v.paid)}</span>
                  <span style={{ fontWeight: 700, fontSize: '.78rem', color: v.billed - v.paid > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(v.billed - v.paid)}</span>
                </div>
              ))}
              {/* Totals row */}
              {(() => {
                const tBilled = vendorSummaryEntries.reduce((s, v) => s + v.billed, 0);
                const tWePaid = vendorSummaryEntries.reduce((s, v) => s + (v.wePaid || 0), 0);
                const tDirectPaid = vendorSummaryEntries.reduce((s, v) => s + (v.directPaid || 0), 0);
                const tPaid = vendorSummaryEntries.reduce((s, v) => s + v.paid, 0);
                const tOut = tBilled - tPaid;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', gap: 12, alignItems: 'center', padding: '8px 10px', borderTop: '2px solid var(--hairline)', marginTop: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: '.75rem', color: 'var(--ink)' }}>Total</span>
                    <span style={{ fontWeight: 800, fontSize: '.78rem', color: 'var(--ink)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(tBilled)}</span>
                    <span style={{ fontWeight: 800, fontSize: '.78rem', color: tWePaid > 0 ? 'var(--amber)' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(tWePaid)}</span>
                    <span style={{ fontWeight: 800, fontSize: '.78rem', color: tDirectPaid > 0 ? 'var(--blue)' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(tDirectPaid)}</span>
                    <span style={{ fontWeight: 800, fontSize: '.78rem', color: tPaid > 0 ? 'var(--green)' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(tPaid)}</span>
                    <span style={{ fontWeight: 800, fontSize: '.78rem', color: tOut > 0 ? 'var(--rust)' : 'var(--concrete)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtAmt(tOut)}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Main Ledger ── */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '18px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            📋 Payment Ledger ({filteredPayments.length})
          </h4>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button onClick={handleExportPDF} style={{ padding: '4px 10px', borderRadius: 6, fontSize: '.65rem', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--gold)', background: 'var(--gold-light)', color: 'var(--gold-dark)', textTransform: 'uppercase', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4 }}>📄 PDF</button>
            {project?.slug && (
              <button onClick={() => { const url = `${window.location.origin}/p/${project.slug}/ledger?view=payments`; navigator.clipboard.writeText(url); toast.success('Shareable link copied!'); }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: '.65rem', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--gold)', background: 'var(--gold-light)', color: 'var(--gold-dark)', textTransform: 'uppercase', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4 }}>🔗 Share</button>
            )}
            {(mode === 'vendor' ? ['All', 'Contractor', 'Vendor Disbursement', 'Client Direct'] : mode === 'client' ? ['All', 'Client Payment', 'Advance', 'Retention', 'Final Bill', 'Client Direct'] : ['All', 'Client Payment', 'Contractor', 'Vendor Disbursement', 'Client Direct', 'Advance']).map(t => (
              <button key={t} onClick={() => setFilterType(t)} className="btn btn-outline btn-sm" style={{ fontSize: '0.65rem', padding: '3px 8px', border: filterType === t ? '1.5px solid var(--ink)' : '1px solid var(--hairline)', background: filterType === t ? 'var(--ink)' : 'transparent', color: filterType === t ? '#fff' : 'var(--concrete)' }}>
                {t === 'All' ? 'All' : t === 'Client Payment' ? 'Client' : t === 'Contractor' ? 'Contractor' : t === 'Vendor Disbursement' ? 'Vendor' : t === 'Client Direct' ? 'Direct Pay' : t}
              </button>
            ))}
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="empty-state"><p>No billing milestones match selection.</p></div>
        ) : (
          <div className="payment-milestone-list">
            {filteredPayments.map((p, index) => {
              const pct = p.amount > 0 ? Math.round((p.paidAmount / p.amount) * 100) : 0;
              const statusBadgeColor = p.status === 'Paid' ? 'paid' : p.status === 'Overdue' ? 'overdue' : p.status === 'Partially Paid' ? 'partial' : 'pending';
              const progressFillColor = p.status === 'Paid' ? 'var(--green)' : p.status === 'Overdue' ? 'var(--rust)' : p.status === 'Partially Paid' ? 'var(--amber)' : 'var(--gold)';
              const contact = contacts.find(c => c.id === p.contactId);
              const vendorContact = contacts.find(c => c.id === p.vendorContactId);

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
                        {contact && <span>👥 {contact.name}</span>}
                        {vendorContact && <span>🏢 Vendor: {vendorContact.name}</span>}
                        {p.linkedPhase && <span>📋 {p.linkedPhase}</span>}
                        {p.dueDate && <span>📅 Due: {p.dueDate}</span>}
                        {p.paidDate && <span>✅ Paid: {p.paidDate}</span>}
                        {p.billUrls && p.billUrls.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {p.billUrls.map((url, i) => {
                              const isPdf = url.toLowerCase().endsWith('.pdf');
                              return (
                                <span key={i} style={{ color: 'var(--gold-dark)', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--gold-light)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--gold)' }} onClick={() => window.open(url, '_blank')}>
                                  {isPdf ? '📄 PDF' : '🖼️ Image'} {p.billUrls.length > 1 ? i + 1 : ''}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--ink)' }}>{fmtAmt(p.amount)}</div>
                        <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--concrete)' }}>Paid: {fmtAmt(p.paidAmount)}</div>
                        {p.amount - p.paidAmount > 0 && <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--rust)', fontWeight: 600 }}>Due: {fmtAmt(p.amount - p.paidAmount)}</div>}
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

                  {p.amount > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                        <span>Milestone Progress</span><span>{pct}% Collected</span>
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

      {/* ── Modal Form ── */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
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
                    {PAY_TYPES.filter(t => mode === 'all' || (mode === 'vendor' ? ['Vendor Disbursement', 'Contractor Disbursement', 'Client Direct Payment (to Vendor)'].includes(t) : ['Client Payment', 'Advance', 'Retention', 'Final Bill', 'Client Direct Payment (to Vendor)'].includes(t))).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{isDirectPayment ? 'Client (Payer)' : 'Linked Contact'}</label>
                  <select className="form-select" value={form.contactId} onChange={e => setForm(p => ({ ...p, contactId: e.target.value }))}>
                    <option value="">-- Select Contact --</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
                  </select>
                </div>
              </div>

              {/* Additional vendor selector for Client Direct Payment */}
              {isDirectPayment && (
                <div className="form-group">
                  <label>Vendor (Recipient of Direct Payment)</label>
                  <select className="form-select" value={form.vendorContactId} onChange={e => setForm(p => ({ ...p, vendorContactId: e.target.value }))}>
                    <option value="">-- Select Vendor --</option>
                    {contacts.filter(c => ['Vendor', 'Contractor'].includes(c.role)).map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  {PAY_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
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

              <div className="form-group">
                <label>Attach Bills / Receipts (Images or PDF)</label>
                <input type="file" accept="image/*,application/pdf" multiple className="form-input" onChange={handleFileChange} disabled={uploading} />
                {uploading && <div style={{ fontSize: '0.78rem', color: 'var(--concrete)', marginTop: 4 }}>Uploading... {uploadProgress}%</div>}
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
