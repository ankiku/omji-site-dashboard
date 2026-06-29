'use strict';
const ExcelJS = require('exceljs');
const { tasks } = require('./excel_data.cjs');

// ── Colors ───────────────────────────────────────────────
const C = {
  TITLE_BG:    '1F3864',
  SUBTITLE_BG: '2E75B6',
  INFO_BG:     'DEEAF1',
  INFO_LBL:    '1F3864',
  HDR_BG:      'ED7D31',
  PHASE_BG:    'C55A11',
  PHASE2_BG:   '833C00',
  LIFT_BG:     'E2EFDA',
  STRONG_BG:   'FCE4D6',
  OUTER_SUB:   'F4B183',
  ALT:         'FCE4D6',
  WHITE:       'FFFFFF',
  CHECK_BG:    'E2EFDA',
  HNDOVR_BG:   'FFE699',
  STEEL_BG:    'DDEBF7',
  SURVEY_BG:   'EAF1DD',
  TEST_BG:     'FFF2CC',
  EXCAV_BG:    'F4CCAA',
  WHITE_FT:    'FFFFFF',
  DARK_FT:     '1F1F1F',
  NAVY_FT:     '1F3864',
};

function fill(h) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + h } }; }
function fnt(h, s, b, it) { return { name: 'Calibri', size: s, bold: !!b, italic: !!it, color: { argb: 'FF' + h } }; }

const TBN = {
  top:    { style: 'thin',   color: { argb: 'FFB8B8B8' } },
  left:   { style: 'thin',   color: { argb: 'FFB8B8B8' } },
  bottom: { style: 'thin',   color: { argb: 'FFB8B8B8' } },
  right:  { style: 'thin',   color: { argb: 'FFB8B8B8' } },
};
const MED = {
  top:    { style: 'medium', color: { argb: 'FF1F3864' } },
  left:   { style: 'medium', color: { argb: 'FF1F3864' } },
  bottom: { style: 'medium', color: { argb: 'FF1F3864' } },
  right:  { style: 'medium', color: { argb: 'FF1F3864' } },
};

function sc(cell, bg, fh, fs, b, w, ha, va) {
  cell.fill      = fill(bg);
  cell.font      = fnt(fh, fs, b);
  cell.border    = TBN;
  cell.alignment = { wrapText: w !== false, horizontal: ha || 'left', vertical: va || 'middle' };
}

function rowBg(trade, alt) {
  const t = String(trade).toLowerCase();
  if (t.includes('checklist'))  return C.CHECK_BG;
  if (t === 'handover')         return C.HNDOVR_BG;
  if (t === 'inspection')       return C.HNDOVR_BG;
  if (t.includes('steel'))      return C.STEEL_BG;
  if (t.includes('rmc'))        return C.STEEL_BG;
  if (t.includes('survey'))     return C.SURVEY_BG;
  if (t.includes('testing'))    return C.TEST_BG;
  if (t.includes('excavation')) return C.EXCAV_BG;
  return alt ? C.ALT : C.WHITE;
}

async function run() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Omji Construction';
  wb.created = new Date();

  const ws = wb.addWorksheet('Project Schedule', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 11 }],
  });

  ws.columns = [
    { width: 8  }, { width: 68 }, { width: 14 }, { width: 14 },
    { width: 10 }, { width: 22 }, { width: 14 }, { width: 14 },
    { width: 10 }, { width: 14 }, { width: 65 }, { width: 16 },
  ];

  // ── Row 1: Main Title ─────────────────────────────────
  ws.mergeCells('A1:L1');
  ws.getRow(1).height = 28;
  const r1 = ws.getCell('A1');
  r1.value = 'OMJI CONSTRUCTION';
  r1.fill  = fill(C.TITLE_BG); r1.font = fnt(C.WHITE_FT, 18, true);
  r1.alignment = { horizontal: 'center', vertical: 'middle' }; r1.border = MED;

  // ── Row 2: Subtitle ──────────────────────────────────
  ws.mergeCells('A2:L2');
  ws.getRow(2).height = 22;
  const r2 = ws.getCell('A2');
  r2.value = 'PROJECT SCHEDULE / WORK PLAN \u2014 STRUCTURE & CIVIL WORK (FOOTING TO PLASTER) \u2014 DETAILED v10';
  r2.fill  = fill(C.SUBTITLE_BG); r2.font = fnt(C.WHITE_FT, 12, true);
  r2.alignment = { horizontal: 'center', vertical: 'middle' }; r2.border = TBN;

  // ── Row 3: Building Info ─────────────────────────────
  ws.mergeCells('A3:L3');
  ws.getRow(3).height = 18;
  const r3 = ws.getCell('A3');
  r3.value = 'Proposed Commercial Building (G+1) | Sitapura, Jaipur, Rajasthan';
  r3.fill  = fill(C.SUBTITLE_BG); r3.font = fnt(C.WHITE_FT, 11, false, true);
  r3.alignment = { horizontal: 'center', vertical: 'middle' }; r3.border = TBN;

  // ── Row 4: Separator ─────────────────────────────────
  ws.mergeCells('A4:L4');
  ws.getCell('A4').fill = fill(C.TITLE_BG); ws.getRow(4).height = 5;

  // ── Rows 5-9: Project Info ───────────────────────────
  const INFO = [
    ['Client:', 'Mr. Bharat Ji Jain', 'Contractor:', 'Omji Construction'],
    ['Project Location:', 'Sitapura, Jaipur, Rajasthan', 'Scope of Work:', 'Civil & Structure - Footing to Plaster'],
    ['Building Type:', "G+1 Commercial (Floor Height: 12'-0\" each)", 'Contract Duration:', '~6 Months | Building: 01-Jul\u219229-Nov-2026 | Outer Works: 06-Jul\u219230-Sep-2026 | Final Handover: 31-Dec-2026'],
    ['Approx. Footprint Area:', "54'-0\" x 99'-0\" (~5,346 Sq.Ft per floor, within setback line)", 'Working Schedule:', '7 Days / Week'],
    ['Project Start Date:', '01-Jul-2026', 'Project End Date:', '31-Dec-2026'],
  ];
  INFO.forEach((d, i) => {
    const rn = 5 + i;
    ws.mergeCells(`B${rn}:E${rn}`);
    ws.mergeCells(`H${rn}:L${rn}`);
    ws.getRow(rn).height = 18;
    sc(ws.getCell(`A${rn}`), C.INFO_LBL, C.WHITE_FT, 10, true, true, 'right'); ws.getCell(`A${rn}`).value = d[0];
    sc(ws.getCell(`B${rn}`), C.INFO_BG,  C.NAVY_FT,  10, false);               ws.getCell(`B${rn}`).value = d[1];
    sc(ws.getCell(`F${rn}`), C.INFO_LBL, C.WHITE_FT, 10, true, true, 'right'); ws.getCell(`F${rn}`).value = d[2];
    sc(ws.getCell(`G${rn}`), C.INFO_LBL, C.WHITE_FT, 10, true, true, 'right'); ws.getCell(`G${rn}`).value = '';
    sc(ws.getCell(`H${rn}`), C.INFO_BG,  C.NAVY_FT,  10, false);               ws.getCell(`H${rn}`).value = d[3];
  });

  // ── Row 10: Separator ────────────────────────────────
  ws.mergeCells('A10:L10');
  ws.getCell('A10').fill = fill(C.TITLE_BG); ws.getRow(10).height = 5;

  // ── Row 11: Column Headers ───────────────────────────
  const HDRS = [
    'Task\r\nNo.', 'Activity Description', 'Start Date', 'Finish Date',
    'Duration\r\n(Days)', 'Trade /\r\nResponsibility', 'Actual\r\nStart',
    'Actual\r\nFinish', 'Delay\r\n(Days)', 'Status', 'Remarks', 'Structural\r\nZone',
  ];
  ws.getRow(11).height = 36;
  HDRS.forEach((h, i) => {
    const cell = ws.getCell(11, i + 1);
    cell.value = h; cell.fill = fill(C.HDR_BG); cell.font = fnt(C.WHITE_FT, 11, true);
    cell.border = MED; cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  });

  // ── Task Rows ────────────────────────────────────────
  let rowNum = 12, alt = false;

  for (const item of tasks) {
    if (Array.isArray(item)) {
      alt = !alt;
      const bg = rowBg(item[5], alt);
      ws.getRow(rowNum).height = 40;
      item.forEach((v, i) => {
        const cell = ws.getCell(rowNum, i + 1);
        cell.value  = v === '' ? null : v;
        cell.fill   = fill(bg);
        cell.font   = (i === 0) ? fnt(C.NAVY_FT, 10, true) : fnt(C.DARK_FT, 10);
        cell.border = TBN;
        cell.alignment = {
          wrapText:   true,
          horizontal: (i === 0 || i === 4 || i === 8) ? 'center' : 'left',
          vertical:   'middle',
        };
        if (i === 1 && String(item[5]).toLowerCase() === 'handover') {
          cell.font = fnt('7F3C00', 11, true);
        }
      });
      rowNum++;
    } else if (item.phase) {
      ws.mergeCells(`A${rowNum}:L${rowNum}`);
      ws.getRow(rowNum).height = 22;
      alt = false;
      const bg   = item.phase.includes('PHASE 15') ? C.PHASE2_BG : C.PHASE_BG;
      const cell = ws.getCell(`A${rowNum}`);
      cell.value = item.phase; cell.fill = fill(bg); cell.font = fnt(C.WHITE_FT, 11, true);
      cell.border = TBN; cell.alignment = { horizontal: 'left', vertical: 'middle' };
      rowNum++;
    } else if (item.sub) {
      ws.mergeCells(`A${rowNum}:L${rowNum}`);
      ws.getRow(rowNum).height = 18;
      alt = false;
      let bg = C.OUTER_SUB;
      if (item.type === 'lift')   bg = C.LIFT_BG;
      if (item.type === 'strong') bg = C.STRONG_BG;
      const cell = ws.getCell(`A${rowNum}`);
      cell.value = item.sub; cell.fill = fill(bg); cell.font = fnt(C.NAVY_FT, 10, true, true);
      cell.border = TBN; cell.alignment = { horizontal: 'left', vertical: 'middle' };
      rowNum++;
    }
  }

  ws.autoFilter = { from: { row: 11, column: 1 }, to: { row: 11, column: 12 } };

  const fname = 'Omji_Construction_ProjectSchedule_v10_styled.xlsx';
  await wb.xlsx.writeFile(fname);
  console.log('Done! File:', fname, '| Total rows:', rowNum - 1);
}

run().catch(err => { console.error(err); process.exit(1); });
