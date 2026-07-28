import React, { useState, useEffect, useMemo } from 'react';
import { subscribeToMaterials, subscribeToPayments } from '../services/localStorageService';

export default function VendorReportModal({ projectId, contact, onClose }) {
  const [materials, setMaterials] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const unsubMat = subscribeToMaterials(projectId, setMaterials);
    const unsubPay = subscribeToPayments(projectId, setPayments);
    return () => { unsubMat(); unsubPay(); };
  }, [projectId]);

  const {
    totalMaterialReceived,
    totalMaterialCost,
    totalAmountPaid,
    totalDue,
    directPaidByClient,
    paidByOmji,
    vendorMaterials,
    vendorPayments
  } = useMemo(() => {
    // 1. Calculate Material Received & Cost for this vendor
    // Materials associated with this contact:
    let totalMaterialReceived = 0;
    let totalMaterialCost = 0;
    const vendorMaterials = [];
    
    materials.forEach(m => {
      if (m.contactId === contact.id || m.vendor === contact.name) {
        if ((m.received || 0) > 0) {
          totalMaterialReceived += parseFloat(m.received || 0);
          totalMaterialCost += parseFloat(m.received || 0) * parseFloat(m.rate || 0);
        }
        if (m.category === 'Subcontractor Payment') {
          totalMaterialCost += parseFloat(m.subcontractorPayment || 0);
        }
        vendorMaterials.push(m);
      }
    });

    // 2. Calculate Payments for this vendor
    let totalAmountPaid = 0;
    let directPaidByClient = 0;
    let paidByOmji = 0;
    const vendorPayments = [];

    payments.forEach(p => {
      // Check if this payment is directed to this contact
      // For Client Direct, vendorContactId is the vendor receiving it.
      // For others, contactId is the vendor.
      if (p.contactId === contact.id || p.vendorContactId === contact.id) {
        const amt = parseFloat(p.paidAmount || 0);
        totalAmountPaid += amt;

        if (p.type === 'Client Direct Payment (to Vendor)' || p.type === 'Client Direct') {
          directPaidByClient += amt;
        } else if (p.type.includes('Vendor') || p.type.includes('Contractor') || p.type.includes('Omji')) {
          paidByOmji += amt;
        }
        vendorPayments.push(p);
      }
    });

    const totalDue = Math.max(0, totalMaterialCost - totalAmountPaid);

    return {
      totalMaterialReceived,
      totalMaterialCost,
      totalAmountPaid,
      totalDue,
      directPaidByClient,
      paidByOmji,
      vendorMaterials,
      vendorPayments
    };
  }, [materials, payments, contact]);

  const fmtAmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 850, padding: 0, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ background: 'var(--ink)', color: '#fff', padding: '24px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--concrete)' }}>Vendor Dashboard Report</div>
            <h2 style={{ margin: 0, fontSize: '1.8rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>{contact.name}</h2>
            {contact.company && <div style={{ fontSize: '.9rem', color: '#aaa', marginTop: 4 }}>{contact.company} • {contact.role}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '30px', background: 'var(--paper-2)', maxHeight: '75vh', overflowY: 'auto' }}>
          
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            
            <div style={{ background: 'var(--paper)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total Material / Work Value</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--ink)', marginTop: 8, fontFamily: 'var(--font-display)' }}>{fmtAmt(totalMaterialCost)}</div>
            </div>

            <div style={{ background: 'var(--paper)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total Amount Paid</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green)', marginTop: 8, fontFamily: 'var(--font-display)' }}>{fmtAmt(totalAmountPaid)}</div>
            </div>

            <div style={{ background: 'var(--paper)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Outstanding Due</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: totalDue > 0 ? 'var(--rust)' : 'var(--concrete)', marginTop: 8, fontFamily: 'var(--font-display)' }}>{fmtAmt(totalDue)}</div>
            </div>

          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '30px' }}>
             <div style={{ background: 'var(--paper)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Paid by Omji Construction</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--amber)', marginTop: 4, fontFamily: 'var(--font-display)' }}>{fmtAmt(paidByOmji)}</div>
                </div>
             </div>
             
             <div style={{ background: 'var(--paper)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Direct Paid by Client</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--blue, #3D7CB8)', marginTop: 4, fontFamily: 'var(--font-display)' }}>{fmtAmt(directPaidByClient)}</div>
                </div>
             </div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                 <h3 style={{ fontSize: '.8rem', textTransform: 'uppercase', color: 'var(--concrete)', marginBottom: '12px' }}>Material Received ({vendorMaterials.length})</h3>
                 <div style={{ background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
                   {vendorMaterials.length === 0 ? (
                     <div style={{ padding: '20px', textAlign: 'center', color: 'var(--concrete)', fontSize: '.8rem' }}>No materials recorded</div>
                   ) : (
                     <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                       <thead>
                         <tr style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--hairline)' }}>
                           <th style={{ padding: '10px 14px', fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)' }}>Date</th>
                           <th style={{ padding: '10px 14px', fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)' }}>Item</th>
                           <th style={{ padding: '10px 14px', fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textAlign: 'right' }}>Cost</th>
                         </tr>
                       </thead>
                       <tbody>
                         {vendorMaterials.slice(0, 50).map(m => {
                           const cost = m.category === 'Subcontractor Payment' ? (m.subcontractorPayment||0) : ((m.received||0) * (m.rate||0));
                           return (
                             <tr key={m.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                               <td style={{ padding: '10px 14px', fontSize: '.75rem' }}>{m.date}</td>
                               <td style={{ padding: '10px 14px', fontSize: '.8rem', fontWeight: 600, color: 'var(--ink)' }}>
                                 {m.name} {m.received > 0 && <span style={{ color: 'var(--concrete)', fontSize: '.7rem', fontWeight: 400 }}>({m.received} {m.unit})</span>}
                               </td>
                               <td style={{ padding: '10px 14px', fontSize: '.8rem', fontWeight: 700, textAlign: 'right' }}>{fmtAmt(cost)}</td>
                             </tr>
                           )
                         })}
                       </tbody>
                     </table>
                   )}
                 </div>
              </div>

              <div>
                 <h3 style={{ fontSize: '.8rem', textTransform: 'uppercase', color: 'var(--concrete)', marginBottom: '12px' }}>Payments ({vendorPayments.length})</h3>
                 <div style={{ background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
                   {vendorPayments.length === 0 ? (
                     <div style={{ padding: '20px', textAlign: 'center', color: 'var(--concrete)', fontSize: '.8rem' }}>No payments recorded</div>
                   ) : (
                     <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                       <thead>
                         <tr style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--hairline)' }}>
                           <th style={{ padding: '10px 14px', fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)' }}>Milestone</th>
                           <th style={{ padding: '10px 14px', fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)' }}>Status</th>
                           <th style={{ padding: '10px 14px', fontSize: '.7rem', fontWeight: 700, color: 'var(--concrete)', textAlign: 'right' }}>Paid</th>
                         </tr>
                       </thead>
                       <tbody>
                         {vendorPayments.slice(0, 50).map(p => (
                           <tr key={p.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                             <td style={{ padding: '10px 14px', fontSize: '.8rem', fontWeight: 600, color: 'var(--ink)' }}>{p.milestone}</td>
                             <td style={{ padding: '10px 14px', fontSize: '.7rem' }}>
                               <span style={{ background: p.status === 'Paid' ? 'var(--green-light)' : 'var(--amber-light)', color: p.status === 'Paid' ? 'var(--green)' : 'var(--amber)', padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{p.status}</span>
                             </td>
                             <td style={{ padding: '10px 14px', fontSize: '.8rem', fontWeight: 700, textAlign: 'right' }}>{fmtAmt(p.paidAmount)}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   )}
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}
