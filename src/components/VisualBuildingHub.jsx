import { useState, useEffect, useMemo } from 'react';
import { subscribeToPhotos } from '../services/localStorageService';
import { formatDate } from '../utils/helpers';
import StatusBadge from './StatusBadge';

export default function VisualBuildingHub({ tasks, drawings = [], projectId, project, onPhotoClick }) {
  const floorsCount = project?.floorsCount || 1;
  const [activeZone, setActiveZone] = useState('floor-0');
  const [photos, setPhotos] = useState([]);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [detailTab, setDetailTab] = useState('tasks');

  useEffect(() => {
    return subscribeToPhotos(projectId, setPhotos);
  }, [projectId]);

  const getFloorName = (i) => ['Ground Floor','First Floor','Second Floor','Third Floor','Fourth Floor','Fifth Floor','Sixth Floor','Seventh Floor','Eighth Floor'][i] || `Floor ${i}`;
  const getFloorKeywords = (i) => {
    const map = [['ground','gf','g.f','plinth'],['first','1st','ff','f.f'],['second','2nd','sf','s.f'],['third','3rd','tf','t.f'],['fourth','4th'],['fifth','5th'],['sixth','6th'],['seventh','7th'],['eighth','8th']];
    return map[i] || [`floor ${i}`, `${i}th`];
  };

  const hasBasement = !!project?.hasBasement;

  const ZONES = useMemo(() => {
    const z = [
      { id: 'mumty', label: 'Mumty / OHT', icon: '🏗️', keywords: ['mumty','staircase roof','overhead tank','oht'] },
      { id: 'roof', label: 'Roof & Terrace', icon: '🏠', keywords: ['roof','terrace','slab curing','parapet','terrace slab'] }
    ];
    for (let i = floorsCount - 1; i >= 0; i--) {
      z.push({ id: `floor-${i}`, label: getFloorName(i), icon: i === 0 ? '🚪' : '🪟', keywords: getFloorKeywords(i) });
    }
    if (hasBasement) z.push({ id: 'basement', label: 'Basement', icon: '⬇️', keywords: ['basement','lower ground','cellar','retaining wall','basement slab'] });
    z.push(
      { id: 'foundation', label: 'Foundation', icon: '⛏️', keywords: ['foundation','excavat','footing','earthwork','soil','column'] },
      { id: 'general', label: 'General', icon: '📁', keywords: [] }
    );
    return z;
  }, [floorsCount, hasBasement]);

  const normalizeZoneId = (zoneId) => { if (zoneId === 'ground') return 'floor-0'; if (zoneId === 'first') return 'floor-1'; if (zoneId === 'second') return 'floor-2'; return zoneId; };
  const getTaskZone = (task) => {
    if (task.structuralZone) {
      const zoneLower = task.structuralZone.toLowerCase().trim();
      if (zoneLower === 'general') return 'general';
      if (zoneLower === 'foundation') return 'foundation';
      if (zoneLower === 'basement') return 'basement';
      if (zoneLower === 'ground floor' || zoneLower === 'gf' || zoneLower === 'g.f') return 'floor-0';
      if (zoneLower === 'first floor' || zoneLower === 'ff' || zoneLower === 'f.f') return 'floor-1';
      if (zoneLower === 'second floor' || zoneLower === 'sf' || zoneLower === 's.f') return 'floor-2';
      if (zoneLower === 'third floor' || zoneLower === 'tf' || zoneLower === 't.f') return 'floor-3';
      if (zoneLower === 'fourth floor') return 'floor-4';
      if (zoneLower === 'fifth floor') return 'floor-5';
      if (zoneLower === 'sixth floor') return 'floor-6';
      if (zoneLower === 'seventh floor') return 'floor-7';
      if (zoneLower === 'eighth floor') return 'floor-8';
      if (zoneLower === 'mumty' || zoneLower === 'oht') return 'mumty';
      if (zoneLower === 'roof' || zoneLower === 'terrace' || zoneLower === 'roof & terrace') return 'roof';
      
      // Fallback matching against ZONES labels/keywords if it's some other custom string
      for (const z of ZONES) {
        if (z.id === 'general') continue;
        if (
          z.id.toLowerCase() === zoneLower ||
          z.label.toLowerCase().includes(zoneLower) ||
          z.keywords.some(k => zoneLower.includes(k) || k.includes(zoneLower))
        ) {
          return z.id;
        }
      }
      return 'general';
    }
    
    // Only perform keyword-based fallback if task.structuralZone is NOT defined
    const text = `${task.activity || ''} ${task.phase || ''}`.toLowerCase();
    for (const z of ZONES) {
      if (z.id === 'general') continue;
      if (z.keywords.some(k => text.includes(k))) return z.id;
    }
    return 'general';
  };
  const getDrawingZone = (dwg) => { let dZ = normalizeZoneId(dwg.zone); if (dZ && dZ !== 'Default') return dZ; const text = `${dwg.title || ''} ${dwg.notes || ''}`.toLowerCase(); for (const z of ZONES) { if (z.id === 'general') continue; if (z.keywords.some(k => text.includes(k))) return z.id; } return 'general'; };

  const { zoneTasks, zoneDrawings, zonePhotos } = useMemo(() => {
    const zt = {}, zd = {}, zp = {};
    ZONES.forEach(z => { zt[z.id] = []; zd[z.id] = []; zp[z.id] = []; });
    tasks.forEach(t => { const id = getTaskZone(t); if (zt[id]) zt[id].push(t); });
    drawings.forEach(d => { const id = getDrawingZone(d); if (zd[id]) zd[id].push(d); });
    const taskMap = {}; tasks.forEach(t => { taskMap[t.id] = t; });
    photos.forEach(p => { let id = 'general'; if (p.taskId && p.taskId !== 'general' && taskMap[p.taskId]) id = getTaskZone(taskMap[p.taskId]); if (zp[id]) zp[id].push(p); });
    return { zoneTasks: zt, zoneDrawings: zd, zonePhotos: zp };
  }, [tasks, drawings, photos, ZONES]);

  const getZoneStats = (zId) => { const tl = zoneTasks[zId] || []; if (!tl.length) return 0; return Math.round((tl.filter(t => t.status === 'Completed').length / tl.length) * 100); };
  const getStatusDist = (zId) => {
    const tl = zoneTasks[zId] || []; const total = tl.length;
    if (!total) return { completed: 0, inProgress: 0, notStarted: 0, delayed: 0, total: 0 };
    const c = tl.filter(t => t.status === 'Completed').length;
    const p = tl.filter(t => t.status === 'In Progress').length;
    const d = tl.filter(t => t.status === 'Delayed').length;
    const n = total - c - p - d;
    return { completed: c, inProgress: p, delayed: d, notStarted: n, total };
  };

  // Overall project stats
  const overallStats = useMemo(() => {
    const total = tasks.length;
    if (!total) return { pct: 0, completed: 0, active: 0, delayed: 0, total: 0 };
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const active = tasks.filter(t => t.status === 'In Progress').length;
    const delayed = tasks.filter(t => t.status === 'Delayed').length;
    return { pct: Math.round((completed / total) * 100), completed, active, delayed, total };
  }, [tasks]);

  const az = ZONES.find(z => z.id === activeZone);
  const activeT = zoneTasks[activeZone] || [];
  const activeD = zoneDrawings[activeZone] || [];
  const activeP = zonePhotos[activeZone] || [];
  const activePct = getZoneStats(activeZone);
  const activeDist = getStatusDist(activeZone);

  // Donut ring math
  const R = 38, C = 2 * Math.PI * R;

  // Mini sparkline for a zone's task completion (simple bar)
  const MiniBar = ({ pct, w = 48, h = 6 }) => (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <rect x="0" y="0" width={w} height={h} rx={h/2} fill="rgba(197,168,128,0.18)" />
      <rect x="0" y="0" width={Math.max(pct/100*w, pct > 0 ? 3 : 0)} height={h} rx={h/2} fill={pct === 100 ? '#4D6645' : pct > 0 ? '#C5A880' : 'transparent'} />
    </svg>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bh-ring { from { stroke-dashoffset: ${C}; } }
        @keyframes bh-fade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bh-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(197,168,128,0.3); } 50% { box-shadow: 0 0 0 6px rgba(197,168,128,0); } }
        .bh-zone-row { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; cursor:pointer; transition:all .2s; border:1.5px solid transparent; user-select:none; }
        .bh-zone-row:hover { background:var(--gold-light); border-color:var(--gold); transform:translateX(3px); }
        .bh-zone-row.active { background:var(--gold-light); border-color:var(--gold-dark); box-shadow:var(--shadow-sm); }
        .bh-zone-row.active .bh-zone-pct { color:var(--gold-dark); }
        .bh-kpi { display:flex; flex-direction:column; align-items:center; padding:12px 8px; border-radius:10px; background:var(--paper); border:1px solid var(--hairline); min-width:0; flex:1; }
        .bh-detail-tab { padding:6px 14px; border-radius:6px; font-size:.72rem; font-weight:700; cursor:pointer; border:1.5px solid var(--hairline); background:var(--paper); color:var(--concrete); transition:all .2s; text-transform:uppercase; letter-spacing:.06em; font-family:var(--font-mono); }
        .bh-detail-tab.active { background:var(--ink); color:#fff; border-color:var(--ink); }
        .bh-detail-tab:hover:not(.active) { border-color:var(--gold); color:var(--ink); }
        .bh-item { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#fff; border:1px solid var(--hairline); border-radius:8px; transition:all .15s; }
        .bh-item:hover { border-color:var(--gold); transform:translateX(2px); box-shadow:var(--shadow-sm); }
      `}} />

      {/* === TOP: Overall Progress Banner === */}
      <div style={{ background: 'linear-gradient(135deg, #1C1A17 0%, #3D3933 60%, #5A5549 100%)', borderRadius: 'var(--radius)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', color: '#fff', position: 'relative', overflow: 'hidden', flexWrap: 'wrap' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(197,168,128,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 60, width: 100, height: 100, borderRadius: '50%', background: 'rgba(197,168,128,0.05)' }} />

        {/* Donut */}
        <div style={{ width: 68, height: 68, flexShrink: 0, position: 'relative' }}>
          <svg viewBox="0 0 84 84" width="68" height="68">
            <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
            <circle cx="42" cy="42" r={R} fill="none" stroke="#C5A880" strokeWidth="7" strokeDasharray={C} strokeDashoffset={C - (overallStats.pct / 100) * C} strokeLinecap="round" transform="rotate(-90 42 42)" style={{ animation: 'bh-ring .8s ease forwards' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{overallStats.pct}%</span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C5A880', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>Building Progress Overview</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>{project?.name || 'Project'}</div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Total', value: overallStats.total, color: '#fff' },
              { label: 'Done', value: overallStats.completed, color: '#8BC28B' },
              { label: 'Active', value: overallStats.active, color: '#F0C75E' },
              { label: 'Delayed', value: overallStats.delayed, color: '#E87461' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: '.75rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>{s.label}: <strong style={{ color: '#fff' }}>{s.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === MAIN: Two-Column Layout (stacks on mobile) === */}
      <div className="bh-mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 280px) minmax(0, 1fr)', gap: 'var(--sp-md)', alignItems: 'start' }}>

        {/* LEFT: Zone Navigator */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px 12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--concrete)', marginBottom: '12px', fontFamily: 'var(--font-mono)', padding: '0 12px' }}>
            Structural Zones ({ZONES.length})
          </div>

          <div className="bh-mobile-zones" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {ZONES.map(z => {
              const pct = getZoneStats(z.id);
              const tCount = (zoneTasks[z.id] || []).length;
              const isActive = activeZone === z.id;
              const isHovered = hoveredZone === z.id;
              return (
                <div
                  key={z.id}
                  className={`bh-zone-row ${isActive ? 'active' : ''}`}
                  onClick={() => { setActiveZone(z.id); setDetailTab('tasks'); }}
                  onMouseEnter={() => setHoveredZone(z.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                >
                  <span style={{ fontSize: '1rem', width: 24, textAlign: 'center' }}>{z.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.78rem', fontWeight: isActive ? 700 : 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.label}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>{tCount} tasks</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <span className="bh-zone-pct" style={{ fontSize: '.7rem', fontWeight: 700, color: pct === 100 ? 'var(--green)' : 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>{pct}%</span>
                    <MiniBar pct={pct} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Detail Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)', animation: 'bh-fade .3s ease' }} key={activeZone}>

          {/* KPI Row */}
          <div className="bh-kpi-grid-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {[
              { label: 'Completion', value: `${activePct}%`, sub: `${activeDist.completed}/${activeDist.total}`, color: 'var(--green)' },
              { label: 'In Progress', value: activeDist.inProgress, sub: 'active tasks', color: 'var(--amber)' },
              { label: 'Delayed', value: activeDist.delayed, sub: 'attention needed', color: 'var(--rust)' }
            ].map((kpi, i) => (
              <div key={i} className="bh-kpi">
                <span style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{kpi.label}</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: kpi.color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{kpi.value}</span>
                <span style={{ fontSize: '.62rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{kpi.sub}</span>
              </div>
            ))}
          </div>

          {/* Stacked Bar */}
          {activeDist.total > 0 && (
            <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                {az?.icon} {az?.label} — Progress Distribution
              </div>
              <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: 'var(--hairline)' }}>
                {activeDist.completed > 0 && <div style={{ width: `${(activeDist.completed/activeDist.total)*100}%`, background: 'var(--grad-green)', transition: 'width .6s' }} />}
                {activeDist.inProgress > 0 && <div style={{ width: `${(activeDist.inProgress/activeDist.total)*100}%`, background: 'var(--grad-amber)', transition: 'width .6s' }} />}
                {activeDist.delayed > 0 && <div style={{ width: `${(activeDist.delayed/activeDist.total)*100}%`, background: 'var(--grad-rust)', transition: 'width .6s' }} />}
                {activeDist.notStarted > 0 && <div style={{ width: `${(activeDist.notStarted/activeDist.total)*100}%`, background: '#8B8272', transition: 'width .6s' }} />}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                {[
                  { label: 'Completed', n: activeDist.completed, c: 'var(--green)' },
                  { label: 'In Progress', n: activeDist.inProgress, c: 'var(--amber)' },
                  { label: 'Delayed', n: activeDist.delayed, c: 'var(--rust)' },
                  { label: 'Not Started', n: activeDist.notStarted, c: '#A39D94' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.68rem', color: 'var(--concrete)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.c, flexShrink: 0 }} />
                    {l.label}: <strong style={{ color: 'var(--ink)' }}>{l.n}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detail Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'tasks', label: `Tasks (${activeT.length})` },
              { key: 'photos', label: `Photos (${activeP.length})` },
            ].map(tab => (
              <button key={tab.key} className={`bh-detail-tab ${detailTab === tab.key ? 'active' : ''}`} onClick={() => setDetailTab(tab.key)}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '16px', minHeight: 200 }}>

            {detailTab === 'tasks' && (
              activeT.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--concrete)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: '.82rem', fontWeight: 600 }}>No tasks classified for {az?.label}</div>
                  <div style={{ fontSize: '.72rem', marginTop: 4 }}>Tasks are auto-classified by activity keywords.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                  {activeT.map(t => (
                    <div key={t.id} className="bh-item">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '.68rem', fontFamily: 'var(--font-mono)', color: 'var(--concrete)', fontWeight: 600, flexShrink: 0 }}>{t.taskNo}</span>
                          <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.activity}</span>
                        </div>
                        {t.plannedStart && <div style={{ fontSize: '.65rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{formatDate(t.plannedStart)} → {t.plannedFinish ? formatDate(t.plannedFinish) : '—'}</div>}
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              )
            )}

            {detailTab === 'photos' && (
              activeP.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--concrete)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📸</div>
                  <div style={{ fontSize: '.82rem', fontWeight: 600 }}>No progress photos for {az?.label}</div>
                  <div style={{ fontSize: '.72rem', marginTop: 4 }}>Upload photos against tasks to see them here.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {activeP.map((photo, i) => (
                    <div key={photo.id} onClick={() => onPhotoClick(activeP, i)} style={{ height: 80, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--hairline)', transition: 'transform .2s' }} className="photo-thumb">
                      <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

        </div>
      </div>

      {/* === BOTTOM: Separate Drawings Dashboard Widget === */}
      <div style={{ marginTop: 'var(--sp-xl)', background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>
            Project Drawings ({drawings.length})
          </div>
        </div>
        
        {drawings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--concrete)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📐</div>
            <div style={{ fontSize: '.82rem', fontWeight: 600 }}>No drawings uploaded yet</div>
            <div style={{ fontSize: '.72rem', marginTop: 4 }}>Go to the Drawing Register to upload project drawings.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {drawings.slice(0, 8).map(d => (
              <div key={d.id} className="bh-item" style={{ border: '1px solid var(--hairline)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)' }}>{d.title}</div>
                  <div style={{ fontSize: '.65rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    Uploaded: {new Date(d.date || d.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {d.fileUrl && (
                  <button className="btn btn-outline btn-sm" onClick={() => window.open(d.fileUrl, '_blank')}>View PDF</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
