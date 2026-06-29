/**
 * Generate a unique share slug for a project.
 * Format: slugified-project-name-xxxx (4 random alphanumeric chars)
 */
export function generateSlug(projectName) {
  const base = projectName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30)
    .replace(/-$/, '');

  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${base}-${suffix}`;
}

/**
 * Format a date for display. Accepts Date, Firestore Timestamp, or ISO string.
 */
export function formatDate(d) {
  if (!d) return '—';
  let date;
  if (d?.toDate) date = d.toDate();
  else if (d instanceof Date) date = d;
  else date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format a date as YYYY-MM-DD for input fields.
 */
export function toInputDate(d) {
  if (!d) return '';
  let date;
  if (d?.toDate) date = d.toDate();
  else if (d instanceof Date) date = d;
  else date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

/**
 * Compute project stats from tasks array.
 */
export function computeProjectStats(tasks) {
  if (!tasks || tasks.length === 0) {
    return { total: 0, completed: 0, delayed: 0, inProgress: 0, notStarted: 0, percentComplete: 0 };
  }
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const delayed = tasks.filter(t => t.status === 'Delayed').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const notStarted = tasks.filter(t => t.status === 'Not Started').length;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, delayed, inProgress, notStarted, percentComplete };
}

/**
 * Get unique phases from tasks.
 */
export function getPhases(tasks) {
  const phases = new Set();
  tasks.forEach(t => { if (t.phase) phases.add(t.phase); });
  return Array.from(phases);
}

/**
 * Get current active phase (phase of the first in-progress task).
 */
export function getActivePhase(tasks) {
  const inProgress = tasks.find(t => t.status === 'In Progress');
  if (inProgress) return inProgress.phase || 'General';
  const notStarted = tasks.find(t => t.status === 'Not Started');
  if (notStarted) return notStarted.phase || 'General';
  return 'All Complete';
}

/**
 * Get the current focus task.
 */
export function getFocusTask(tasks) {
  return tasks.find(t => t.status === 'In Progress') ||
         tasks.find(t => t.status === 'Not Started') ||
         null;
}

/**
 * Get status badge CSS class.
 */
export function statusClass(status) {
  switch (status) {
    case 'Not Started': return 'not-started';
    case 'In Progress': return 'in-progress';
    case 'Completed': return 'completed';
    case 'Delayed': return 'delayed';
    default: return 'not-started';
  }
}
