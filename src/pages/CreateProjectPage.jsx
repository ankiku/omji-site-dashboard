import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { createProject, addTasksBatch } from '../services/localStorageService';
import { generateSlug, toInputDate } from '../utils/helpers';
import { parseTasksFromXLSX } from '../utils/xlsxParser';
import { generateSchedule, inferParamsFromDrawing, formatDateDisplay } from '../utils/scheduleGenerator';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', clientName: '', architectName: '', location: '',
    scopeOfWork: '', startDate: new Date().toISOString().split('T')[0], targetHandover: '', floorsCount: 2,
    hasBasement: false, buildingType: 'G+1 Commercial',
    cameraUrls: ['', '', '', '']  // up to 4 CCTV stream URLs (optional)
  });
  const [xlsxFile, setXlsxFile] = useState(null);
  const [drawingFile, setDrawingFile] = useState(null);
  const [parsedTasks, setParsedTasks] = useState([]);
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [autoFilled, setAutoFilled] = useState([]);
  const [scheduleSource, setScheduleSource] = useState('none'); // 'excel', 'drawing', 'none'

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleXlsxChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setXlsxFile(file);
    setDrawingFile(null);
    setScheduleSource('excel');
    setParseError('');
    setAutoFilled([]);
    try {
      const { tasks, metadata } = await parseTasksFromXLSX(file);
      setParsedTasks(tasks);

      // Auto-fill project details from extracted metadata
      const filled = [];
      setForm(prev => {
        const updated = { ...prev };
        if (metadata.name && !prev.name) { updated.name = metadata.name; filled.push('Project Name'); }
        if (metadata.clientName && !prev.clientName) { updated.clientName = metadata.clientName; filled.push('Client'); }
        if (metadata.architectName && !prev.architectName) { updated.architectName = metadata.architectName; filled.push('Architect'); }
        if (metadata.location && !prev.location) { updated.location = metadata.location; filled.push('Location'); }
        if (metadata.scopeOfWork && !prev.scopeOfWork) { updated.scopeOfWork = metadata.scopeOfWork; filled.push('Scope'); }
        if (metadata.startDate && !prev.startDate) { updated.startDate = toInputDate(metadata.startDate); filled.push('Start Date'); }
        if (metadata.targetHandover && !prev.targetHandover) { updated.targetHandover = toInputDate(metadata.targetHandover); filled.push('Handover'); }
        
        const hasBasementMention = tasks.some(t => {
          const text = `${t.activity || ''} ${t.phase || ''}`.toLowerCase();
          return text.includes('basement') || text.includes('retaining wall');
        }) || (metadata.scopeOfWork || prev.scopeOfWork || '').toLowerCase().includes('basement');

        let maxFloor = 1;
        let hasBasementZone = false;
        tasks.forEach(t => {
          if (!t.structuralZone) return;
          const zoneLower = t.structuralZone.toLowerCase().trim();
          if (zoneLower.includes('basement')) {
            hasBasementZone = true;
          }
          const floorMatch = zoneLower.match(/(ground|first|second|third|fourth|fifth|sixth|seventh|eighth|nineth|tenth|\d+th|\d+nd|\d+rd|\d+st)\s*floor/);
          if (floorMatch) {
            const fName = floorMatch[1];
            let fNum = 1;
            if (fName === 'ground') fNum = 1;
            else if (fName === 'first') fNum = 2;
            else if (fName === 'second') fNum = 3;
            else if (fName === 'third') fNum = 4;
            else if (fName === 'fourth') fNum = 5;
            else if (fName === 'fifth') fNum = 6;
            else if (fName === 'sixth') fNum = 7;
            else if (fName === 'seventh') fNum = 8;
            else if (fName === 'eighth') fNum = 9;
            else {
              const numMatch = fName.match(/(\d+)/);
              if (numMatch) {
                fNum = parseInt(numMatch[1], 10) + 1;
              }
            }
            if (fNum > maxFloor) {
              maxFloor = fNum;
            }
          }
        });

        if (hasBasementMention || hasBasementZone) {
          updated.hasBasement = true;
          filled.push('Basement Level');
        }
        if (maxFloor > updated.floorsCount) {
          updated.floorsCount = maxFloor;
          updated.buildingType = `G+${maxFloor - 1} Building`;
          filled.push(`Floors Count: ${maxFloor}`);
        }
        return updated;
      });
      setAutoFilled(filled);
    } catch (err) {
      setParseError(err.message);
      setParsedTasks([]);
    }
  };

  const handleDrawingChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDrawingFile(file);
    setXlsxFile(null);
    setScheduleSource('drawing');
    setParseError('');
    setAutoFilled([]);
    
    // Infer parameters from drawing name
    const params = inferParamsFromDrawing(file.name);
    const filled = [];
    
    setForm(prev => {
      const updated = { ...prev };
      if (params.buildingType) { updated.buildingType = params.buildingType; }
      if (params.floorsCount) { updated.floorsCount = params.floorsCount; filled.push(`Floors count: ${params.floorsCount}`); }
      if (params.hasBasement) { updated.hasBasement = params.hasBasement; filled.push('Basement Level'); }
      return updated;
    });

    filled.push('Schedule generated from drawing layout');
    setAutoFilled(filled);
    
    // Trigger task generation
    generateTasksFromForm(params.floorsCount, params.hasBasement, params.buildingType);
  };

  const generateTasksFromForm = (customFloors, customBasement, customType) => {
    const floors = customFloors !== undefined ? customFloors : parseInt(form.floorsCount, 10);
    const basement = customBasement !== undefined ? customBasement : form.hasBasement;
    const bType = customType !== undefined ? customType : form.buildingType;

    const generated = generateSchedule({
      projectName: form.name || 'New Project',
      clientName: form.clientName,
      architectName: form.architectName,
      location: form.location,
      scopeOfWork: form.scopeOfWork,
      buildingType: bType,
      startDate: form.startDate ? new Date(form.startDate) : new Date(),
      floorsCount: floors,
      hasBasement: basement,
      workingDaysPerWeek: 7
    });

    setParsedTasks(generated.tasks);
    if (generated.metadata.targetHandover) {
      setForm(prev => ({
        ...prev,
        targetHandover: toInputDate(generated.metadata.targetHandover)
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const slug = generateSlug(form.name);
      
      // If schedule is generated from drawing parameters on the fly
      let finalTasks = [...parsedTasks];
      if (scheduleSource === 'drawing' || (scheduleSource === 'none' && finalTasks.length === 0)) {
        // Generate one final time to capture all current form modifications
        const generated = generateSchedule({
          projectName: form.name,
          clientName: form.clientName,
          architectName: form.architectName,
          location: form.location,
          scopeOfWork: form.scopeOfWork,
          buildingType: form.buildingType,
          startDate: form.startDate ? new Date(form.startDate) : new Date(),
          floorsCount: parseInt(form.floorsCount, 10),
          hasBasement: form.hasBasement,
          workingDaysPerWeek: 7
        });
        finalTasks = generated.tasks;
      }

      const projectResult = await createProject({
        name: form.name,
        clientName: form.clientName,
        architectName: form.architectName,
        location: form.location,
        scopeOfWork: form.scopeOfWork,
        budget: form.budget ? parseFloat(form.budget) : null,
        startDate: form.startDate ? new Date(form.startDate) : null,
        targetHandover: form.targetHandover ? new Date(form.targetHandover) : null,
        floorsCount: parseInt(form.floorsCount || 1, 10),
        hasBasement: !!form.hasBasement,
        buildingType: form.buildingType,
        cameraUrls: (form.cameraUrls || []).filter(u => u.trim() !== ''),
        slug,
      });

      const projectId = projectResult.id;

      if (finalTasks.length > 0) {
        await addTasksBatch(projectId, finalTasks);
      }

      navigate(`/projects/${projectId}`);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project. Please try again.');
      setSaving(false);
    }
  };

  return (
    <>
      <Topbar />
      <div className="container page" style={{ maxWidth: 850 }}>
        <h1 style={{ marginBottom: 'var(--sp-lg)' }}>New Project</h1>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Schedule Input Method Selector */}
          <div className="form-grid-2" style={{ marginBottom: 'var(--sp-lg)' }}>
            {/* Option A: Excel Upload */}
            <div className="card" style={{ margin: 0, padding: 'var(--sp-md)', border: scheduleSource === 'excel' ? '2px solid var(--green)' : '1px solid var(--hairline)', background: scheduleSource === 'excel' ? 'var(--green-light)' : 'var(--paper)' }}>
              <h3 style={{ marginBottom: 'var(--sp-xs)', fontSize: '0.85rem' }}>
                📋 Import Schedule (Excel)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--concrete)', marginBottom: '12px' }}>
                Upload your <strong>Omji Construction Project Schedule</strong> (.xlsx) sheet to populate tasks.
              </p>

              <label className="xlsx-upload-area" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px', border: '1.5px dashed var(--gold)', borderRadius: 'var(--radius)', background: 'rgba(197, 168, 128, 0.08)', textAlign: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--gold-dark)' }}>
                  {xlsxFile ? `✓ ${xlsxFile.name}` : 'Select .xlsx file'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleXlsxChange}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Option B: Drawing Upload & Auto-Generation */}
            <div className="card" style={{ margin: 0, padding: 'var(--sp-md)', border: scheduleSource === 'drawing' ? '2px solid var(--green)' : '1px solid var(--hairline)', background: scheduleSource === 'drawing' ? 'var(--green-light)' : 'var(--paper)' }}>
              <h3 style={{ marginBottom: 'var(--sp-xs)', fontSize: '0.85rem' }}>
                📐 Generate from Drawing Sheet
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--concrete)', marginBottom: '12px' }}>
                Upload project blueprints/PDF drawings to auto-extract parameters and construct tasks.
              </p>

              <div style={{ display: 'flex', gap: '8px' }}>
                <label className="xlsx-upload-area" style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px', border: '1.5px dashed var(--gold)', borderRadius: 'var(--radius)', background: 'rgba(197, 168, 128, 0.08)', textAlign: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--gold-dark)' }}>
                    {drawingFile ? `✓ ${drawingFile.name}` : 'Upload Drawing File'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleDrawingChange}
                    style={{ display: 'none' }}
                  />
                </label>
                
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.72rem', padding: '0 10px' }}
                  onClick={() => {
                    setScheduleSource('drawing');
                    generateTasksFromForm();
                  }}
                >
                  ✨ Auto-Gen
                </button>
              </div>
            </div>
          </div>

          {parseError && (
            <div className="login-error" style={{ marginBottom: 'var(--sp-md)' }}>
              {parseError}
            </div>
          )}

          {parsedTasks.length > 0 && (
            <div style={{ marginBottom: 'var(--sp-lg)', padding: 'var(--sp-md)', background: 'var(--green-light)', borderRadius: 'var(--radius)', border: '1px solid var(--green)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="mono" style={{ fontSize: '0.8rem', color: 'var(--green)', fontWeight: 700, margin: 0 }}>
                  ✓ {parsedTasks.length} tasks ready for this project ({scheduleSource === 'drawing' ? 'Generated' : 'Imported'})
                </p>
                {scheduleSource === 'drawing' && (
                  <button type="button" className="btn btn-outline btn-xs" onClick={() => generateTasksFromForm()} style={{ fontSize: '0.7rem', height: '24px', padding: '0 8px' }}>
                    🔄 Update Preview
                  </button>
                )}
              </div>
              <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--concrete)', marginTop: 4 }}>
                Phases: {[...new Set(parsedTasks.map(t => t.phase))].join(', ')}
              </p>
              {autoFilled.length > 0 && (
                <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold-dark)', marginTop: 6 }}>
                  ✨ Extracted parameters: {autoFilled.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Project Details */}
          <div className="card" style={{ marginBottom: 'var(--sp-lg)' }}>
            <h3 style={{ marginBottom: 'var(--sp-md)', fontSize: '0.85rem' }}>🏗️ Project Details</h3>

            <div className="form-group">
              <label htmlFor="proj-name">Project Name *</label>
              <input id="proj-name" name="name" className="form-input" value={form.name}
                onChange={handleChange} required placeholder="e.g. Sitapura Jain Residence" />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="proj-client">Client Name</label>
                <input id="proj-client" name="clientName" className="form-input" value={form.clientName}
                  onChange={handleChange} placeholder="Mr. Rajesh Jain" />
              </div>
              <div className="form-group">
                <label htmlFor="proj-architect">Architect</label>
                <input id="proj-architect" name="architectName" className="form-input" value={form.architectName}
                  onChange={handleChange} placeholder="Studio A Design" />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="proj-location">Location</label>
                <input id="proj-location" name="location" className="form-input" value={form.location}
                  onChange={handleChange} placeholder="Sitapura, Jaipur" />
              </div>
              <div className="form-group">
                <label htmlFor="proj-type">Building Type / Description</label>
                <input id="proj-type" name="buildingType" className="form-input" value={form.buildingType}
                  onChange={handleChange} placeholder="e.g. G+1 Commercial" />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="proj-scope">Scope of Work</label>
              <textarea id="proj-scope" name="scopeOfWork" className="form-textarea" value={form.scopeOfWork}
                onChange={handleChange} placeholder="G+2 residential construction with basement parking..." />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="proj-start">Start Date</label>
                <input id="proj-start" name="startDate" type="date" className="form-input"
                  value={form.startDate} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="proj-handover">Target Handover (Auto-calculated if tasks exist)</label>
                <input id="proj-handover" name="targetHandover" type="date" className="form-input"
                  value={form.targetHandover} onChange={handleChange} />
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: 'var(--sp-md)' }}>
              <div className="form-group">
                <label htmlFor="proj-floors">Number of Floor Levels *</label>
                <select id="proj-floors" name="floorsCount" className="form-select" value={form.floorsCount} onChange={handleChange}>
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

              <div className="form-group">
                <label htmlFor="proj-budget">Project Budget (₹)</label>
                <input id="proj-budget" name="budget" type="number" className="form-input" value={form.budget || ''} onChange={handleChange} placeholder="e.g. 5000000" />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--sp-md)' }}>
              <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>
                <input
                  type="checkbox"
                  name="hasBasement"
                  checked={form.hasBasement || false}
                  onChange={(e) => {
                    handleChange(e);
                    // trigger quick update
                    setTimeout(() => {
                      if (scheduleSource === 'drawing') generateTasksFromForm(undefined, e.target.checked);
                    }, 50);
                  }}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                Include Basement Level
              </label>
            </div>
          </div>

          {/* CCTV Camera Feeds — Optional */}
          <div className="card" style={{ marginBottom: 'var(--sp-lg)' }}>
            <h3 style={{ marginBottom: '6px', fontSize: '0.85rem' }}>📷 CCTV Camera Feeds <span style={{ fontWeight: 400, color: 'var(--concrete)', fontSize: '0.75rem' }}>(Optional — up to 4)</span></h3>

            {/* How-to guide box */}
            <div style={{ background: 'rgba(197,168,128,0.08)', border: '1px solid var(--gold-light)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '14px', fontSize: '0.75rem', lineHeight: 1.7, color: 'var(--ink)' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--gold-dark)' }}>📡 How to connect your CCTV camera:</div>
              <div>Clients will see the live feed on the public dashboard — <strong>no login required</strong>.</div>
              <div style={{ marginTop: '6px', fontWeight: 600 }}>Supported URL types:</div>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
                <li><strong>MJPEG HTTP stream</strong> (most IP cameras): <code style={{ background: 'var(--hairline)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.7rem' }}>http://192.168.x.x/videostream.cgi</code></li>
                <li><strong>HLS stream</strong> (relay server): <code style={{ background: 'var(--hairline)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.7rem' }}>http://yourserver/hls/cam1.m3u8</code></li>
                <li><strong>Embedded web page</strong>: <code style={{ background: 'var(--hairline)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.7rem' }}>http://192.168.x.x/</code> (camera's own web UI)</li>
              </ul>
              <div style={{ marginTop: '6px', color: 'var(--concrete)' }}>
                ⚠️ RTSP cameras need a relay (e.g. <strong>MediaMTX</strong>) to convert RTSP → HLS for browser viewing.<br/>
                ⚠️ Camera must be accessible from the internet (use port forwarding or a cloud DDNS service).
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[0, 1, 2, 3].map(idx => (
                <div key={idx} className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'var(--gold)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</span>
                    Camera {idx + 1} — Stream URL
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. http://103.x.x.x:8080/videostream.cgi or http://cam1.yourddns.com/stream"
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

          <div style={{ display: 'flex', gap: 'var(--sp-md)' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Project'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

