export function exportTableToPDF(title, headers, rows) {
  const now = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const thead = headers.map(h => `<th>${h}</th>`).join('');
  const tbody = rows.map(row => {
    const tds = row.map(cell => `<td style="padding:8px 14px;border-bottom:1px solid #E5DFD3;font-size:0.8rem;">${cell || '—'}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
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
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { padding: 10px 14px; text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #7C7468; border-bottom: 2px solid #1C1A17; background: #FFFFFF; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #E5DFD3; font-size: 0.7rem; color: #7C7468; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>◆ ${title}</h1>
    <div class="subtitle">GENERATED ON ${now}</div>
  </div>

  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>

  <div class="footer">
    <span>◆ Omji Site Register</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}
