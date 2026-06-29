import { useState, useEffect } from 'react';
import { generateSchedule, formatDateDisplay } from '../utils/scheduleGenerator';
import { addTasksBatch } from '../services/localStorageService';
import { useToast } from '../contexts/ToastContext';

export default function ScheduleGeneratorModal({
  projectId,
  project,
  initialParams = {},
  onClose,
  onSuccess
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    projectName: project?.name || initialParams.projectName || '',
    clientName: project?.clientName || initialParams.clientName || '',
    architectName: project?.architectName || initialParams.architectName || '',
    location: project?.location || initialParams.location || '',
    scopeOfWork: project?.scopeOfWork || initialParams.scopeOfWork || 'Structure & Civil Work',
    buildingType: project?.buildingType || initialParams.buildingType || 'G+1 Commercial',
    startDate: project?.startDate
      ? new Date(project.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    floorsCount: project?.floorsCount || initialParams.floorsCount || 2,
    hasBasement: project?.hasBasement || initialParams.hasBasement || false,
    workingDaysPerWeek: 7
  });

  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Re-generate preview whenever form choices change
  useEffect(() => {
    try {
      const generated = generateSchedule({
        projectName: form.projectName,
        clientName: form.clientName,
        architectName: form.architectName,
        location: form.location,
        scopeOfWork: form.scopeOfWork,
        buildingType: form.buildingType,
        startDate: new Date(form.startDate),
        floorsCount: parseInt(form.floorsCount, 10),
        hasBasement: form.hasBasement,
        workingDaysPerWeek: parseInt(form.workingDaysPerWeek, 10)
      });
      setPreview(generated);
    } catch (err) {
      console.error(err);
    }
  }, [form]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!preview || preview.tasks.length === 0) {
      toast.error('No tasks generated. Check parameters.');
      return;
    }

    setGenerating(true);
    try {
      // Save tasks batch to backend
      await addTasksBatch(projectId, preview.tasks);
      toast.success(`Generated ${preview.tasks.length} tasks successfully!`);
      if (onSuccess) {
        onSuccess(preview);
      }
      onClose();
    } catch (err) {
      toast.error('Failed to generate schedule: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const uniquePhases = preview ? [...new Set(preview.tasks.map(t => t.phase))] : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        <div className="modal-header">
          <h3>📐 Construction Schedule Generator Wizard</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleGenerate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Form Side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: '0 0 4px 0', borderBottom: '1px solid var(--hairline)', paddingBottom: '4px', fontSize: '0.85rem', color: 'var(--gold-dark)' }}>
                1. CONFIGURE PARAMETERS
              </h4>
              
              <div className="form-group">
                <label>Project Name</label>
                <input className="form-input" name="projectName" value={form.projectName} onChange={handleChange} required placeholder="e.g. Sitapura Commercial Complex" />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Client</label>
                  <input className="form-input" name="clientName" value={form.clientName} onChange={handleChange} placeholder="Mr. Rajesh Jain" />
                </div>
                <div className="form-group">
                  <label>Architect</label>
                  <input className="form-input" name="architectName" value={form.architectName} onChange={handleChange} placeholder="Studio A Design" />
                </div>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input className="form-input" name="location" value={form.location} onChange={handleChange} placeholder="Jaipur, Rajasthan" />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Start Date</label>
                  <input className="form-input" type="date" name="startDate" value={form.startDate} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Building Type / Category</label>
                  <input className="form-input" name="buildingType" value={form.buildingType} onChange={handleChange} placeholder="e.g. G+1 Commercial" />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Floor Levels</label>
                  <select className="form-select" name="floorsCount" value={form.floorsCount} onChange={handleChange}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n} Floor{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Work Schedule</label>
                  <select className="form-select" name="workingDaysPerWeek" value={form.workingDaysPerWeek} onChange={handleChange}>
                    <option value={7}>7 Days / Wk</option>
                    <option value={6}>6 Days / Wk</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '16px' }}>
                  <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                    <input type="checkbox" name="hasBasement" checked={form.hasBasement} onChange={handleChange} style={{ width: '15px', height: '15px' }} />
                    Add Basement
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Scope of Work Description</label>
                <textarea className="form-input" rows="2" name="scopeOfWork" value={form.scopeOfWork} onChange={handleChange} placeholder="Scope details..." style={{ resize: 'vertical', fontFamily: 'inherit', padding: '8px' }} />
              </div>
            </div>

            {/* Preview Side */}
            <div style={{ background: 'var(--paper-2)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid var(--hairline)', paddingBottom: '6px', fontSize: '0.85rem', color: 'var(--gold-dark)' }}>
                2. GENERATED SCHEDULE PREVIEW
              </h4>

              {preview ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', maxHeight: '350px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingBottom: '8px', borderBottom: '1px dashed var(--hairline)' }}>
                    <div>Phases Count: <strong>{uniquePhases.length} Phases</strong></div>
                    <div>Tasks Count: <strong>{preview.tasks.length} Tasks</strong></div>
                    <div>Est. Start: <strong>{formatDateDisplay(preview.metadata.startDate)}</strong></div>
                    <div>Est. Finish: <strong style={{ color: 'var(--gold-dark)' }}>{formatDateDisplay(preview.metadata.targetHandover)}</strong></div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--concrete)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em' }}>Generated Phases list:</span>
                    {uniquePhases.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--paper)', padding: '6px 10px', borderRadius: '4px', borderLeft: '3px solid var(--gold)' }}>
                        <span style={{ fontWeight: 600 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--concrete)', fontStyle: 'italic' }}>
                  Adjust parameters to generate preview...
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '20px', borderTop: '1px solid var(--hairline)', paddingTop: '14px' }}>
            <button type="submit" className="btn btn-primary" disabled={generating || !preview}>
              {generating ? 'Generating Schedule...' : '✨ Generate & Save Schedule'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
