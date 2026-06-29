/**
 * Schedule Generator Utility
 * Dynamically constructs a sequential, realistic construction schedule
 * modeled after the Omji Construction v8 layout.
 */

// Helper to format Date to YYYY-MM-DD
export function formatDateISO(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

// Helper to format Date to DD-MMM-YYYY (e.g. 01-Jul-2026)
export function formatDateDisplay(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Add days excluding Sundays if work schedule is 6 days/week
export function addDays(dateStr, durationDays, workingDaysPerWeek = 7) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return new Date();
  
  let daysAdded = 0;
  // If duration is 1 day, it finishes on the same day it starts
  const targetDays = Math.max(1, durationDays);
  
  while (daysAdded < targetDays - 1) {
    date.setDate(date.getDate() + 1);
    if (workingDaysPerWeek === 6 && date.getDay() === 0) {
      // It's Sunday, skip it (do not count as a working day)
      continue;
    }
    daysAdded++;
  }
  return date;
}

// Helper to get day after a finish date
export function nextWorkingDay(dateStr, workingDaysPerWeek = 7) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return new Date();
  
  date.setDate(date.getDate() + 1);
  if (workingDaysPerWeek === 6 && date.getDay() === 0) {
    date.setDate(date.getDate() + 1); // Skip Sunday
  }
  return date;
}

/**
 * Infers project parameters from a drawing's filename
 * @param {string} fileName 
 */
export function inferParamsFromDrawing(fileName = '') {
  const name = fileName.toLowerCase();
  const params = {
    hasBasement: false,
    floorsCount: 1,
    buildingType: 'G+1 Commercial',
    scopeOfWork: 'Structure & Civil Work'
  };

  // Check for basement
  if (name.includes('basement') || name.includes('raft') || name.includes('retaining') || name.includes('bsmt')) {
    params.hasBasement = true;
  }

  // Check for floors count
  const gPlusMatch = name.match(/g\+(\d+)/);
  if (gPlusMatch) {
    params.floorsCount = parseInt(gPlusMatch[1], 10) + 1; // e.g. G+1 means 2 floors
    params.buildingType = `G+${gPlusMatch[1]} Building`;
  } else {
    const floorsMatch = name.match(/(\d+)\s*floor/) || name.match(/(\d+)\s*flr/);
    if (floorsMatch) {
      params.floorsCount = parseInt(floorsMatch[1], 10);
      params.buildingType = `G+${params.floorsCount - 1} Building`;
    }
  }

  // Check for type
  if (name.includes('comm') || name.includes('commercial') || name.includes('shop') || name.includes('office')) {
    params.buildingType = `G+${params.floorsCount - 1} Commercial`;
  } else if (name.includes('res') || name.includes('residential') || name.includes('house') || name.includes('villa') || name.includes('flat')) {
    params.buildingType = `G+${params.floorsCount - 1} Residential`;
  }

  return params;
}

/**
 * Main Schedule Generator
 */
export function generateSchedule(options = {}) {
  const {
    startDate = new Date(),
    floorsCount = 2,
    hasBasement = false,
    workingDaysPerWeek = 7,
    clientName = '',
    location = '',
    architectName = '',
    scopeOfWork = 'Civil & Structure'
  } = options;

  const startStr = formatDateISO(startDate);
  const tasks = [];
  let taskCounter = 1;

  // Track the running finish date of each main phase to sequence the next
  let phaseFinishDate = startStr;

  // ────────────────────────────────────────────────────────
  // PHASE 1: MOBILIZATION & PRE-CONSTRUCTION
  // ────────────────────────────────────────────────────────
  const phase1 = 'PHASE 1: MOBILIZATION & PRE-CONSTRUCTION';
  
  const m1 = {
    taskNo: String(taskCounter++),
    activity: 'Site mobilization - office, store, labour shed, security cabin setup',
    plannedStart: new Date(startStr),
    plannedFinish: addDays(startStr, 3, workingDaysPerWeek),
    duration: 3,
    trade: 'Mobilization',
    status: 'Not Started',
    remarks: 'Omji Construction team mobilization',
    phase: phase1,
    order: tasks.length + 1
  };
  tasks.push(m1);

  const m2 = {
    taskNo: String(taskCounter++),
    activity: 'Site survey & boundary verification as per approved drawing',
    plannedStart: new Date(startStr),
    plannedFinish: addDays(startStr, 2, workingDaysPerWeek),
    duration: 2,
    trade: 'Survey',
    status: 'Not Started',
    remarks: 'Cross-check boundary and setbacks',
    phase: phase1,
    order: tasks.length + 1
  };
  tasks.push(m2);

  const m3 = {
    taskNo: String(taskCounter++),
    activity: 'Temporary water & power connection at site',
    plannedStart: new Date(startStr),
    plannedFinish: addDays(startStr, 2, workingDaysPerWeek),
    duration: 2,
    trade: 'Mobilization',
    status: 'Not Started',
    remarks: '',
    phase: phase1,
    order: tasks.length + 1
  };
  tasks.push(m3);

  const m4 = {
    taskNo: String(taskCounter++),
    activity: 'Centering/shuttering material (plywood, props, scaffolding) mobilization',
    plannedStart: new Date(startStr),
    plannedFinish: addDays(startStr, 3, workingDaysPerWeek),
    duration: 3,
    trade: 'Civil',
    status: 'Not Started',
    remarks: '',
    phase: phase1,
    order: tasks.length + 1
  };
  tasks.push(m4);

  const m5 = {
    taskNo: String(taskCounter++),
    activity: 'TMT bar procurement - Fe500/Fe500D, 1st lot (footing & column)',
    plannedStart: new Date(startStr),
    plannedFinish: addDays(startStr, 4, workingDaysPerWeek),
    duration: 4,
    trade: 'Steel',
    status: 'Not Started',
    remarks: 'As per structural BBS',
    phase: phase1,
    order: tasks.length + 1
  };
  tasks.push(m5);

  const m6 = {
    taskNo: String(taskCounter++),
    activity: 'Cement, sand, aggregate - 1st lot order & delivery',
    plannedStart: new Date(startStr),
    plannedFinish: addDays(startStr, 3, workingDaysPerWeek),
    duration: 3,
    trade: 'Civil',
    status: 'Not Started',
    remarks: '',
    phase: phase1,
    order: tasks.length + 1
  };
  tasks.push(m6);

  // Layout marking starts after survey finishes (m2)
  const layoutStart = nextWorkingDay(formatDateISO(m2.plannedFinish), workingDaysPerWeek);
  const m7 = {
    taskNo: String(taskCounter++),
    activity: 'Layout marking - grid lines, column centers, and building corners',
    plannedStart: new Date(layoutStart),
    plannedFinish: addDays(layoutStart, 2, workingDaysPerWeek),
    duration: 2,
    trade: 'Survey',
    status: 'Not Started',
    remarks: 'As per Ground Floor layout & structural drawing',
    phase: phase1,
    order: tasks.length + 1
  };
  tasks.push(m7);

  const m8 = {
    taskNo: String(taskCounter++),
    activity: 'Benchmark & level fixing for excavation depth reference',
    plannedStart: new Date(layoutStart),
    plannedFinish: addDays(layoutStart, 1, workingDaysPerWeek),
    duration: 1,
    trade: 'Survey',
    status: 'Not Started',
    remarks: '',
    phase: phase1,
    order: tasks.length + 1
  };
  tasks.push(m8);

  phaseFinishDate = formatDateISO(m7.plannedFinish);

  // ────────────────────────────────────────────────────────
  // PHASE 2: EXCAVATION & EARTHWORK
  // ────────────────────────────────────────────────────────
  const phase2 = 'PHASE 2: EXCAVATION & EARTHWORK';
  
  const excavationStart = nextWorkingDay(phaseFinishDate, workingDaysPerWeek);
  const e1 = {
    taskNo: String(taskCounter++),
    activity: 'Excavation for isolated column footings (machine + manual dressing)',
    plannedStart: new Date(excavationStart),
    plannedFinish: addDays(excavationStart, 3, workingDaysPerWeek),
    duration: 3,
    trade: 'Excavation',
    status: 'Not Started',
    remarks: '',
    phase: phase2,
    order: tasks.length + 1
  };
  tasks.push(e1);

  // Plinth beam trench starts 1 day after footing excavation starts
  const plinthExcStart = nextWorkingDay(formatDateISO(e1.plannedStart), workingDaysPerWeek);
  const e2 = {
    taskNo: String(taskCounter++),
    activity: 'Excavation for plinth beam / grade beam trench',
    plannedStart: new Date(plinthExcStart),
    plannedFinish: addDays(plinthExcStart, 3, workingDaysPerWeek),
    duration: 3,
    trade: 'Excavation',
    status: 'Not Started',
    remarks: '',
    phase: phase2,
    order: tasks.length + 1
  };
  tasks.push(e2);

  // Anti-termite treatment starts after footing excavation finishes
  const termiteStart = nextWorkingDay(formatDateISO(e1.plannedFinish), workingDaysPerWeek);
  const e3 = {
    taskNo: String(taskCounter++),
    activity: 'Anti-termite treatment to excavated pits & trenches',
    plannedStart: new Date(termiteStart),
    plannedFinish: addDays(termiteStart, 1, workingDaysPerWeek),
    duration: 1,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Chemical treatment before PCC',
    phase: phase2,
    order: tasks.length + 1
  };
  tasks.push(e3);

  const e4 = {
    taskNo: String(taskCounter++),
    activity: 'Anti-termite treatment checklist filled by Site Engineer',
    plannedStart: new Date(termiteStart),
    plannedFinish: addDays(termiteStart, 1, workingDaysPerWeek),
    duration: 1,
    trade: 'Checklist',
    status: 'Not Started',
    remarks: '',
    phase: phase2,
    order: tasks.length + 1
  };
  tasks.push(e4);

  const checklistPmStart = nextWorkingDay(formatDateISO(e4.plannedFinish), workingDaysPerWeek);
  const e5 = {
    taskNo: String(taskCounter++),
    activity: 'Anti-termite treatment checklist verified by Project Manager',
    plannedStart: new Date(checklistPmStart),
    plannedFinish: addDays(checklistPmStart, 1, workingDaysPerWeek),
    duration: 1,
    trade: 'Checklist',
    status: 'Not Started',
    remarks: '',
    phase: phase2,
    order: tasks.length + 1
  };
  tasks.push(e5);

  const dressingStart = nextWorkingDay(formatDateISO(e3.plannedFinish), workingDaysPerWeek);
  const e6 = {
    taskNo: String(taskCounter++),
    activity: 'Dressing & leveling of footing base, dewatering if required',
    plannedStart: new Date(dressingStart),
    plannedFinish: addDays(dressingStart, 2, workingDaysPerWeek),
    duration: 2,
    trade: 'Civil',
    status: 'Not Started',
    remarks: '',
    phase: phase2,
    order: tasks.length + 1
  };
  tasks.push(e6);

  phaseFinishDate = formatDateISO(e6.plannedFinish);

  // ────────────────────────────────────────────────────────
  // PHASE 3: FOUNDATION - PCC, FOOTING REINFORCEMENT, SHUTTERING & CASTING
  // ────────────────────────────────────────────────────────
  const phase3 = 'PHASE 3: FOUNDATION - PCC, FOOTING REINFORCEMENT, SHUTTERING & CASTING';
  const fndStart = nextWorkingDay(phaseFinishDate, workingDaysPerWeek);

  const f1 = {
    taskNo: String(taskCounter++),
    activity: 'PCC (1:4:8) at footing base - all isolated footings',
    plannedStart: new Date(fndStart),
    plannedFinish: addDays(fndStart, 2, workingDaysPerWeek),
    duration: 2,
    trade: 'Civil',
    status: 'Not Started',
    remarks: '100-150mm PCC bed',
    phase: phase3,
    order: tasks.length + 1
  };
  tasks.push(f1);

  const rebarStart = nextWorkingDay(formatDateISO(f1.plannedStart), workingDaysPerWeek);
  const f2 = {
    taskNo: String(taskCounter++),
    activity: 'Footing reinforcement - cutting, bending & binding (TMT bars)',
    plannedStart: new Date(rebarStart),
    plannedFinish: addDays(rebarStart, 4, workingDaysPerWeek),
    duration: 4,
    trade: 'Steel',
    status: 'Not Started',
    remarks: 'As per footing BBS/schedule',
    phase: phase3,
    order: tasks.length + 1
  };
  tasks.push(f2);

  const rebarCheckStart = nextWorkingDay(formatDateISO(f2.plannedFinish), workingDaysPerWeek);
  const f3 = {
    taskNo: String(taskCounter++),
    activity: 'Footing reinforcement checklist filled by Site Engineer',
    plannedStart: new Date(rebarCheckStart),
    plannedFinish: addDays(rebarCheckStart, 1, workingDaysPerWeek),
    duration: 1,
    trade: 'Checklist',
    status: 'Not Started',
    remarks: '',
    phase: phase3,
    order: tasks.length + 1
  };
  tasks.push(f3);

  const rebarCheckPmStart = nextWorkingDay(formatDateISO(f3.plannedFinish), workingDaysPerWeek);
  const f4 = {
    taskNo: String(taskCounter++),
    activity: 'Footing reinforcement checklist verified by Project Manager',
    plannedStart: new Date(rebarCheckPmStart),
    plannedFinish: addDays(rebarCheckPmStart, 1, workingDaysPerWeek),
    duration: 1,
    trade: 'Checklist',
    status: 'Not Started',
    remarks: '',
    phase: phase3,
    order: tasks.length + 1
  };
  tasks.push(f4);

  const shutterStart = nextWorkingDay(formatDateISO(f2.plannedFinish), workingDaysPerWeek);
  const f5 = {
    taskNo: String(taskCounter++),
    activity: 'Shuttering for isolated column footings incl. column starter',
    plannedStart: new Date(shutterStart),
    plannedFinish: addDays(shutterStart, 2, workingDaysPerWeek),
    duration: 2,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Plywood shuttering with starter',
    phase: phase3,
    order: tasks.length + 1
  };
  tasks.push(f5);

  const castStart = nextWorkingDay(formatDateISO(f5.plannedFinish), workingDaysPerWeek);
  const f6 = {
    taskNo: String(taskCounter++),
    activity: 'Footing concrete casting (M25 RCC) - isolated footings',
    plannedStart: new Date(castStart),
    plannedFinish: addDays(castStart, 2, workingDaysPerWeek),
    duration: 2,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Through RMC / site mixed',
    phase: phase3,
    order: tasks.length + 1
  };
  tasks.push(f6);

  const castCheckStart = nextWorkingDay(formatDateISO(f6.plannedFinish), workingDaysPerWeek);
  const f7 = {
    taskNo: String(taskCounter++),
    activity: 'Footing casting checklist filled by Site Engineer',
    plannedStart: new Date(castCheckStart),
    plannedFinish: addDays(castCheckStart, 1, workingDaysPerWeek),
    duration: 1,
    trade: 'Checklist',
    status: 'Not Started',
    remarks: '',
    phase: phase3,
    order: tasks.length + 1
  };
  tasks.push(f7);

  const curingStart = nextWorkingDay(formatDateISO(f6.plannedFinish), workingDaysPerWeek);
  const f8 = {
    taskNo: String(taskCounter++),
    activity: 'Curing of footing concrete (min 7 days, water curing)',
    plannedStart: new Date(curingStart),
    plannedFinish: addDays(curingStart, 7, workingDaysPerWeek),
    duration: 7,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Ponding or wet hessian cloth',
    phase: phase3,
    order: tasks.length + 1
  };
  tasks.push(f8);

  const deshutterStart = nextWorkingDay(formatDateISO(f6.plannedFinish), workingDaysPerWeek);
  const f9 = {
    taskNo: String(taskCounter++),
    activity: 'De-shuttering of footing sides',
    plannedStart: new Date(deshutterStart),
    plannedFinish: addDays(deshutterStart, 1, workingDaysPerWeek),
    duration: 1,
    trade: 'Civil',
    status: 'Not Started',
    remarks: '',
    phase: phase3,
    order: tasks.length + 1
  };
  tasks.push(f9);

  phaseFinishDate = formatDateISO(f6.plannedFinish); // Next phase can start after footing concrete is cast

  // ────────────────────────────────────────────────────────
  // BASEMENT WORKS (OPTIONAL)
  // ────────────────────────────────────────────────────────
  if (hasBasement) {
    const phaseBsmt = 'BASEMENT WORKS & RETAINING WALL';
    const bStart = nextWorkingDay(phaseFinishDate, workingDaysPerWeek);

    const b1 = {
      taskNo: String(taskCounter++),
      activity: 'Excavation for basement raft foundation & retaining wall shear key',
      plannedStart: new Date(bStart),
      plannedFinish: addDays(bStart, 4, workingDaysPerWeek),
      duration: 4,
      trade: 'Excavation',
      status: 'Not Started',
      remarks: 'Heavy machinery and dressing',
      phase: phaseBsmt,
      order: tasks.length + 1
    };
    tasks.push(b1);

    const b2Start = nextWorkingDay(formatDateISO(b1.plannedFinish), workingDaysPerWeek);
    const b2 = {
      taskNo: String(taskCounter++),
      activity: 'PCC bed laying under basement raft & retaining wall base slab',
      plannedStart: new Date(b2Start),
      plannedFinish: addDays(b2Start, 2, workingDaysPerWeek),
      duration: 2,
      trade: 'Civil',
      status: 'Not Started',
      remarks: '',
      phase: phaseBsmt,
      order: tasks.length + 1
    };
    tasks.push(b2);

    const b3Start = nextWorkingDay(formatDateISO(b2.plannedFinish), workingDaysPerWeek);
    const b3 = {
      taskNo: String(taskCounter++),
      activity: 'Raft & retaining wall base reinforcement binding',
      plannedStart: new Date(b3Start),
      plannedFinish: addDays(b3Start, 4, workingDaysPerWeek),
      duration: 4,
      trade: 'Steel',
      status: 'Not Started',
      remarks: 'As per structural design drawings',
      phase: phaseBsmt,
      order: tasks.length + 1
    };
    tasks.push(b3);

    const b4Start = nextWorkingDay(formatDateISO(b3.plannedFinish), workingDaysPerWeek);
    const b4 = {
      taskNo: String(taskCounter++),
      activity: 'Shuttering for raft foundation edges & retaining wall base starter',
      plannedStart: new Date(b4Start),
      plannedFinish: addDays(b4Start, 2, workingDaysPerWeek),
      duration: 2,
      trade: 'Civil',
      status: 'Not Started',
      remarks: '',
      phase: phaseBsmt,
      order: tasks.length + 1
    };
    tasks.push(b4);

    const b5Start = nextWorkingDay(formatDateISO(b4.plannedFinish), workingDaysPerWeek);
    const b5 = {
      taskNo: String(taskCounter++),
      activity: 'Raft foundation concrete casting (M25/M30 RCC)',
      plannedStart: new Date(b5Start),
      plannedFinish: addDays(b5Start, 2, workingDaysPerWeek),
      duration: 2,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Continuously poured with superplasticizer',
      phase: phaseBsmt,
      order: tasks.length + 1
    };
    tasks.push(b5);

    const b6Start = nextWorkingDay(formatDateISO(b5.plannedFinish), workingDaysPerWeek);
    const b6 = {
      taskNo: String(taskCounter++),
      activity: 'Retaining wall vertical reinforcement and plywood shuttering setup',
      plannedStart: new Date(b6Start),
      plannedFinish: addDays(b6Start, 4, workingDaysPerWeek),
      duration: 4,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Including water stops installation',
      phase: phaseBsmt,
      order: tasks.length + 1
    };
    tasks.push(b6);

    const b7Start = nextWorkingDay(formatDateISO(b6.plannedFinish), workingDaysPerWeek);
    const b7 = {
      taskNo: String(taskCounter++),
      activity: 'Retaining wall concrete casting (M30 RCC) in lifts',
      plannedStart: new Date(b7Start),
      plannedFinish: addDays(b7Start, 2, workingDaysPerWeek),
      duration: 2,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Thorough vibration to prevent honeycombing',
      phase: phaseBsmt,
      order: tasks.length + 1
    };
    tasks.push(b7);

    const b8Start = nextWorkingDay(formatDateISO(b7.plannedFinish), workingDaysPerWeek);
    const b8 = {
      taskNo: String(taskCounter++),
      activity: 'Curing of retaining wall & external waterproofing application',
      plannedStart: new Date(b8Start),
      plannedFinish: addDays(b8Start, 7, workingDaysPerWeek),
      duration: 7,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Appy bituminous coating & protective board',
      phase: phaseBsmt,
      order: tasks.length + 1
    };
    tasks.push(b8);

    phaseFinishDate = formatDateISO(b7.plannedFinish);
  }

  // ────────────────────────────────────────────────────────
  // STRUCTURE WORKS (FLOOR BY FLOOR LOOP)
  // ────────────────────────────────────────────────────────
  let prevFloorFinishDate = phaseFinishDate;

  for (let f = 0; f < floorsCount; f++) {
    const floorLabel = f === 0 ? 'Ground Floor' : f === 1 ? 'First Floor' : f === 2 ? 'Second Floor' : f === 3 ? 'Third Floor' : `${f}th Floor`;
    const phaseFloor = `STRUCTURE & CIVIL WORK — ${floorLabel.toUpperCase()}`;
    const flStart = nextWorkingDay(prevFloorFinishDate, workingDaysPerWeek);

    // TF1: Column reinforcement binding
    const tf1 = {
      taskNo: `${f + 1}.1`,
      activity: `${floorLabel} columns - rebar cutting, bending, binding & starter casting`,
      plannedStart: new Date(flStart),
      plannedFinish: addDays(flStart, 3, workingDaysPerWeek),
      duration: 3,
      trade: 'Steel',
      status: 'Not Started',
      remarks: 'Column starter height 50mm',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf1);

    // TF2: Column shuttering
    const tf2Start = nextWorkingDay(formatDateISO(tf1.plannedFinish), workingDaysPerWeek);
    const tf2 = {
      taskNo: `${f + 1}.2`,
      activity: `${floorLabel} columns - shuttering, vertical alignment & bracing setup`,
      plannedStart: new Date(tf2Start),
      plannedFinish: addDays(tf2Start, 2, workingDaysPerWeek),
      duration: 2,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Verify plumb line and cover blocks',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf2);

    // TF3: Column casting
    const tf3Start = nextWorkingDay(formatDateISO(tf2.plannedFinish), workingDaysPerWeek);
    const tf3 = {
      taskNo: `${f + 1}.3`,
      activity: `${floorLabel} columns - concrete casting (M25 RCC) & curing commencement`,
      plannedStart: new Date(tf3Start),
      plannedFinish: addDays(tf3Start, 1, workingDaysPerWeek),
      duration: 1,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Check pour height limits',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf3);

    // TF4: De-shuttering column & Beam/Slab shuttering (runs parallel after TF3 finishes)
    const slabShutterStart = nextWorkingDay(formatDateISO(tf3.plannedFinish), workingDaysPerWeek);
    const tf4 = {
      taskNo: `${f + 1}.4`,
      activity: `${floorLabel} columns - de-shuttering sides & curing setup`,
      plannedStart: new Date(slabShutterStart),
      plannedFinish: addDays(slabShutterStart, 1, workingDaysPerWeek),
      duration: 1,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Wet hessian wrapping around columns',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf4);

    const tf5 = {
      taskNo: `${f + 1}.5`,
      activity: `${floorLabel} roof slab & beams - shuttering, staging, scaffolding & leveling`,
      plannedStart: new Date(slabShutterStart),
      plannedFinish: addDays(slabShutterStart, 5, workingDaysPerWeek),
      duration: 5,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Use steel props & MS plates/plywood',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf5);

    // TF6: Slab rebar binding (starts 2 days after shuttering starts)
    const rebarSlabStart = nextWorkingDay(formatDateISO(addDays(slabShutterStart, 2, workingDaysPerWeek)), workingDaysPerWeek);
    const tf6 = {
      taskNo: `${f + 1}.6`,
      activity: `${floorLabel} slab & beams - reinforcement cutting, bending & binding (TMT)`,
      plannedStart: new Date(rebarSlabStart),
      plannedFinish: addDays(rebarSlabStart, 4, workingDaysPerWeek),
      duration: 4,
      trade: 'Steel',
      status: 'Not Started',
      remarks: 'As per slab design details and BBS',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf6);

    // TF7: Electrical conduit laying
    const conduitStart = nextWorkingDay(formatDateISO(addDays(rebarSlabStart, 2, workingDaysPerWeek)), workingDaysPerWeek);
    const tf7 = {
      taskNo: `${f + 1}.7`,
      activity: `${floorLabel} slab - electrical PVC conduits, fan boxes & plumbing sleeves laying`,
      plannedStart: new Date(conduitStart),
      plannedFinish: addDays(conduitStart, 2, workingDaysPerWeek),
      duration: 2,
      trade: 'Electrical',
      status: 'Not Started',
      remarks: 'Check fan box layout and sleeves placement',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf7);

    // TF8 & TF9: Checklists
    const slabCheckStart = nextWorkingDay(formatDateISO(tf6.plannedFinish), workingDaysPerWeek);
    const tf8 = {
      taskNo: `${f + 1}.8`,
      activity: `${floorLabel} slab reinforcement & conduit checklist filled by Site Engineer`,
      plannedStart: new Date(slabCheckStart),
      plannedFinish: addDays(slabCheckStart, 1, workingDaysPerWeek),
      duration: 1,
      trade: 'Checklist',
      status: 'Not Started',
      remarks: '',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf8);

    const slabCheckPmStart = nextWorkingDay(formatDateISO(tf8.plannedFinish), workingDaysPerWeek);
    const tf9 = {
      taskNo: `${f + 1}.9`,
      activity: `${floorLabel} slab reinforcement & conduit checklist verified by Project Manager`,
      plannedStart: new Date(slabCheckPmStart),
      plannedFinish: addDays(slabCheckPmStart, 1, workingDaysPerWeek),
      duration: 1,
      trade: 'Checklist',
      status: 'Not Started',
      remarks: 'Verify cover block & spacer chairs',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf9);

    // TF10: Slab concrete casting
    const slabCastStart = nextWorkingDay(formatDateISO(tf9.plannedFinish), workingDaysPerWeek);
    const tf10 = {
      taskNo: `${f + 1}.10`,
      activity: `${floorLabel} slab & beams - concrete casting (M25 RCC) & finishing`,
      plannedStart: new Date(slabCastStart),
      plannedFinish: addDays(slabCastStart, 1, workingDaysPerWeek),
      duration: 1,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Continuous pour via RMC boom placer',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf10);

    const slabCastCheckStart = nextWorkingDay(formatDateISO(tf10.plannedFinish), workingDaysPerWeek);
    const tf11 = {
      taskNo: `${f + 1}.11`,
      activity: `${floorLabel} slab casting checklist filled by Site Engineer`,
      plannedStart: new Date(slabCastCheckStart),
      plannedFinish: addDays(slabCastCheckStart, 1, workingDaysPerWeek),
      duration: 1,
      trade: 'Checklist',
      status: 'Not Started',
      remarks: '',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf11);

    const slabCuringStart = nextWorkingDay(formatDateISO(tf10.plannedFinish), workingDaysPerWeek);
    const tf12 = {
      taskNo: `${f + 1}.12`,
      activity: `${floorLabel} slab & beams - water ponding curing (min 7 days)`,
      plannedStart: new Date(slabCuringStart),
      plannedFinish: addDays(slabCuringStart, 7, workingDaysPerWeek),
      duration: 7,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Ponding with cement mortar bunds',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf12);

    const slabDeshutterStart = nextWorkingDay(formatDateISO(addDays(tf10.plannedFinish, 14, workingDaysPerWeek)), workingDaysPerWeek);
    const tf13 = {
      taskNo: `${f + 1}.13`,
      activity: `${floorLabel} slab & beams - de-shuttering & scaffolding removal`,
      plannedStart: new Date(slabDeshutterStart),
      plannedFinish: addDays(slabDeshutterStart, 2, workingDaysPerWeek),
      duration: 2,
      trade: 'Civil',
      status: 'Not Started',
      remarks: 'Minimum 14 days required for slab spans',
      phase: phaseFloor,
      order: tasks.length + 1
    };
    tasks.push(tf13);

    // Save this floor's finish date for the next floor
    prevFloorFinishDate = formatDateISO(tf10.plannedFinish);
  }

  // ────────────────────────────────────────────────────────
  // PHASE 5: ROOF & TERRACE WORKS (MUMTY, WATER TANK, ETC.)
  // ────────────────────────────────────────────────────────
  const phaseRoof = 'PHASE 4: ROOF, MUMTY & TERRACE WATERPROOFING';
  const rfStart = nextWorkingDay(prevFloorFinishDate, workingDaysPerWeek);

  const r1 = {
    taskNo: String(taskCounter++),
    activity: 'Mumty (staircase cabin) & overhead water tank - column casting & slab construction',
    plannedStart: new Date(rfStart),
    plannedFinish: addDays(rfStart, 6, workingDaysPerWeek),
    duration: 6,
    trade: 'Civil',
    status: 'Not Started',
    remarks: '',
    phase: phaseRoof,
    order: tasks.length + 1
  };
  tasks.push(r1);

  const r2Start = nextWorkingDay(formatDateISO(r1.plannedFinish), workingDaysPerWeek);
  const r2 = {
    taskNo: String(taskCounter++),
    activity: 'Terrace parapet wall brickwork (9" & 4.5" thick, height: 3\'-0")',
    plannedStart: new Date(r2Start),
    plannedFinish: addDays(r2Start, 3, workingDaysPerWeek),
    duration: 3,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Including weep holes for drainage',
    phase: phaseRoof,
    order: tasks.length + 1
  };
  tasks.push(r2);

  const r3Start = nextWorkingDay(formatDateISO(r2.plannedFinish), workingDaysPerWeek);
  const r3 = {
    taskNo: String(taskCounter++),
    activity: 'Terrace waterproofing treatment & screed concrete slope laying',
    plannedStart: new Date(r3Start),
    plannedFinish: addDays(r3Start, 6, workingDaysPerWeek),
    duration: 6,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Appy waterproofing compound and slope to gola',
    phase: phaseRoof,
    order: tasks.length + 1
  };
  tasks.push(r3);

  phaseFinishDate = formatDateISO(r3.plannedFinish);

  // ────────────────────────────────────────────────────────
  // PHASE 6: BRICKWORK, PLASTER & INTERNAL SERVICES
  // ────────────────────────────────────────────────────────
  const phaseFin = 'PHASE 5: BRICKWORK, PLASTER & INTERNAL SERVICES';
  let finStart = nextWorkingDay(phaseFinishDate, workingDaysPerWeek);

  // If there are multiple floors, brickwork starts earlier in parallel, but globally we sequence it from the top/bottom
  const p1 = {
    taskNo: String(taskCounter++),
    activity: 'External masonry brickwork (9" thick outer perimeter walls)',
    plannedStart: new Date(finStart),
    plannedFinish: addDays(finStart, 10, workingDaysPerWeek),
    duration: 10,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Using class 1 clay bricks / AAC blocks',
    phase: phaseFin,
    order: tasks.length + 1
  };
  tasks.push(p1);

  const p2Start = nextWorkingDay(formatDateISO(addDays(finStart, 4, workingDaysPerWeek)), workingDaysPerWeek);
  const p2 = {
    taskNo: String(taskCounter++),
    activity: 'Internal partition walls masonry brickwork (4.5" thick)',
    plannedStart: new Date(p2Start),
    plannedFinish: addDays(p2Start, 8, workingDaysPerWeek),
    duration: 8,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Provide horizontal reinforcement at every 4th course',
    phase: phaseFin,
    order: tasks.length + 1
  };
  tasks.push(p2);

  const servicesStart = nextWorkingDay(formatDateISO(p2.plannedFinish), workingDaysPerWeek);
  const p3 = {
    taskNo: String(taskCounter++),
    activity: 'Electrical wall chasing, PVC conduit installation & metal box fixing',
    plannedStart: new Date(servicesStart),
    plannedFinish: addDays(servicesStart, 6, workingDaysPerWeek),
    duration: 6,
    trade: 'Electrical',
    status: 'Not Started',
    remarks: 'As per electrical shop drawing',
    phase: phaseFin,
    order: tasks.length + 1
  };
  tasks.push(p3);

  const p4 = {
    taskNo: String(taskCounter++),
    activity: 'Plumbing wall chasing & internal piping installation (CPVC/UPVC lines)',
    plannedStart: new Date(servicesStart),
    plannedFinish: addDays(servicesStart, 5, workingDaysPerWeek),
    duration: 5,
    trade: 'Plumbing',
    status: 'Not Started',
    remarks: 'Pressure testing of pipes before plastering',
    phase: phaseFin,
    order: tasks.length + 1
  };
  tasks.push(p4);

  const plasterStart = nextWorkingDay(formatDateISO(p3.plannedFinish), workingDaysPerWeek);
  const p5 = {
    taskNo: String(taskCounter++),
    activity: 'Internal wall plastering (12mm thick, 1:4 cement mortar)',
    plannedStart: new Date(plasterStart),
    plannedFinish: addDays(plasterStart, 10, workingDaysPerWeek),
    duration: 10,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Chicken mesh fixing at RCC-masonry joints',
    phase: phaseFin,
    order: tasks.length + 1
  };
  tasks.push(p5);

  const extPlasterStart = nextWorkingDay(formatDateISO(p5.plannedStart), workingDaysPerWeek);
  const p6 = {
    taskNo: String(taskCounter++),
    activity: 'External wall plastering (18mm double coat, sand faced, 1:6 cement mortar)',
    plannedStart: new Date(extPlasterStart),
    plannedFinish: addDays(extPlasterStart, 12, workingDaysPerWeek),
    duration: 12,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Scaffolding/swing stage setup',
    phase: phaseFin,
    order: tasks.length + 1
  };
  tasks.push(p6);

  const wetWaterproofStart = nextWorkingDay(formatDateISO(p5.plannedFinish), workingDaysPerWeek);
  const p7 = {
    taskNo: String(taskCounter++),
    activity: 'Toilet waterproofing, floor screeding & kitchen platform granite installation',
    plannedStart: new Date(wetWaterproofStart),
    plannedFinish: addDays(wetWaterproofStart, 7, workingDaysPerWeek),
    duration: 7,
    trade: 'Civil',
    status: 'Not Started',
    remarks: 'Water pond testing for 48 hours',
    phase: phaseFin,
    order: tasks.length + 1
  };
  tasks.push(p7);

  phaseFinishDate = formatDateISO(p6.plannedFinish);

  // ────────────────────────────────────────────────────────
  // PHASE 7: HANDOVER & PROJECT CLOSURE
  // ────────────────────────────────────────────────────────
  const phaseClose = 'PHASE 6: HANDOVER & PROJECT CLOSURE';
  const closeStart = nextWorkingDay(phaseFinishDate, workingDaysPerWeek);

  const c1 = {
    taskNo: String(taskCounter++),
    activity: 'Site cleaning, debris clearance & temporary structures removal',
    plannedStart: new Date(closeStart),
    plannedFinish: addDays(closeStart, 3, workingDaysPerWeek),
    duration: 3,
    trade: 'Civil',
    status: 'Not Started',
    remarks: '',
    phase: phaseClose,
    order: tasks.length + 1
  };
  tasks.push(c1);

  const c2Start = nextWorkingDay(formatDateISO(c1.plannedFinish), workingDaysPerWeek);
  const c2 = {
    taskNo: String(taskCounter++),
    activity: 'Final QA/QC inspection, snag listing & rectifications',
    plannedStart: new Date(c2Start),
    plannedFinish: addDays(c2Start, 2, workingDaysPerWeek),
    duration: 2,
    trade: 'Checklist',
    status: 'Not Started',
    remarks: '',
    phase: phaseClose,
    order: tasks.length + 1
  };
  tasks.push(c2);

  const c3Start = nextWorkingDay(formatDateISO(c2.plannedFinish), workingDaysPerWeek);
  const c3 = {
    taskNo: String(taskCounter++),
    activity: 'Demobilization and final project handover to client',
    plannedStart: new Date(c3Start),
    plannedFinish: addDays(c3Start, 1, workingDaysPerWeek),
    duration: 1,
    trade: 'Mobilization',
    status: 'Not Started',
    remarks: 'Handover folder with certificates & drawings',
    phase: phaseClose,
    order: tasks.length + 1
  };
  tasks.push(c3);

  // Post-process to assign default structuralZone based on phase
  tasks.forEach(t => {
    if (t.phase.includes('GROUND FLOOR')) {
      t.structuralZone = 'Ground Floor';
    } else if (t.phase.includes('FIRST FLOOR')) {
      t.structuralZone = 'First Floor';
    } else if (t.phase.includes('SECOND FLOOR')) {
      t.structuralZone = 'Second Floor';
    } else if (t.phase.includes('THIRD FLOOR')) {
      t.structuralZone = 'Third Floor';
    } else if (t.phase.includes('FOURTH FLOOR')) {
      t.structuralZone = 'Fourth Floor';
    } else if (t.phase.includes('FIFTH FLOOR')) {
      t.structuralZone = 'Fifth Floor';
    } else if (t.phase.includes('BASEMENT')) {
      t.structuralZone = 'Basement';
    } else if (t.phase.includes('FOUNDATION')) {
      t.structuralZone = 'Foundation';
    } else if (t.phase.includes('EXCAVATION')) {
      t.structuralZone = 'Foundation';
    } else if (t.phase.includes('ROOF') || t.phase.includes('MUMTY') || t.phase.includes('TERRACE')) {
      t.structuralZone = 'Roof & Terrace';
    } else {
      t.structuralZone = 'General';
    }
  });

  // Prepare metadata block values matching the project inputs
  const metadata = {
    name: options.projectName || `Project Schedule`,
    clientName: clientName,
    architectName: architectName,
    location: location,
    scopeOfWork: scopeOfWork,
    buildingType: options.buildingType || `G+${floorsCount - 1} Building`,
    startDate: new Date(startStr),
    targetHandover: c3.plannedFinish
  };

  return { tasks, metadata };
}
