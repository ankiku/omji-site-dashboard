import { useState, useEffect } from 'react';
import { addDrawing, updateDrawing, deleteDrawing, subscribeToDrawings, uploadPhoto } from '../services/localStorageService';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from './ConfirmDialog';
import { inferParamsFromDrawing } from '../utils/scheduleGenerator';
import { compressImage } from '../utils/imageUtils';
import ScheduleGeneratorModal from './ScheduleGeneratorModal';

const DOC_TYPES = [
  'Architectural (ARC)',
  'Structural (STR)',
  'Electrical (ELE)',
  'Plumbing & Firefighting (PLB)',
  'HVAC & Mechanical (MEC)',
  'Infrastructure & Civil (CIV)',
  'Bill of Quantities (BOQ)',
  'Specifications & Approvals (APP)',
  'Other'
];

export default function DrawingRegister({ projectId, canEdit, project }) {
  const [drawings, setDrawings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showWizardForDrawing, setShowWizardForDrawing] = useState(null);
  const [form, setForm] = useState({
    title: '',
    type: 'Architectural (ARC)',
    revision: 'Rev 0',
    drawnBy: '',
    checkedBy: '',
    approvedBy: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    fileUrl: '',
    zone: 'Default',
    status: 'Pending Review',
    architectComments: ''
  });

  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const floorsCount = project?.floorsCount || 1;

  const getFloorName = (index) => {
    if (index === 0) return 'Ground Floor';
    if (index === 1) return 'First Floor';
    if (index === 2) return 'Second Floor';
    if (index === 3) return 'Third Floor';
    if (index === 4) return 'Fourth Floor';
    if (index === 5) return 'Fifth Floor';
    if (index === 6) return 'Sixth Floor';
    if (index === 7) return 'Seventh Floor';
    if (index === 8) return 'Eighth Floor';
    return `Floor ${index}`;
  };

  const getDrawingZonesList = () => {
    const list = [
      { id: 'mumty', label: 'Mumty' },
      { id: 'roof', label: 'Roof & Terrace' }
    ];
    for (let i = floorsCount - 1; i >= 0; i--) {
      list.push({ id: `floor-${i}`, label: getFloorName(i) });
    }
    list.push(
      { id: 'foundation', label: 'Foundation & Columns' },
      { id: 'general', label: 'General Project Zone' }
    );
    return list;
  };

  const normalizeZoneId = (zoneId) => {
    if (zoneId === 'ground') return 'floor-0';
    if (zoneId === 'first') return 'floor-1';
    if (zoneId === 'second') return 'floor-2';
    return zoneId;
  };

  const drawingZones = getDrawingZonesList();

  useEffect(() => {
    return subscribeToDrawings(projectId, setDrawings);
  }, [projectId]);

  const resetForm = () => {
    setForm({
      title: '',
      type: 'Architectural (ARC)',
      revision: 'Rev 0',
      drawnBy: '',
      checkedBy: '',
      approvedBy: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      fileUrl: '',
      zone: 'Default',
      status: 'Pending Review',
      architectComments: ''
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file);
        const { url } = await uploadPhoto(projectId, 'drawing', compressed, () => {});
        setForm(p => ({ ...p, fileUrl: url, fileName: file.name, title: p.title || fileNameWithoutExt }));
        toast.success('Image drawing attached successfully');
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setForm(p => ({ ...p, fileUrl: ev.target.result, fileName: file.name, title: p.title || fileNameWithoutExt }));
          setUploading(false);
          toast.success('PDF / Document attached successfully');
        };
        reader.readAsDataURL(file);
        return;
      }
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await updateDrawing(projectId, editId, form);
        toast.success('Drawing updated successfully');
      } else {
        await addDrawing(projectId, form);
        toast.success('Drawing registered successfully');
      }
      resetForm();
    } catch (err) {
      toast.error('Error saving: ' + err.message);
    }
  };

  const handleEdit = (d) => {
    setForm({
      title: d.title || '',
      type: d.type || 'Architectural (ARC)',
      revision: d.revision || 'Rev 0',
      drawnBy: d.drawnBy || '',
      checkedBy: d.checkedBy || '',
      approvedBy: d.approvedBy || '',
      date: d.date || '',
      notes: d.notes || '',
      fileUrl: d.fileUrl || '',
      fileName: d.fileName || '',
      zone: d.zone || 'Default',
      status: d.status || 'Pending Review',
      architectComments: d.architectComments || ''
    });
    setEditId(d.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete Drawing',
      message: 'Delete this sheet from the project drawing register?',
      confirmText: 'Delete',
      danger: true
    });
    if (ok) {
      try {
        await deleteDrawing(projectId, id);
        toast.success('Drawing deleted successfully');
      } catch (err) {
        toast.error('Error deleting: ' + err.message);
      }
    }
  };

  const handleViewFile = (d) => {
    if (!d.fileUrl) return;
    if (d.fileUrl.startsWith('data:')) {
      try {
        const parts = d.fileUrl.split(';base64,');
        const mime = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: mime });
        const blobURL = URL.createObjectURL(blob);
        window.open(blobURL, '_blank');
      } catch (err) {
        toast.error('Failed to open document: ' + err.message);
      }
    } else {
      window.open(d.fileUrl, '_blank');
    }
  };

  // Group by type
  const byType = {};
  drawings.forEach(d => {
    if (!byType[d.type]) byType[d.type] = [];
    byType[d.type].push(d);
  });

  return (
    <div className="module-container">
      {dialog}
      <div className="module-header">
        <h2 className="section-title">📐 Drawing Control Register</h2>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Upload Drawing Sheet</button>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Edit' : 'Upload'} Drawing Sheet</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Sheet Title (Name) *</label>
                <input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. Ground Floor Plan" />
              </div>
              
              <div className="form-group" style={{ marginTop: 'var(--sp-md)' }}>
                <label>Drawing File (PDF / Image)</label>
                <label className="xlsx-upload-area" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 'var(--sp-md)', border: '2px dashed var(--gold)', borderRadius: 'var(--radius)', background: form.fileUrl ? 'var(--green-light)' : 'var(--gold-light)', textAlign: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: form.fileUrl ? 'var(--green)' : 'var(--gold-dark)' }}>
                    {uploading ? 'Uploading...' : form.fileName || form.fileUrl ? `✓ ${form.fileName || 'File attached'}` : 'Click to select PDF or image file'}
                  </span>
                  <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>
              
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={uploading}>{editId ? '✓ Update Sheet' : '+ Register Sheet'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {drawings.length === 0 && <div className="empty-state"><p>No drawing sheets registered yet.{canEdit ? ' Upload structural plans, elevations, plumbing details...' : ''}</p></div>}

      {Object.entries(byType).map(([type, docs]) => (
        <div key={type} className="section">
          <div className="section-header">
            <h2 className="section-title" style={{ fontSize: '0.85rem' }}>{type} ({docs.length})</h2>
          </div>
          {docs.map(d => (
            <div key={d.id} className="drawing-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div className="drawing-card-left" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {d.fileUrl && d.fileUrl.startsWith('data:image') ? (
                    <div className="drawing-thumb" style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden' }}>
                      <img src={d.fileUrl} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div className="drawing-thumb drawing-thumb-doc" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-2)', borderRadius: '4px', fontSize: '1.2rem' }}>📄</div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>{d.title}</div>
                    <div className="expense-meta" style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', color: 'var(--concrete)', marginTop: 4, flexWrap: 'wrap' }}>
                      <span className="expense-cat-badge" style={{ fontSize: '0.62rem', background: 'var(--paper-2)' }}>{d.revision}</span>
                      {d.drawnBy && <span>Prepared: <strong>{d.drawnBy}</strong></span>}
                      {d.checkedBy && <span>Checked: <strong>{d.checkedBy}</strong></span>}
                      {d.approvedBy && <span>Approved: <strong>{d.approvedBy}</strong></span>}
                      {d.date && <span>Date: <strong>{d.date}</strong></span>}
                      {d.zone && d.zone !== 'Default' && (
                        <span className="expense-cat-badge gold" style={{ fontSize: '0.62rem', textTransform: 'capitalize' }}>
                          📍 {d.zone === 'foundation' ? 'Foundation' : d.zone === 'ground' ? 'Ground Floor' : d.zone === 'first' ? '1st Floor' : d.zone === 'second' ? '2nd Floor' : d.zone === 'roof' ? 'Roof' : d.zone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'center' }}>
                  {/* Status Badge */}
                  <span className={`expense-cat-badge ${
                    d.status === 'Approved for Construction' ? 'green' :
                    d.status === 'Approved as Noted' ? 'gold' :
                    d.status === 'Revise & Resubmit' ? 'rust' : 'grey'
                  }`} style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '3px 8px', fontWeight: 600 }}>
                    {d.status || 'Pending Review'}
                  </span>

                  {d.fileUrl && (
                    <button onClick={() => handleViewFile(d)} className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                      View Sheet
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => setShowWizardForDrawing(d)}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '4px 10px', fontSize: '0.72rem', color: 'var(--gold-dark)', borderColor: 'var(--gold)' }}
                    >
                      ✨ Gen Schedule
                    </button>
                  )}
                  {canEdit && (
                    <div className="expense-actions" style={{ display: 'flex', gap: 4 }}>
                      <button className="expense-action-btn" onClick={() => handleEdit(d)} title="Edit Drawing"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                      <button className="expense-action-btn del" onClick={() => handleDelete(d.id)} title="Delete Drawing"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Review Comments Quote */}
              {d.architectComments && (
                <div style={{
                  borderLeft: '3px solid var(--gold)',
                  paddingLeft: '10px',
                  marginTop: '6px',
                  background: 'var(--paper-2)',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  borderRadius: '0 4px 4px 0',
                  fontSize: '0.75rem',
                  fontStyle: 'italic',
                  color: 'var(--ink-light)'
                }}>
                  <strong>💬 QA Stamp remarks:</strong> "{d.architectComments}"
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {showWizardForDrawing && (
        <ScheduleGeneratorModal
          projectId={projectId}
          project={project}
          initialParams={{
            projectName: project?.name || showWizardForDrawing.title,
            clientName: project?.clientName,
            architectName: project?.architectName,
            location: project?.location,
            scopeOfWork: project?.scopeOfWork,
            ...inferParamsFromDrawing(showWizardForDrawing.fileName || showWizardForDrawing.title)
          }}
          onClose={() => setShowWizardForDrawing(null)}
        />
      )}
    </div>
  );
}
