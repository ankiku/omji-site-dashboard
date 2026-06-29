import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';
import TaskCard from '../components/TaskCard';
import Lightbox from '../components/Lightbox';
import ScheduleTab from '../components/ScheduleTab';
import ReportExporter from '../components/ReportExporter';
import DonutChart from '../components/DonutChart';
import GanttTimeline from '../components/GanttTimeline';
import ExpenseTracker from '../components/ExpenseTracker';
import PhotoLogTab from '../components/PhotoLogTab';
import DailySiteLog from '../components/DailySiteLog';
import MaterialTracker from '../components/MaterialTracker';
import LabourTracker from '../components/LabourTracker';
import PaymentTracker from '../components/PaymentTracker';
import DrawingRegister from '../components/DrawingRegister';
import QualityChecklist from '../components/QualityChecklist';
import IssueTracker from '../components/IssueTracker';
import ContactsDirectory from '../components/ContactsDirectory';
import MeetingMinutes from '../components/MeetingMinutes';
import CuringLog from '../components/CuringLog';
import VisualBuildingHub from '../components/VisualBuildingHub';
import ModuleHub from '../components/ModuleHub';
import ModulePageHeader from '../components/ModulePageHeader';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  subscribeToProject, subscribeToTasks, subscribeToPhotos, subscribeToExpenses,
  updateProject, deleteProject, subscribeToContacts, addContact, updateContact, deleteContact,
  subscribeToMeetings, addMeeting, updateMeeting, deleteMeeting, addPhotoRecord, subscribeToDrawings,
  subscribeToIssues, subscribeToMaterials, subscribeToSiteLogs
} from '../services/localStorageService';
import {
  formatDate, computeProjectStats, getPhases,
  getActivePhase, getFocusTask, toInputDate
} from '../utils/helpers';

export default function ProjectViewPage({ projectId: propProjectId, activeTab = 'dashboard', setActiveTab, setProjectName }) {
  const { projectId: paramProjectId } = useParams();
  const projectId = propProjectId || paramProjectId;
  const navigate = useNavigate();
  const { canEditProject, isAdmin } = useAuth();
  const toast = useToast();
  const canEdit = canEditProject(projectId);
  const { confirm, dialog } = useConfirmDialog();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [issues, setIssues] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [siteLogs, setSiteLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [showProjectEdit, setShowProjectEdit] = useState(false);

  useEffect(() => {
    const unsub1 = subscribeToProject(projectId, (p) => {
      setProject(p);
      if (p) {
        if (setProjectName) setProjectName(p.name);
        document.title = `Omji Construction : ${p.name}`;
      }
      setLoading(false);
    });
    const unsub2 = subscribeToTasks(projectId, setTasks);
    const unsub3 = subscribeToPhotos(projectId, setPhotos);
    const unsub4 = subscribeToExpenses(projectId, setExpenses);
    const unsub5 = subscribeToContacts(projectId, setContacts);
    const unsub6 = subscribeToMeetings(projectId, setMeetings);
    const unsub7 = subscribeToDrawings(projectId, setDrawings);
    const unsub8 = subscribeToIssues(projectId, setIssues);
    const unsub9 = subscribeToMaterials(projectId, setMaterials);
    const unsub10 = subscribeToSiteLogs(projectId, setSiteLogs);
    return () => {
      unsub1(); unsub2(); unsub3(); unsub4();
      unsub5(); unsub6(); unsub7(); unsub8();
      unsub9(); unsub10();
    };
  }, [projectId, setProjectName]);

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!project) return <div className="container page"><h2>Project not found</h2></div>;

  const stats = computeProjectStats(tasks);
  const phases = getPhases(tasks);
  const activePhase = getActivePhase(tasks);
  const focusTask = getFocusTask(tasks);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Days remaining
  const daysRemaining = project.targetHandover ? Math.max(0, Math.ceil((new Date(project.targetHandover) - new Date()) / 86400000)) : null;

  // Upcoming deadlines (tasks with plannedFinish in next 7 days)
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86400000);
  const upcoming = tasks.filter(t => {
    if (t.status === 'Completed') return false;
    const fin = t.plannedFinish ? new Date(t.plannedFinish) : null;
    return fin && fin >= now && fin <= weekFromNow;
  }).slice(0, 5);

  // Recent activity (from tasks, expenses, photos sorted by update time)
  const recentActivity = [
    ...tasks.map(t => ({ type: 'task', label: t.activity, sub: t.status, time: t.updatedAt, icon: '📋' })),
    ...expenses.slice(0, 5).map(e => ({ type: 'expense', label: e.description || e.category, sub: `₹${Number(e.amount || 0).toLocaleString('en-IN')}`, time: e.createdAt, icon: '💰' })),
    ...photos.slice(0, 5).map(p => ({ type: 'photo', label: 'Photo uploaded', sub: '', time: p.createdAt, icon: '📸' })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

  const handleDeleteProject = async () => {
    const ok = await confirm({ title: 'Delete Project', message: `Delete "${project.name}"? All data will be permanently removed.`, confirmText: 'Yes, Delete', danger: true });
    if (ok) { await deleteProject(projectId); toast.success('Project deleted'); navigate('/'); }
  };

  const shareUrl = `/p/${project.slug}`;

  return (
    <>
      {dialog}
      {/* Project header */}
      <div className="project-header">
        <div className="project-header-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-md)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0 }}>{project.name}</h1>
              {stats.delayed > 0 ? (
                <div className="stamp stamp-warn">{stats.delayed} Flagged</div>
              ) : (
                <div className="stamp stamp-ok">On Schedule</div>
              )}
            </div>
            <div className="project-meta" style={{ marginTop: 'var(--sp-md)' }}>
              <div className="project-meta-item"><span className="label">Client</span>{project.clientName || '—'}</div>
              <div className="project-meta-item"><span className="label">Architect</span>{project.architectName || '—'}</div>
              <div className="project-meta-item"><span className="label">Location</span>{project.location || '—'}</div>
              <div className="project-meta-item"><span className="label">Start</span>{formatDate(project.startDate)}</div>
              <div className="project-meta-item"><span className="label">Handover</span>{formatDate(project.targetHandover)}</div>
            </div>
          </div>
          <div className="project-actions-col project-actions-mobile">
            <ReportExporter project={project} tasks={tasks} photos={photos} stats={stats} />
            {canEdit && (
              <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginTop: 'var(--sp-sm)' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setShowProjectEdit(true)} style={{ flex: 1, gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                {isAdmin && (
                  <button className="btn btn-outline btn-sm" onClick={handleDeleteProject} style={{ color: 'var(--rust)', borderColor: 'var(--rust)', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Delete
                  </button>
                )}
              </div>
            )}
            <Link to={shareUrl} target="_blank" className="share-link-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Public Link ↗
            </Link>
          </div>
        </div>
        {project.scopeOfWork && (
          <p style={{ marginTop: 'var(--sp-md)', fontSize: '0.85rem', color: 'var(--concrete)' }}>
            {project.scopeOfWork}
          </p>
        )}
      </div>

      {/* Tab content */}
      <ModulePageHeader activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="project-tab-content" style={{ paddingTop: activeTab === 'dashboard' ? 'var(--sp-md)' : 0 }}>
        {activeTab === 'dashboard' && (
          <DashboardTab
            stats={stats} phases={phases} tasks={tasks}
            activePhase={activePhase} focusTask={focusTask}
            photos={photos} expenses={expenses} totalExpenses={totalExpenses}
            daysRemaining={daysRemaining} upcoming={upcoming}
            recentActivity={recentActivity} project={project}
            setPhaseFilter={setPhaseFilter} setActiveTab={setActiveTab}
            canEdit={canEdit} projectId={projectId}
            issues={issues} materials={materials} siteLogs={siteLogs}
            activeTab={activeTab}
          />
        )}
        {activeTab === 'visual' && (
          <VisualBuildingHub
            tasks={tasks}
            drawings={drawings}
            projectId={projectId}
            project={project}
            onPhotoClick={(p, i) => setLightbox({ photos: p, index: i })}
          />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab tasks={tasks} phases={phases} phaseFilter={phaseFilter}
            setPhaseFilter={setPhaseFilter} setActiveTab={setActiveTab} projectId={projectId} canEdit={canEdit}
            onPhotoClick={(p, i) => setLightbox({ photos: p, index: i })} />
        )}
        {activeTab === 'timeline' && <GanttTimeline tasks={tasks} phases={phases} />}
        {activeTab === 'photos' && <PhotoLogTab photos={photos} tasks={tasks} projectId={projectId} canEdit={canEdit} onPhotoClick={(p, i) => setLightbox({ photos: p, index: i })} />}
        {activeTab === 'curing' && <CuringLog projectId={projectId} canEdit={canEdit} project={project} onPhotoClick={(p, i) => setLightbox({ photos: p, index: i })} />}
        {activeTab === 'expenses' && <ExpenseTracker projectId={projectId} canEdit={canEdit} project={project} />}
        {activeTab === 'sitelog' && <DailySiteLog projectId={projectId} canEdit={canEdit} />}
        {activeTab === 'materials' && <MaterialTracker projectId={projectId} canEdit={canEdit} />}
        {activeTab === 'labour' && <LabourTracker projectId={projectId} canEdit={canEdit} />}
        {activeTab === 'payments' && <PaymentTracker projectId={projectId} canEdit={canEdit} />}
        {activeTab === 'drawings' && <DrawingRegister projectId={projectId} canEdit={canEdit} project={project} />}
        {activeTab === 'checklists' && <QualityChecklist projectId={projectId} canEdit={canEdit} />}
        {activeTab === 'issues' && <IssueTracker projectId={projectId} canEdit={canEdit} />}
        {activeTab === 'contacts' && (
          <ContactsDirectory projectId={projectId} canEdit={canEdit}
            contacts={contacts} addContact={addContact} updateContact={updateContact} deleteContact={deleteContact} />
        )}
        {activeTab === 'meetings' && (
          <MeetingMinutes projectId={projectId} canEdit={canEdit}
            meetings={meetings} addMeeting={addMeeting} updateMeeting={updateMeeting} deleteMeeting={deleteMeeting} />
        )}
      </div>

      {lightbox && <Lightbox photos={lightbox.photos} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}
      {showProjectEdit && <ProjectEditModal project={project} projectId={projectId} onClose={() => setShowProjectEdit(false)} />}
    </>
  );
}

/* ─── Enhanced Dashboard Tab ─── */
function DashboardTab({ stats, phases, tasks, activePhase, focusTask, photos, expenses, totalExpenses, daysRemaining, upcoming, recentActivity, project, setPhaseFilter, setActiveTab, canEdit, projectId, issues = [], materials = [], siteLogs = [], activeTab }) {
  const fmtAmount = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtTimeAgo = (t) => {
    if (!t) return '';
    const diff = Date.now() - new Date(t).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <>
      {/* Hero KPI Row */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-green">
          <div className="kpi-icon-wrap"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <div className="kpi-value">{stats.percentComplete}%</div>
          <div className="kpi-label">Complete</div>
          <div className="kpi-sub">{stats.completed} of {stats.total} tasks</div>
        </div>
        <div className="kpi-card kpi-amber">
          <div className="kpi-icon-wrap"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div className="kpi-value">{stats.inProgress}</div>
          <div className="kpi-label">In Progress</div>
          <div className="kpi-sub">{stats.delayed} delayed</div>
        </div>
        <div className="kpi-card kpi-gold">
          <div className="kpi-icon-wrap"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div className="kpi-value">{fmtAmount(totalExpenses)}</div>
          <div className="kpi-label">Total Spent</div>
          <div className="kpi-sub">{expenses.length} entries</div>
        </div>
        <div className="kpi-card kpi-blue">
          <div className="kpi-icon-wrap"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
          <div className="kpi-value">{daysRemaining != null ? daysRemaining : '—'}</div>
          <div className="kpi-label">Days Left</div>
          <div className="kpi-sub">Target: {formatDate(project.targetHandover)}</div>
        </div>
      </div>

      {/* Organized module launcher */}
      <ModuleHub activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Budget vs Actual & Health scorecard */}
      <div className="dashboard-health-row dashboard-health-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
        {/* Budget Control */}
        <div className="section card-premium" style={{ margin: 0, padding: 'var(--sp-md)' }}>
          <div className="section-header" style={{ marginBottom: 12 }}><h2 className="section-title" style={{ fontSize: '0.85rem' }}>💰 Budget & Cost Control</h2></div>
          {project.budget ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem' }}>
                <span>Budget: <strong>{fmtAmount(project.budget)}</strong></span>
                <span>Spent: <strong style={{ color: totalExpenses > project.budget ? 'var(--rust)' : 'var(--ink)' }}>{fmtAmount(totalExpenses)}</strong></span>
              </div>
              <div style={{ height: 10, background: 'var(--hairline)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((totalExpenses / project.budget) * 100, 100)}%`,
                  background: totalExpenses > project.budget ? 'var(--grad-rust)' : totalExpenses > project.budget * 0.9 ? 'var(--grad-rust)' : 'var(--grad-green)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.6s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--concrete)' }}>
                <span>{Math.round((totalExpenses / project.budget) * 100)}% Depleted</span>
                <span>Remaining: <strong>{fmtAmount(Math.max(0, project.budget - totalExpenses))}</strong></span>
              </div>
              {totalExpenses > project.budget * 0.9 && (
                <div className="alert-banner alert-warn" style={{ marginTop: 12, padding: 8, fontSize: '0.75rem', marginBottom: 0 }}>
                  ⚠️ <strong>Budget Alert:</strong> Project is at {Math.round((totalExpenses / project.budget) * 100)}% of its allocated budget.
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '12px 0' }}>
              <p style={{ fontSize: '0.78rem' }}>No budget defined. Edit project to set a budget.</p>
            </div>
          )}
        </div>

        {/* Project Health Scorecard */}
        <div className="section card-premium" style={{ margin: 0, padding: 'var(--sp-md)' }}>
          <div className="section-header" style={{ marginBottom: 12 }}><h2 className="section-title" style={{ fontSize: '0.85rem' }}>🛡️ Project Health & Quality</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)' }}>
            <div className="health-stat-box" style={{ background: 'var(--paper-2)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--concrete)', textTransform: 'uppercase', fontWeight: 600 }}>Snags & Defects</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4, color: issues.filter(i => i.status === 'Open' || i.status === 'In Progress').length > 0 ? 'var(--rust)' : 'var(--green)' }}>
                {issues.filter(i => i.status === 'Open' || i.status === 'In Progress').length} Active
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--concrete)', marginTop: 2 }}>{issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length} resolved</div>
            </div>
            <div className="health-stat-box" style={{ background: 'var(--paper-2)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--concrete)', textTransform: 'uppercase', fontWeight: 600 }}>Safety Record</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4, color: siteLogs.some(l => l.safetyIncident) ? 'var(--rust)' : 'var(--green)' }}>
                {siteLogs.some(l => l.safetyIncident) ? 'Incident Logged' : '100% Safe'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--concrete)', marginTop: 2 }}>
                {siteLogs.length} shifts reported
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Materials & Weather Row */}
      <div className="dashboard-health-row dashboard-health-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
        {/* Material Inventory Status */}
        <div className="section card-premium" style={{ margin: 0, padding: 'var(--sp-md)' }}>
          <div className="section-header" style={{ marginBottom: 12 }}><h2 className="section-title" style={{ fontSize: '0.85rem' }}>📦 Critical Materials Inventory</h2></div>
          {materials.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                const stockMap = {};
                materials.forEach(m => {
                  const key = `${m.name}|${m.unit}`;
                  if (!stockMap[key]) stockMap[key] = { name: m.name, unit: m.unit, received: 0, consumed: 0 };
                  stockMap[key].received += (m.received || 0);
                  stockMap[key].consumed += (m.consumed || 0);
                });
                const stockItems = Object.values(stockMap).slice(0, 3);
                return stockItems.map((s, idx) => {
                  const bal = s.received - s.consumed;
                  const isLow = bal < s.received * 0.2 && s.received > 0;
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px solid var(--hairline)', paddingBottom: 6 }}>
                      <span><strong>{s.name}</strong></span>
                      <span style={{ color: isLow ? 'var(--rust)' : 'var(--green)', fontWeight: 700 }}>
                        {bal.toFixed(1)} {s.unit} {isLow ? '(Low)' : ''}
                      </span>
                    </div>
                  );
                });
              })()}
              <button className="btn btn-outline btn-sm" onClick={() => setActiveTab('materials')} style={{ marginTop: 4, width: '100%', fontSize: '0.72rem', padding: '4px' }}>View Full Inventory</button>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '12px 0' }}>
              <p style={{ fontSize: '0.78rem' }}>No materials logged yet.</p>
            </div>
          )}
        </div>

        {/* Weather & Site Status widget */}
        <div className="section card-premium" style={{ margin: 0, padding: 'var(--sp-md)' }}>
          <div className="section-header" style={{ marginBottom: 12 }}><h2 className="section-title" style={{ fontSize: '0.85rem' }}>☀️ Site Environmental Conditions</h2></div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'center' }}>
            <div style={{ fontSize: '2.5rem' }}>☀️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>38°C · Jaipur Sunny</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--concrete)', marginTop: 2 }}>Humidity: 45% · Wind: 12 km/h</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600, marginTop: 4 }}>✓ Suitable for concrete casting and outdoor works</div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Row */}
      <div className="dashboard-analytics">
        <div className="analytics-stats-side">
          {/* Focus card */}
          {focusTask && (
            <div className="focus-card" style={{ marginBottom: 'var(--sp-lg)' }}>
              <h3>{focusTask.activity}</h3>
              <p className="mono" style={{ marginTop: 8 }}>
                Task {focusTask.taskNo} · {focusTask.phase} · <StatusBadge status={focusTask.status} />
              </p>
              {focusTask.trade && <p className="mono" style={{ marginTop: 4 }}>Trade: {focusTask.trade}</p>}
            </div>
          )}

          {/* Quick Actions */}
          {canEdit && (
            <div className="quick-actions-row">
              <button className="quick-action-btn" onClick={() => setActiveTab('schedule')}><span>📋</span> Schedule</button>
              <button className="quick-action-btn" onClick={() => setActiveTab('expenses')}><span>💰</span> Expense</button>
              <button className="quick-action-btn" onClick={() => setActiveTab('sitelog')}><span>📝</span> Site Log</button>
              <button className="quick-action-btn" onClick={() => setActiveTab('photos')}><span>📸</span> Photos</button>
            </div>
          )}
        </div>
        <div className="analytics-chart-side">
          <DonutChart tasks={tasks} size={190} />
        </div>
      </div>

      {/* Two column: Upcoming + Activity */}
      <div className="dashboard-two-col">
        {/* Upcoming Deadlines */}
        <div className="section">
          <div className="section-header"><h2 className="section-title">⏰ Upcoming Deadlines</h2></div>
          {upcoming.length === 0 ? (
            <p className="mono" style={{ fontSize: '0.82rem', color: 'var(--concrete)' }}>No tasks due in the next 7 days.</p>
          ) : (
            <div className="upcoming-list">
              {upcoming.map(t => (
                <div key={t.id} className="upcoming-item" onClick={() => setActiveTab('schedule')}>
                  <div className={`task-dot ${t.status === 'In Progress' ? 'in-progress' : t.status === 'Delayed' ? 'delayed' : 'not-started'}`} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.activity}</div>
                    <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--concrete)' }}>Due: {formatDate(t.plannedFinish)}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="section">
          <div className="section-header"><h2 className="section-title">📋 Recent Activity</h2></div>
          {recentActivity.length === 0 ? (
            <p className="mono" style={{ fontSize: '0.82rem', color: 'var(--concrete)' }}>No recent activity.</p>
          ) : (
            <div className="activity-feed">
              {recentActivity.map((a, i) => (
                <div key={i} className="activity-item">
                  <span className="activity-icon">{a.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="activity-label">{a.label}</div>
                    {a.sub && <div className="activity-sub">{a.sub}</div>}
                  </div>
                  <span className="activity-time">{fmtTimeAgo(a.time)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Phase progress */}
      <div className="section">
        <div className="section-header"><h2 className="section-title">Phase Progress</h2></div>
        <div className="phase-progress-list">
          {phases.map(phase => {
            const phaseTasks = tasks.filter(t => t.phase === phase);
            const phaseStats = computeProjectStats(phaseTasks);
            return (
              <div key={phase} className="phase-progress-item"
                onClick={() => { setPhaseFilter(phase); setActiveTab('schedule'); }}>
                <div className="phase-progress-header">
                  <span className="phase-progress-name">{phase}</span>
                  <span className="phase-progress-pct">{phaseStats.percentComplete}%</span>
                </div>
                <ProgressBar percent={phaseStats.percentComplete} />
                <div className="mono" style={{ marginTop: 6, fontSize: '0.7rem', color: 'var(--concrete)' }}>
                  {phaseStats.completed}/{phaseStats.total} tasks · {phaseStats.delayed} delayed
                </div>
              </div>
            );
          })}
          {phases.length === 0 && <div className="empty-state"><p>No tasks added yet.</p></div>}
        </div>
      </div>
    </>
  );
}

/* ─── Photo Log Tab ─── */


/* ─── Project Edit Modal ─── */
function ProjectEditModal({ project, projectId, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: project.name || '', clientName: project.clientName || '',
    architectName: project.architectName || '', location: project.location || '',
    scopeOfWork: project.scopeOfWork || '', budget: project.budget || '',
    startDate: toInputDate(project.startDate), targetHandover: toInputDate(project.targetHandover),
    floorsCount: project.floorsCount || 1,
    hasBasement: project.hasBasement || false,
    cameraUrls: (
      project.cameraUrls && project.cameraUrls.length > 0
        ? [...project.cameraUrls, '', '', '', ''].slice(0, 4)
        : ['', '', '', '']
    ),
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProject(projectId, {
        ...form,
        budget: form.budget ? parseFloat(form.budget) : null,
        startDate: form.startDate ? new Date(form.startDate) : null,
        targetHandover: form.targetHandover ? new Date(form.targetHandover) : null,
        floorsCount: parseInt(form.floorsCount || 1, 10),
        hasBasement: !!form.hasBasement,
        cameraUrls: (form.cameraUrls || []).filter(u => u.trim() !== ''),
      });
      toast.success('Project updated');
      onClose();
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Edit Project</h3><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSave}>
          <div className="form-group"><label>Project Name</label><input className="form-input" name="name" value={form.name} onChange={handleChange} required /></div>
          <div className="form-grid-2">
            <div className="form-group"><label>Client</label><input className="form-input" name="clientName" value={form.clientName} onChange={handleChange} /></div>
            <div className="form-group"><label>Architect</label><input className="form-input" name="architectName" value={form.architectName} onChange={handleChange} /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label>Location</label><input className="form-input" name="location" value={form.location} onChange={handleChange} /></div>
            <div className="form-group"><label>Project Budget (₹)</label><input className="form-input" name="budget" type="number" value={form.budget} onChange={handleChange} placeholder="e.g. 5000000" /></div>
          </div>
          <div className="form-group"><label>Scope of Work</label><textarea className="form-textarea" name="scopeOfWork" value={form.scopeOfWork} onChange={handleChange} /></div>
          <div className="form-grid-2">
            <div className="form-group"><label>Start Date</label><input className="form-input" type="date" name="startDate" value={form.startDate} onChange={handleChange} /></div>
            <div className="form-group"><label>Target Handover</label><input className="form-input" type="date" name="targetHandover" value={form.targetHandover} onChange={handleChange} /></div>
          </div>
          <div className="form-group">
            <label>Number of Floor Levels *</label>
            <select name="floorsCount" className="form-select" value={form.floorsCount} onChange={handleChange}>
              <option value={1}>1 Floor (Ground Floor)</option>
              <option value={2}>2 Floors (Ground + 1st Floor)</option>
              <option value={3}>3 Floors (Ground + 1st + 2nd Floor)</option>
              <option value={4}>4 Floors (Ground + 1st + 2nd + 3rd Floor)</option>
              <option value={5}>5 Floors (Ground + 1st + 2nd + 3rd + 4th Floor)</option>
              <option value={6}>6 Floors (Ground + 1st + 2nd + 3rd + 4th + 5th Floor)</option>
              <option value={7}>7 Floors (Ground + 1st + 2nd + 3rd + 4th + 5th + 6th Floor)</option>
              <option value={8}>8 Floors (Ground + 1st + 2nd + 3rd + 4th + 5th + 6th + 7th Floor)</option>
            </select>
          </div>
          <div className="form-group" style={{ marginTop: 'var(--sp-md)' }}>
            <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>
              <input
                type="checkbox"
                name="hasBasement"
                checked={form.hasBasement || false}
                onChange={(e) => setForm(prev => ({ ...prev, hasBasement: e.target.checked }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Include Basement Level
            </label>
          </div>

          {/* CCTV Camera URLs */}
          <div style={{ marginTop: 'var(--sp-md)', paddingTop: 'var(--sp-md)', borderTop: '1px solid var(--hairline)' }}>
            <label style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
              📷 CCTV Camera Feeds <span style={{ fontWeight: 400, color: 'var(--concrete)', fontSize: '0.72rem' }}>(Optional — up to 4)</span>
            </label>
            <div style={{ background: 'rgba(197,168,128,0.07)', border: '1px solid var(--gold-light)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '10px', fontSize: '0.72rem', lineHeight: 1.6, color: 'var(--concrete)' }}>
              Enter the live stream URL of each camera. Clients will see these on the public dashboard <strong style={{ color: 'var(--ink)' }}>without any login</strong>.<br/>
              Supported: <strong>MJPEG HTTP</strong> (e.g. <code>http://103.x.x.x/videostream.cgi</code>), <strong>HLS</strong> (.m3u8), or camera web UI page.<br/>
              ⚠️ Camera must be accessible from the internet via port forwarding or DDNS.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[0, 1, 2, 3].map(idx => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'var(--gold)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</span>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1, margin: 0 }}
                    placeholder="e.g. http://103.x.x.x:8080/videostream.cgi"
                    value={form.cameraUrls[idx] || ''}
                    onChange={e => {
                      const updated = [...(form.cameraUrls || ['', '', '', ''])];
                      updated[idx] = e.target.value;
                      setForm(prev => ({ ...prev, cameraUrls: updated }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : '✓ Save Changes'}</button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
