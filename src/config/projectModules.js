/**
 * Single source of truth for all project modules.
 * Used by Sidebar, Mobile Nav, Dashboard Hub, Command Palette & page headers.
 */

export const MODULE_CATEGORIES = [
  {
    id: 'overview',
    label: 'Overview',
    icon: '📊',
    description: 'Project snapshot & visual progress',
    modules: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', description: 'KPIs, health score & activity feed' },
      { id: 'visual', label: 'Building Hub', icon: '🏢', description: 'Floor-by-floor visual tracker', highlight: true },
    ],
  },
  {
    id: 'planning',
    label: 'Planning & Schedule',
    icon: '📋',
    description: 'Tasks, timelines & drawings',
    modules: [
      { id: 'schedule', label: 'Schedule', icon: '📋', description: 'Phase-wise task list & updates' },
      { id: 'timeline', label: 'Timeline', icon: '📅', description: 'Gantt chart & dependencies' },
      { id: 'drawings', label: 'Drawings', icon: '📐', description: 'Drawing register & revisions' },
    ],
  },
  {
    id: 'site-records',
    label: 'Site Records',
    icon: '📝',
    description: 'Daily documentation on site',
    modules: [
      { id: 'photos', label: 'Photo Log', icon: '📸', description: 'Progress photos by task & date' },
      { id: 'sitelog', label: 'Daily Log', icon: '📝', description: 'Shift reports & site conditions' },
      { id: 'curing', label: 'Curing Log', icon: '💧', description: 'Concrete curing records' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: '💰',
    description: 'Costs & payments',
    modules: [
      { id: 'expenses', label: 'Expenses', icon: '💰', description: 'Track spending vs budget' },
      { id: 'payments', label: 'Payments', icon: '💳', description: 'Client & vendor payments' },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: '📦',
    description: 'Materials & workforce',
    modules: [
      { id: 'materials', label: 'Materials', icon: '📦', description: 'Inventory, received & consumed' },
      { id: 'labour', label: 'Labour', icon: '👷', description: 'Workforce headcount & costs' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality & Safety',
    icon: '✅',
    description: 'Inspections & issue tracking',
    modules: [
      { id: 'checklists', label: 'Quality', icon: '✅', description: 'Quality checklists & sign-offs' },
      { id: 'issues', label: 'Issues', icon: '🐛', description: 'Snags, defects & resolutions' },
    ],
  },
  {
    id: 'team',
    label: 'Project Team',
    icon: '👥',
    description: 'People & meetings',
    modules: [
      { id: 'contacts', label: 'Contacts', icon: '👥', description: 'Architects, vendors & team' },
      { id: 'meetings', label: 'Meetings', icon: '🤝', description: 'Minutes, decisions & actions' },
    ],
  },
];

export const ALL_MODULES = MODULE_CATEGORIES.flatMap((c) => c.modules);

export const CORE_MOBILE_TAB_IDS = ['dashboard', 'visual', 'schedule', 'photos'];

export function getModuleById(id) {
  return ALL_MODULES.find((m) => m.id === id) || null;
}

export function getCategoryForModule(id) {
  return MODULE_CATEGORIES.find((c) => c.modules.some((m) => m.id === id)) || null;
}

export function getCoreMobileTabs() {
  return CORE_MOBILE_TAB_IDS.map((id) => getModuleById(id)).filter(Boolean);
}

export function getSecondaryMobileModules() {
  const core = new Set(CORE_MOBILE_TAB_IDS);
  return ALL_MODULES.filter((m) => !core.has(m.id));
}
