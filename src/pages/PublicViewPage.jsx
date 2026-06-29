import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';
import TaskCard from '../components/TaskCard';
import Lightbox from '../components/Lightbox';
import ScheduleTab from '../components/ScheduleTab';
import PhotoLogTab from '../components/PhotoLogTab';
import CuringLog from '../components/CuringLog';
import VisualBuildingHub from '../components/VisualBuildingHub';
import DrawingRegister from '../components/DrawingRegister';
import {
  getProjectBySlug, subscribeToTasks, subscribeToPhotos, subscribeToDrawings
} from '../services/localStorageService';
import {
  formatDate, computeProjectStats, getPhases,
  getActivePhase, getFocusTask
} from '../utils/helpers';

export default function PublicViewPage() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [phaseFilter, setPhaseFilter] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let unsub1, unsub2, unsub3;
    async function load() {
      const p = await getProjectBySlug(slug);
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProject(p);
      setLoading(false);
      document.title = `Omji Construction : ${p.name}`;
      unsub1 = subscribeToTasks(p.id, setTasks);
      unsub2 = subscribeToPhotos(p.id, setPhotos);
      unsub3 = subscribeToDrawings(p.id, setDrawings);
    }
    load();
    return () => { unsub1?.(); unsub2?.(); unsub3?.(); };
  }, [slug]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['dashboard', 'visual', 'drawings', 'schedule', 'photos', 'curing', 'cameras'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  if (loading) {
    return (
      <>
        <Topbar publicMode />
        <div className="loader"><div className="spinner" /></div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Topbar publicMode />
        <div className="container page" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 'var(--sp-md)' }}>Project Not Found</h2>
          <p style={{ color: 'var(--concrete)' }}>
            This share link may be invalid or the project may have been removed.
          </p>
        </div>
      </>
    );
  }

  const stats = computeProjectStats(tasks);
  const phases = getPhases(tasks);
  const activePhase = getActivePhase(tasks);
  const focusTask = getFocusTask(tasks);

  const phaseTaskStats = (phaseName) => {
    const pt = tasks.filter(t => t.phase === phaseName);
    return computeProjectStats(pt);
  };

  const hasCameras = Array.isArray(project.cameraUrls) && project.cameraUrls.length > 0;

  return (
    <>
      <Topbar publicMode projectName={project?.name} />
      <div className="container page">

        {/* ── Project header ── */}
        <div className="project-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-md)' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <h1>{project.name}</h1>
              <div className="project-meta" style={{ marginTop: 'var(--sp-md)' }}>
                <div className="project-meta-item"><span className="label">Client</span>{project.clientName || '—'}</div>
                <div className="project-meta-item"><span className="label">Architect</span>{project.architectName || '—'}</div>
                <div className="project-meta-item"><span className="label">Location</span>{project.location || '—'}</div>
                <div className="project-meta-item"><span className="label">Start</span>{formatDate(project.startDate)}</div>
                <div className="project-meta-item"><span className="label">Handover</span>{formatDate(project.targetHandover)}</div>
              </div>
            </div>
            {stats.delayed > 0 ? (
              <div className="stamp stamp-warn">{stats.delayed} Flagged</div>
            ) : (
              <div className="stamp stamp-ok">On Schedule</div>
            )}
          </div>
          {project.scopeOfWork && (
            <div style={{ marginTop: 'var(--sp-md)', padding: '12px 16px', background: 'var(--paper)', borderLeft: '3px solid var(--gold)', borderRadius: 'var(--radius-sm)', boxShadow: '0 2px 8px rgba(28,26,23,0.04)' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: '1.5', margin: 0 }}>
                {project.scopeOfWork}
              </p>
            </div>
          )}
        </div>

        {/* ── Portfolio link (above tabs, right-aligned) ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
          <a
            href="https://omjiconstruction.com/projects"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '0.72rem', fontWeight: 700,
              color: 'var(--gold-dark)', textDecoration: 'none',
              padding: '5px 12px',
              border: '1.5px solid var(--gold)', borderRadius: 'var(--radius)',
              background: 'rgba(197,168,128,0.08)', whiteSpace: 'nowrap',
              transition: 'background 0.18s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(197,168,128,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(197,168,128,0.08)'}
          >
            🏗️ Project Portfolio
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 11L11 1M11 1H5M11 1V7"/>
            </svg>
          </a>
        </div>

        {/* ── Tab row (original CSS, no flex overrides) ── */}
        <div className="tab-row public-view-tabs">
          {['dashboard', 'visual', 'drawings', 'photos', 'curing'].map(tab => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}>
              {tab === 'dashboard' ? '🏠 Dashboard'
                : tab === 'visual' ? '🏗️ Building Hub'
                : tab === 'drawings' ? '📐 Drawings'
                : tab === 'photos' ? '🖼️ Photo Log'
                : '💧 Curing Log'}
            </button>
          ))}
          {/* CCTV tab — always visible */}
          <button
            className={`tab ${activeTab === 'cameras' ? 'active' : ''}`}
            onClick={() => setActiveTab('cameras')}
          >
            📷 CCTV
          </button>
        </div>

        <div style={{ paddingTop: 'var(--sp-lg)' }}>

          {/* ── Dashboard ── */}
          {activeTab === 'dashboard' && (
            <>
              <div className="stat-strip section">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.percentComplete}%</div>
                  <div className="stat-label">Complete</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: stats.delayed > 0 ? 'var(--rust)' : 'var(--ink)' }}>{stats.delayed}</div>
                  <div className="stat-label">Delayed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: phases.length > 0 ? '0.85rem' : undefined }}>{activePhase}</div>
                  <div className="stat-label">Active Phase</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{photos.length}</div>
                  <div className="stat-label">Site Photos</div>
                </div>
              </div>

              {focusTask && (
                <div className="section">
                  <div className="focus-card">
                    <h3>{focusTask.activity}</h3>
                    <p className="mono" style={{ marginTop: 8 }}>
                      Task {focusTask.taskNo} · {focusTask.phase}
                    </p>
                    <StatusBadge status={focusTask.status} />
                  </div>
                </div>
              )}

              <div className="section">
                <div className="section-header"><h2 className="section-title">Phase Progress</h2></div>
                <div className="phase-progress-list">
                  {phases.map(phase => {
                    const ps = phaseTaskStats(phase);
                    return (
                      <div key={phase} className="phase-progress-item"
                        onClick={() => { setPhaseFilter(phase); setActiveTab('schedule'); }}>
                        <div className="phase-progress-header">
                          <span className="phase-progress-name">{phase}</span>
                          <span className="phase-progress-pct">{ps.percentComplete}%</span>
                        </div>
                        <ProgressBar percent={ps.percentComplete} />
                        <div className="mono" style={{ marginTop: 6, fontSize: '0.7rem', color: 'var(--concrete)' }}>
                          {ps.completed}/{ps.total} tasks · {ps.delayed} delayed
                        </div>
                      </div>
                    );
                  })}
                  {phases.length === 0 && <div className="empty-state"><p>No tasks added yet.</p></div>}
                </div>
              </div>
            </>
          )}

          {/* ── Visual Building Hub ── */}
          {activeTab === 'visual' && (
            <VisualBuildingHub
              tasks={tasks}
              drawings={drawings}
              projectId={project.id}
              project={project}
              onPhotoClick={(p, i) => setLightbox({ photos: p, index: i })}
            />
          )}

          {/* ── Drawings ── */}
          {activeTab === 'drawings' && (
            <DrawingRegister projectId={project.id} canEdit={false} project={project} />
          )}

          {/* ── Schedule ── */}
          {activeTab === 'schedule' && (
            <ScheduleTab
              tasks={tasks}
              phases={phases}
              phaseFilter={phaseFilter}
              setPhaseFilter={setPhaseFilter}
              projectId={project.id}
              canEdit={false}
              onPhotoClick={(p, i) => setLightbox({ photos: p, index: i })}
            />
          )}

          {/* ── Photo Log ── */}
          {activeTab === 'photos' && (
            <PhotoLogTab
              photos={photos}
              tasks={tasks}
              projectId={project.id}
              canEdit={false}
              onPhotoClick={(p, i) => setLightbox({ photos: p, index: i })}
            />
          )}

          {/* ── Curing Log ── */}
          {activeTab === 'curing' && (
            <CuringLog
              projectId={project.id}
              canEdit={false}
              project={project}
              onPhotoClick={(p, i) => setLightbox({ photos: p, index: i })}
            />
          )}

          {/* ── CCTV / Live Cameras ── */}
          {activeTab === 'cameras' && (
            <>
              <style>{`
                @keyframes camLivePulse {
                  0%, 100% { opacity: 1; box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
                  50%       { opacity: 0.65; box-shadow: 0 0 0 6px rgba(34,197,94,0.06); }
                }
              `}</style>

              {!hasCameras ? (
                /* ── Empty state ── */
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '64px 24px', gap: '14px',
                  background: 'var(--paper)', border: '1px solid var(--hairline)',
                  borderRadius: 'var(--radius)', textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3rem', lineHeight: 1, opacity: 0.55 }}>📷</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                    No Cameras Configured
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--concrete)', maxWidth: '300px', margin: 0, lineHeight: 1.6 }}>
                    No CCTV camera feeds have been added to this project yet.
                    Feeds can be added when creating or editing the project.
                  </p>
                </div>
              ) : (
                /* ── Camera grid ── */
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: project.cameraUrls.length === 1
                    ? '1fr'
                    : 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px'
                }}>
                  {project.cameraUrls.map((url, idx) => (
                    <div key={idx} style={{
                      background: 'var(--paper)', border: '1px solid var(--hairline)',
                      borderRadius: 'var(--radius)', overflow: 'hidden',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      {/* Header bar */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 14px', borderBottom: '1px solid var(--hairline)',
                        background: 'var(--canvas)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            display: 'inline-block', width: '8px', height: '8px',
                            borderRadius: '50%', background: '#22c55e',
                            animation: 'camLivePulse 2s ease infinite'
                          }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)' }}>
                            Camera {idx + 1}
                          </span>
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                            color: '#22c55e', background: 'rgba(34,197,94,0.1)',
                            padding: '1px 6px', borderRadius: '3px', fontFamily: 'monospace'
                          }}>LIVE</span>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.72rem', color: 'var(--gold-dark)', textDecoration: 'none', fontWeight: 600 }}
                        >
                          ⛶ Fullscreen
                        </a>
                      </div>
                      {/* 16:9 stream container */}
                      <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#0d0d0d' }}>
                        <iframe
                          src={url}
                          title={`Camera ${idx + 1}`}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                          allow="camera; autoplay; fullscreen"
                          allowFullScreen
                          loading="lazy"
                        />
                        {/* MJPEG direct-image fallback */}
                        <img
                          src={url}
                          alt={`Camera ${idx + 1} stream`}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {lightbox && (
        <Lightbox photos={lightbox.photos} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
