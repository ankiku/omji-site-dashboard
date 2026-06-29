import { useState, useRef } from 'react';
import { computeProjectStats, formatDate, getPhases } from '../utils/helpers';
import { exportTasksToXLSX } from '../utils/xlsxParser';

/**
 * Generates a professional HTML report for printing / PDF export.
 */
function generateReportHTML(project, tasks, photos, stats) {
  const phases = getPhases(tasks);
  const now = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  let phaseRows = '';
  phases.forEach(phase => {
    const phaseTasks = tasks.filter(t => t.phase === phase);
    const ps = computeProjectStats(phaseTasks);
    phaseRows += `
      <tr style="background:#FAF9F6;">
        <td colspan="8" style="padding:10px 14px;font-weight:700;font-size:0.85rem;border-bottom:2px solid #C5A880;color:#1C1A17;font-family:'Segoe UI',sans-serif;">
          ${phase} — ${ps.percentComplete}% Complete (${ps.completed}/${ps.total} tasks, ${ps.delayed} delayed)
        </td>
      </tr>`;
    phaseTasks.forEach(t => {
      const statusColor = t.status === 'Completed' ? '#4D6645' : t.status === 'Delayed' ? '#C4441E' : t.status === 'In Progress' ? '#B8862E' : '#7C7468';
      phaseRows += `
        <tr>
          <td style="padding:8px 14px;border-bottom:1px solid #E5DFD3;font-family:'Courier New',monospace;font-size:0.8rem;color:#7C7468;">${t.taskNo}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #E5DFD3;font-size:0.85rem;">${t.activity}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #E5DFD3;font-size:0.8rem;color:#7C7468;">${formatDate(t.plannedStart)}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #E5DFD3;font-size:0.8rem;color:#7C7468;">${formatDate(t.plannedFinish)}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #E5DFD3;font-size:0.8rem;color:#7C7468;">${formatDate(t.actualStart)}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #E5DFD3;font-size:0.8rem;color:#7C7468;">${formatDate(t.actualFinish)}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #E5DFD3;"><span style="display:inline-block;padding:4px 12px;border-radius:100px;font-size:0.7rem;font-weight:600;background:${statusColor}15;color:${statusColor};">${t.status}</span></td>
          <td style="padding:8px 14px;border-bottom:1px solid #E5DFD3;font-size:0.8rem;color:#7C7468;">${t.remarks || '—'}</td>
        </tr>`;
    });
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} — Site Progress Report</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      @page { margin: 0.6in; size: A4 landscape; }
    }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1C1A17; margin: 0; padding: 40px; background: #fff; }
    .report-header { border-bottom: 3px solid #C5A880; padding-bottom: 20px; margin-bottom: 24px; }
    .report-header h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 4px 0; }
    .report-header .subtitle { font-size: 0.8rem; color: #7C7468; font-family: 'Courier New', monospace; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .meta-item label { display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: #7C7468; margin-bottom: 2px; }
    .meta-item span { font-size: 0.88rem; font-weight: 600; }
    .stats-row { display: flex; gap: 16px; margin-bottom: 24px; }
    .stat-box { flex: 1; background: #FAF9F6; border: 1px solid #E5DFD3; border-radius: 8px; padding: 14px; text-align: center; }
    .stat-box .val { font-size: 1.6rem; font-weight: 700; }
    .stat-box .lbl { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; color: #7C7468; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { padding: 10px 14px; text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #7C7468; border-bottom: 2px solid #1C1A17; background: #FFFFFF; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #E5DFD3; font-size: 0.7rem; color: #7C7468; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>◆ ${project.name}</h1>
    <div class="subtitle">SITE PROGRESS REPORT — Generated ${now}</div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><label>Client</label><span>${project.clientName || '—'}</span></div>
    <div class="meta-item"><label>Architect</label><span>${project.architectName || '—'}</span></div>
    <div class="meta-item"><label>Location</label><span>${project.location || '—'}</span></div>
    <div class="meta-item"><label>Start Date</label><span>${formatDate(project.startDate)}</span></div>
    <div class="meta-item"><label>Target Handover</label><span>${formatDate(project.targetHandover)}</span></div>
    <div class="meta-item"><label>Total Photos</label><span>${photos.length}</span></div>
  </div>

  <div class="stats-row">
    <div class="stat-box"><div class="val" style="color:#4D6645;">${stats.percentComplete}%</div><div class="lbl">Complete</div></div>
    <div class="stat-box"><div class="val">${stats.total}</div><div class="lbl">Total Tasks</div></div>
    <div class="stat-box"><div class="val" style="color:#4D6645;">${stats.completed}</div><div class="lbl">Completed</div></div>
    <div class="stat-box"><div class="val" style="color:#B8862E;">${stats.inProgress}</div><div class="lbl">In Progress</div></div>
    <div class="stat-box"><div class="val" style="color:#C4441E;">${stats.delayed}</div><div class="lbl">Delayed</div></div>
    <div class="stat-box"><div class="val">${stats.notStarted}</div><div class="lbl">Not Started</div></div>
  </div>

  ${project.scopeOfWork ? `<p style="font-size:0.85rem;color:#7C7468;margin-bottom:20px;"><strong>Scope:</strong> ${project.scopeOfWork}</p>` : ''}

  <table>
    <thead>
      <tr>
        <th>Task No</th><th>Activity</th><th>Plan Start</th><th>Plan Finish</th>
        <th>Actual Start</th><th>Actual Finish</th><th>Status</th><th>Remarks</th>
      </tr>
    </thead>
    <tbody>${phaseRows}</tbody>
  </table>

  <div class="footer">
    <span>◆ Omji Site Register</span>
    <span>Report for ${project.clientName || 'Stakeholder'} · ${project.name}</span>
  </div>
</body>
</html>`;
}

/**
 * Generates CSV content from tasks.
 */
function generateCSV(tasks, project) {
  const headers = ['Task No', 'Activity', 'Phase', 'Planned Start', 'Planned Finish', 'Actual Start', 'Actual Finish', 'Duration (days)', 'Trade', 'Status', 'Remarks'];
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = tasks.map(t => [
    t.taskNo, t.activity, t.phase,
    formatDate(t.plannedStart), formatDate(t.plannedFinish),
    formatDate(t.actualStart), formatDate(t.actualFinish),
    t.duration || '', t.trade || '', t.status, t.remarks || ''
  ].map(escape).join(','));

  return [headers.join(','), ...rows].join('\n');
}

export default function ReportExporter({ project, tasks, photos, stats }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const menuRef = useRef(null);

  const handlePrintReport = () => {
    const html = generateReportHTML(project, tasks, photos, stats);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
    setShowMenu(false);
  };

  const handleExportCSV = () => {
    const csv = generateCSV(tasks, project);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const handleExportExcel = () => {
    exportTasksToXLSX(project, tasks);
    setShowMenu(false);
  };

  const handleExportJSON = () => {
    const data = {
      project,
      tasks,
      stats,
      exportedAt: new Date().toISOString(),
      photoCount: photos.length
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const shareUrl = `${window.location.origin}/p/${project.slug}`;

  const buildReportText = () => {
    return `📋 *${project.name}* — Site Progress Report\n\n` +
      `📊 *Progress:* ${stats.percentComplete}% Complete\n` +
      `✅ Completed: ${stats.completed}/${stats.total}\n` +
      `🔶 In Progress: ${stats.inProgress}\n` +
      `🔴 Delayed: ${stats.delayed}\n\n` +
      `👤 Client: ${project.clientName || '—'}\n` +
      `🏗️ Architect: ${project.architectName || '—'}\n` +
      `📍 Location: ${project.location || '—'}\n\n` +
      `🔗 Live Dashboard: ${shareUrl}\n\n` +
      `— Omji Site Register`;
  };

  const handleWhatsAppShare = (phoneNumber = '') => {
    const text = encodeURIComponent(buildReportText());
    const url = phoneNumber
      ? `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
    setShowShareModal(false);
    setShowMenu(false);
  };

  const handleEmailShare = (email = '') => {
    const subject = encodeURIComponent(`${project.name} — Site Progress Report`);
    const body = encodeURIComponent(buildReportText().replace(/\*/g, ''));
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');
    setShowShareModal(false);
    setShowMenu(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Share link copied to clipboard!');
    }).catch(() => {
      prompt('Copy this link:', shareUrl);
    });
    setShowMenu(false);
  };

  return (
    <div className="report-exporter" style={{ position: 'relative' }}>
      <button
        className="btn btn-primary btn-sm"
        onClick={() => setShowMenu(!showMenu)}
        id="report-actions-btn"
        style={{ gap: '8px' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Reports & Export
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '2px' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div className="report-menu-backdrop" onClick={() => setShowMenu(false)} />
          <div className="report-menu" ref={menuRef}>
            <div className="report-menu-section">
              <div className="report-menu-label">EXPORT REPORT</div>
              <button className="report-menu-item" onClick={handlePrintReport} id="export-pdf-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <div>
                  <span>Print / Save as PDF</span>
                  <small>Professional formatted report</small>
                </div>
              </button>
              <button className="report-menu-item" onClick={handleExportCSV} id="export-csv-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                <div>
                  <span>Export as CSV</span>
                  <small>Open in Excel / Google Sheets</small>
                </div>
              </button>
              <button className="report-menu-item" onClick={handleExportExcel} id="export-xlsx-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#217346" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                <div>
                  <span>Export as Excel (XLSX)</span>
                  <small>Professional formatted schedule spreadsheet</small>
                </div>
              </button>
              <button className="report-menu-item" onClick={handleExportJSON} id="export-json-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <div>
                  <span>Export as JSON</span>
                  <small>Full project data backup</small>
                </div>
              </button>
            </div>

            <div className="report-menu-divider" />

            <div className="report-menu-section">
              <div className="report-menu-label">SEND TO STAKEHOLDER</div>
              <button className="report-menu-item" onClick={() => setShowShareModal('whatsapp')} id="share-whatsapp-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.8">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <div>
                  <span>Send via WhatsApp</span>
                  <small>Share report to client / architect</small>
                </div>
              </button>
              <button className="report-menu-item" onClick={() => setShowShareModal('email')} id="share-email-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4441E" strokeWidth="1.8">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <div>
                  <span>Send via Email</span>
                  <small>Email report summary to stakeholders</small>
                </div>
              </button>
              <button className="report-menu-item" onClick={handleCopyLink} id="copy-link-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <div>
                  <span>Copy Share Link</span>
                  <small>Public dashboard link for stakeholders</small>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          type={showShareModal}
          project={project}
          onClose={() => setShowShareModal(false)}
          onWhatsApp={handleWhatsAppShare}
          onEmail={handleEmailShare}
        />
      )}
    </div>
  );
}

function ShareModal({ type, project, onClose, onWhatsApp, onEmail }) {
  const [contact, setContact] = useState('');
  const isWhatsApp = type === 'whatsapp';
  const title = isWhatsApp ? 'Send Report via WhatsApp' : 'Send Report via Email';
  const placeholder = isWhatsApp ? '+91 98765 43210' : 'client@example.com';
  const label = isWhatsApp ? 'Phone Number (with country code)' : 'Email Address';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isWhatsApp) {
      onWhatsApp(contact);
    } else {
      onEmail(contact);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{label}</label>
            <input
              className="form-input"
              type={isWhatsApp ? 'tel' : 'email'}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </div>
          <div className="modal-presets">
            {project.clientName && (
              <button
                type="button"
                className="preset-chip"
                onClick={() => {
                  if (isWhatsApp) onWhatsApp('');
                  else onEmail('');
                }}
              >
                👤 Send to Client ({project.clientName})
              </button>
            )}
            {project.architectName && (
              <button
                type="button"
                className="preset-chip"
                onClick={() => {
                  if (isWhatsApp) onWhatsApp('');
                  else onEmail('');
                }}
              >
                🏗️ Send to Architect ({project.architectName})
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginTop: 'var(--sp-md)' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              {isWhatsApp ? '📱 Open WhatsApp' : '📧 Open Email Client'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
