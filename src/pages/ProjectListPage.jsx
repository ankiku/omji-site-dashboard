import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../components/ConfirmDialog';
import ProgressBar from '../components/ProgressBar';
import ProjectAnalytics from '../components/ProjectAnalytics';
import {
  getAllProjects, getUserProjects, subscribeToTasks,
  exportBackupData, importBackupData
} from '../services/localStorageService';
import { computeProjectStats, formatDate } from '../utils/helpers';

export default function ProjectListPage() {
  const { isAdmin, userProfile } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [projects, setProjects] = useState([]);
  const [projectStats, setProjectStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('osr_view_mode') || 'grid');
  const [sortBy, setSortBy] = useState('recent');

  const handleExport = () => {
    try {
      const data = exportBackupData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omji_site_register_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup exported successfully');
    } catch (err) {
      toast.error('Failed to export: ' + err.message);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const ok = await confirm({ title: 'Import Data', message: 'Importing will overwrite existing local data. Continue?', confirmText: 'Import', danger: true });
        if (ok) {
          await importBackupData(json);
          toast.success('Data imported! Refreshing...');
          setTimeout(() => window.location.reload(), 800);
        }
      } catch (err) {
        toast.error('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let list = isAdmin ? await getAllProjects() : await getUserProjects(userProfile?.assignedProjectIds || []);
        if (!cancelled) setProjects(list);
      } catch (err) { console.error('Error loading projects:', err); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [isAdmin, userProfile]);

  useEffect(() => {
    const unsubs = projects.map(p =>
      subscribeToTasks(p.id, (tasks) => {
        setProjectStats(prev => ({ ...prev, [p.id]: computeProjectStats(tasks) }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [projects]);

  useEffect(() => { localStorage.setItem('osr_view_mode', viewMode); }, [viewMode]);

  // Filter & sort
  const filtered = projects.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(p.name || '').toLowerCase().includes(q) && !(p.clientName || '').toLowerCase().includes(q) && !(p.location || '').toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== 'all') {
      const s = projectStats[p.id] || {};
      if (statusFilter === 'active' && s.percentComplete === 100) return false;
      if (statusFilter === 'completed' && s.percentComplete !== 100) return false;
      if (statusFilter === 'delayed' && (s.delayed || 0) === 0) return false;
    }
    return true;
  }).sort((a, b) => {
    const sa = projectStats[a.id] || {};
    const sb = projectStats[b.id] || {};
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'progress') return (sb.percentComplete || 0) - (sa.percentComplete || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  // Aggregate stats
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => (projectStats[p.id]?.percentComplete || 0) < 100).length;
  const delayedProjects = projects.filter(p => (projectStats[p.id]?.delayed || 0) > 0).length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <>
      {dialog}
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="welcome-text">
          <h1>{greeting()}, {userProfile?.name || 'Admin'} 👋</h1>
          <p className="welcome-sub">You have <strong>{totalProjects}</strong> projects · <strong>{activeProjects}</strong> active · <strong>{delayedProjects}</strong> with delays</p>
        </div>
        {isAdmin && (
          <div className="welcome-actions">
            <button onClick={handleExport} className="btn btn-outline btn-sm" id="export-backup-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            <Link to="/projects/new" className="btn btn-primary btn-sm">+ New Project</Link>
          </div>
        )}
      </div>

      {/* Analytics Dashboard */}
      {projects.length > 0 && (
        <ProjectAnalytics projects={projects} projectStats={projectStats} />
      )}

      {/* Search & Filters */}
      <div className="projects-toolbar">
        <div className="projects-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="projects-search-input" placeholder="Search projects..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="projects-filters">
          <div className="chip-row" style={{ padding: 0, margin: 0 }}>
            {[['all', 'All'], ['active', 'Active'], ['completed', 'Done'], ['delayed', 'Delayed']].map(([val, lbl]) => (
              <button key={val} className={`chip ${statusFilter === val ? 'active' : ''}`} onClick={() => setStatusFilter(val)}>{lbl}</button>
            ))}
          </div>
          <select className="form-select filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="progress">Progress</option>
          </select>
          <div className="view-toggle">
            <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="List view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p>{projects.length === 0 ? (isAdmin ? 'No projects yet. Create your first project.' : 'No projects assigned.') : 'No projects match your filters.'}</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'projects-grid' : 'projects-list'}>
          {filtered.map((project, index) => {
            const stats = projectStats[project.id] || { percentComplete: 0, delayed: 0, total: 0, completed: 0, inProgress: 0 };
            return (
              <Link key={project.id} to={`/projects/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className={`project-card ${viewMode} color-${index % 5}`}>
                  {/* Progress ring for grid view */}
                  {viewMode === 'grid' && (
                    <div className="project-card-progress-ring">
                      <svg width="52" height="52" viewBox="0 0 52 52">
                        <circle cx="26" cy="26" r="22" fill="none" stroke="var(--hairline)" strokeWidth="4" />
                        <circle cx="26" cy="26" r="22" fill="none" stroke={stats.percentComplete === 100 ? 'var(--green)' : stats.delayed > 0 ? 'var(--rust)' : 'var(--gold)'} strokeWidth="4" strokeLinecap="round"
                          strokeDasharray={`${(stats.percentComplete / 100) * 138.2} 138.2`}
                          transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                      </svg>
                      <span className="progress-ring-text">{stats.percentComplete}%</span>
                    </div>
                  )}
                  <div className="project-card-info">
                    <h3>{project.name}</h3>
                    <span className="project-card-meta">{project.clientName} · {project.location}</span>
                    {viewMode === 'list' && (
                      <div style={{ marginTop: 8, maxWidth: 300 }}>
                        <ProgressBar percent={stats.percentComplete} />
                      </div>
                    )}
                  </div>
                  <div className="project-card-right">
                    <span className="project-card-date" style={{ fontSize: '0.75rem' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                      {project.startDate ? formatDate(project.startDate) : 'TBD'} — {project.targetHandover ? formatDate(project.targetHandover) : 'TBD'}
                    </span>
                    {stats.delayed > 0 && <div className="stamp stamp-warn" style={{ fontSize: '0.58rem', padding: '3px 8px', transform: 'none' }}>{stats.delayed} Flagged</div>}
                    {viewMode === 'grid' && (
                      <div className="project-card-stats">
                        <span>{stats.completed}/{stats.total} done</span>
                      </div>
                    )}
                    {viewMode === 'list' && (
                      <span className="mono" style={{ fontSize: '0.78rem', fontWeight: 600 }}>{stats.percentComplete}%</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
