import * as XLSX from 'xlsx';

/**
 * Parse an XLSX file into an array of task objects.
 * Supports Omji_Construction_ProjectSchedule_v8 format.
 * Also extracts project metadata (client, architect, location, etc.) from the header area.
 */
export function parseTasksFromXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length < 2) {
          reject(new Error('Spreadsheet must have at least a header row and one data row'));
          return;
        }

        const tasks = [];
        const metadata = {};
        let currentPhase = 'General';
        let taskOrder = 0;
        let headerRowIndex = -1;

        // First pass: find the header row and extract metadata
        for (let i = 0; i < Math.min(rows.length, 25); i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || '').trim();
          const secondCell = String(row[1] || '').trim();
          const firstLower = firstCell.toLowerCase();

          // Extract metadata from label:value pairs
          if (firstLower.includes('client') || firstLower.includes('owner')) {
            metadata.clientName = secondCell || extractAfterColon(firstCell);
          } else if (firstLower.includes('architect') || firstLower.includes('designer')) {
            metadata.architectName = secondCell || extractAfterColon(firstCell);
          } else if (firstLower.includes('location') || firstLower.includes('site address') || firstLower.includes('address')) {
            metadata.location = secondCell || extractAfterColon(firstCell);
          } else if (firstLower.includes('building type') || firstLower.includes('project type')) {
            metadata.buildingType = secondCell || extractAfterColon(firstCell);
          } else if (firstLower.includes('project start') || firstLower.includes('start date') || firstLower.includes('commencement')) {
            const d = parseDate(secondCell || row[2]);
            if (d) metadata.startDate = d;
          } else if (firstLower.includes('target handover') || firstLower.includes('completion') || firstLower.includes('handover')) {
            const d = parseDate(secondCell || row[2]);
            if (d) metadata.targetHandover = d;
          } else if (firstLower.includes('scope') || firstLower.includes('footprint')) {
            metadata.scopeOfWork = secondCell || extractAfterColon(firstCell);
          } else if (firstLower.includes('project name') || firstLower.includes('project:')) {
            metadata.name = secondCell || extractAfterColon(firstCell);
          }

          // Detect header row by looking for "task no" pattern
          const firstLowerClean = firstLower.replace(/\s+/g, ' ').trim();
          if (
            firstLowerClean === 'task no.' || firstLowerClean === 'task no' ||
            firstLowerClean === 'sr no' || firstLowerClean === 'sr. no' || firstLowerClean === 'sr no.' ||
            firstLowerClean === 's.no' || firstLowerClean === 's. no' || firstLowerClean === 's.no.' ||
            firstLowerClean === 'sl no' || firstLowerClean === 'sl. no' ||
            (firstLowerClean.includes('task') && firstLowerClean.includes('no'))
          ) {
            headerRowIndex = i;
          }
        }

        // Default column mapping (in case header row is not found or matches are partial)
        let colMapping = {
          taskNo: 0,
          activity: 1,
          structuralZone: -1, // default none
          plannedStart: 2,
          plannedFinish: 3,
          duration: 4,
          trade: 5,
          actualStart: 6,
          actualFinish: 7,
          delay: 8,
          status: 9,
          remarks: 10
        };

        if (headerRowIndex >= 0) {
          const headerRow = rows[headerRowIndex];
          headerRow.forEach((cell, idx) => {
            if (!cell) return;
            const text = String(cell).toLowerCase().replace(/\s+/g, ' ').trim();
            if (text === 'task no.' || text === 'task no' || text === 'sr no' || text === 'sr. no' || text === 's.no' || text === 'sl no') {
              colMapping.taskNo = idx;
            } else if (text.includes('activity description') || text.includes('activity')) {
              colMapping.activity = idx;
            } else if (text.includes('structural zone') || text.includes('zone')) {
              colMapping.structuralZone = idx;
            } else if (text.includes('start date') || text.includes('planned start') || text === 'start') {
              colMapping.plannedStart = idx;
            } else if (text.includes('finish date') || text.includes('planned finish') || text === 'finish') {
              colMapping.plannedFinish = idx;
            } else if (text.includes('duration')) {
              colMapping.duration = idx;
            } else if (text.includes('trade') || text.includes('responsibility')) {
              colMapping.trade = idx;
            } else if (text.includes('actual start')) {
              colMapping.actualStart = idx;
            } else if (text.includes('actual finish')) {
              colMapping.actualFinish = idx;
            } else if (text.includes('delay')) {
              colMapping.delay = idx;
            } else if (text.includes('status')) {
              colMapping.status = idx;
            } else if (text.includes('remarks') || text.includes('comment')) {
              colMapping.remarks = idx;
            }
          });
        }

        // If no header row found, start from row 1 (skip first row as header)
        const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;

        // Second pass: parse tasks starting after the header row
        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || '').trim();
          if (!firstCell) continue;

          const firstCellLower = firstCell.toLowerCase();

          // Skip metadata rows, table headers, and empty-content rows
          if (isMetadataRow(firstCell, firstCellLower)) continue;

          // Detect task number pattern (e.g. 100, 100E, O-40, 119H)
          const isTaskNoPattern = /^[A-Z0-9\-\.\s]+$/i.test(firstCell) && firstCell.length <= 8;

          // Skip blank/empty placeholder tasks
          const activityDesc = String(row[colMapping.activity] || '').trim();
          if (isTaskNoPattern && !activityDesc) {
            continue;
          }

          // Detect phase headers
          if (isPhaseHeader(firstCell, row, isTaskNoPattern)) {
            currentPhase = firstCell
              .replace(/[═╬╠╣║╔╗╚╝─│┌┐└┘├┤┬┴┼]/g, '')
              .replace(/^[\s\-:]+|[\s\-:]+$/g, '')
              .trim() || currentPhase;
            continue;
          }

          taskOrder++;
          tasks.push({
            taskNo: String(row[colMapping.taskNo] !== undefined ? row[colMapping.taskNo] : taskOrder),
            activity: activityDesc,
            plannedStart: parseDate(row[colMapping.plannedStart]),
            plannedFinish: parseDate(row[colMapping.plannedFinish]),
            duration: row[colMapping.duration] ? Number(row[colMapping.duration]) : null,
            trade: String(row[colMapping.trade] || ''),
            actualStart: parseDate(row[colMapping.actualStart]),
            actualFinish: parseDate(row[colMapping.actualFinish]),
            delay: row[colMapping.delay] ? Number(row[colMapping.delay]) : 0,
            status: normalizeStatus(String(row[colMapping.status] || 'Not Started')),
            remarks: String(row[colMapping.remarks] || ''),
            structuralZone: colMapping.structuralZone >= 0 ? String(row[colMapping.structuralZone] || '').trim() : '',
            phase: currentPhase,
            order: taskOrder,
          });
        }

        resolve({ tasks, metadata });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function extractAfterColon(s) {
  const parts = s.split(':');
  return parts.length > 1 ? parts.slice(1).join(':').trim() : '';
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function isMetadataRow(cell, cellLower) {
  return (
    cell.endsWith(':') ||
    cellLower.includes('client') ||
    cellLower.includes('location') ||
    cellLower.includes('architect') ||
    cellLower.includes('building type') ||
    cellLower.includes('footprint') ||
    cellLower.includes('project start') ||
    cellLower.includes('target handover') ||
    cellLower.includes('proposed commercial') ||
    cellLower.includes('project name') ||
    cellLower.includes('commencement') ||
    cellLower === 'task no.' || cellLower === 'task no' ||
    cellLower === 'task\r\nno.' || cellLower === 'task\nno.' ||
    cellLower === 'sr no' || cellLower === 'sr. no' ||
    cellLower === 'activity description' ||
    cellLower === 'activity' ||
    cell.includes('|')
  );
}

function isPhaseHeader(cell, row, isTaskNoPattern) {
  const upper = cell.toUpperCase();
  return (
    upper.startsWith('PHASE') ||
    cell.includes('═') ||
    cell.includes('───') ||
    (upper.startsWith('STAGE') && !row[2] && !row[3]) ||
    (!isTaskNoPattern && cell.length > 0 && !row[1] && !row[2] && !row[3])
  );
}

function normalizeStatus(s) {
  const lower = s.toLowerCase().trim();
  if (lower.includes('complete') || lower.includes('done') || lower.includes('finish')) return 'Completed';
  if (lower.includes('progress') || lower.includes('ongoing') || lower.includes('wip') || lower.includes('active')) return 'In Progress';
  if (lower.includes('delay') || lower.includes('behind') || lower.includes('overdue')) return 'Delayed';
  return 'Not Started';
}

/**
 * Export tasks and project metadata to a formatted XLSX file
 * matching the Omji Construction Project Schedule format.
 */
export function exportTasksToXLSX(project, tasks) {
  const formatDateStr = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const rows = [
    ['OMJI CONSTRUCTION'],
    ['PROJECT SCHEDULE / WORK PLAN - STRUCTURE & CIVIL WORK'],
    [`${project.name || 'Project Schedule'}`],
    [],
    ['Client:', project.clientName || '—', '', '', '', '', 'Contractor:', 'Omji Construction'],
    ['Project Location:', project.location || '—', '', '', '', '', 'Scope of Work:', project.scopeOfWork || '—'],
    ['Building Type:', project.buildingType || '—', '', '', '', '', 'Contract Duration:', ''],
    ['Approx. Footprint Area:', project.footprint || '—', '', '', '', '', 'Working Schedule:', '7 Days / Week'],
    ['Project Start Date:', formatDateStr(project.startDate), '', '', '', '', 'Target Handover:', formatDateStr(project.targetHandover)],
    [],
    [
      'Task No.',
      'Activity Description',
      'Structural Zone',
      'Start Date',
      'Finish Date',
      'Duration (Days)',
      'Trade / Responsibility',
      'Actual Start',
      'Actual Finish',
      'Delay (Days)',
      'Status',
      'Remarks'
    ]
  ];

  // Group tasks by phase and order them
  const phases = [...new Set(tasks.map(t => t.phase))];
  phases.forEach(phase => {
    // Add Phase Divider row
    rows.push([phase.toUpperCase(), '', '', '', '', '', '', '', '', '', '', '']);
    
    // Add Tasks in this phase
    const phaseTasks = tasks.filter(t => t.phase === phase);
    phaseTasks.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    phaseTasks.forEach(t => {
      rows.push([
        t.taskNo || '',
        t.activity || '',
        t.structuralZone || '',
        formatDateStr(t.plannedStart),
        formatDateStr(t.plannedFinish),
        t.duration || '',
        t.trade || '',
        formatDateStr(t.actualStart),
        formatDateStr(t.actualFinish),
        t.delay || 0,
        t.status || 'Not Started',
        t.remarks || ''
      ]);
    });
  });

  // Create sheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths (12 columns total now)
  ws['!cols'] = [
    { wch: 10 }, // Task No
    { wch: 50 }, // Activity Description
    { wch: 18 }, // Structural Zone
    { wch: 14 }, // Start Date
    { wch: 14 }, // Finish Date
    { wch: 10 }, // Duration
    { wch: 18 }, // Trade
    { wch: 14 }, // Actual Start
    { wch: 14 }, // Actual Finish
    { wch: 10 }, // Delay
    { wch: 14 }, // Status
    { wch: 30 }  // Remarks
  ];

  // Set Merges for headers & phase dividers
  const merges = [
    // Header title merges
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } }
  ];

  // Find phase divider row indices and add merges for them
  for (let r = 11; r < rows.length; r++) {
    const firstCell = rows[r][0];
    const isPhaseRow = firstCell && (
      firstCell.startsWith('PHASE') || 
      firstCell.startsWith('STAGE') || 
      firstCell.includes('STRUCTURE') || 
      firstCell.includes('LIFT') || 
      firstCell.includes('BASEMENT')
    );
    if (isPhaseRow) {
      merges.push({ s: { r, c: 0 }, e: { r, c: 11 } });
    }
  }
  ws['!merges'] = merges;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Project Schedule');

  // Generate buffer and trigger file download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  
  const fileName = `${(project.name || 'project').replace(/\s+/g, '_')}_schedule_${new Date().toISOString().split('T')[0]}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
