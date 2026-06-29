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
  const [loading, setLoading] = useState(true);
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
    return subscribeToDrawings(projectId, (data) => {
      setDrawings(data);
      setLoading(false);
    });
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
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    setUploading(true);
    let successCount = 0;

    for (const file of files) {
      try {
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        
        let urlToSave = '';
        if (file.type.startsWith('image/')) {
          const compressed = await compressImage(file);
          const { url } = await uploadPhoto(projectId, 'drawing', compressed, () => {});
          urlToSave = url;
        } else {
          urlToSave = await new Promise((resolve) => {
             const reader = new FileReader();
             reader.onload = (ev) => resolve(ev.target.result);
             reader.readAsDataURL(file);
          });
        }

        if (editId || files.length === 1) {
           // If editing or only 1 file, just update the form so they can hit "Register Sheet"
           setForm(p => ({ ...p, fileUrl: urlToSave, fileName: file.name, title: p.title || fileNameWithoutExt }));
           toast.success(`${file.name} attached successfully`);
        } else {
           // If uploading multiple, auto-save them immediately to save time
           await addDrawing(projectId, {
             ...form,
             title: fileNameWithoutExt,
             fileUrl: urlToSave,
             fileName: file.name,
             date: new Date().toISOString().split('T')[0]
           });
           successCount++;
        }
      } catch (err) {
        toast.error(`Failed to process ${file.name}: ${err.message}`);
      }
    }

    setUploading(false);
    
    if (!editId && files.length > 1 && successCount > 0) {
       toast.success(`${successCount} drawings registered successfully`);
       resetForm(); // close modal
    }
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
                <label>Drawing File(s) (PDF / Image)</label>
                <div style={{ fontSize: '0.7rem', color: 'var(--concrete)', marginBottom: '8px' }}>
                  💡 Tip: You can select multiple files at once. They will be automatically registered!
                </div>
                <label className="xlsx-upload-area" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 'var(--sp-md)', border: '2px dashed var(--gold)', borderRadius: 'var(--radius)', background: form.fileUrl ? 'var(--green-light)' : 'var(--gold-light)', textAlign: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: form.fileUrl ? 'var(--green)' : 'var(--gold-dark)' }}>
                    {uploading ? 'Processing files...' : form.fileName || form.fileUrl ? `✓ ${form.fileName || 'File attached'}` : 'Click to select PDF or image file(s)'}
                  </span>
                  <input type="file" multiple={!editId} accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      ) : drawings.length === 0 ? (
        <div className="empty-state"><p>No drawing sheets registered yet.{canEdit ? ' Upload structural plans, elevations, plumbing details...' : ''}</p></div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {drawings.map(d => (
          <div 
            key={d.id} 
            className="drawing-card" 
            onClick={() => handleViewFile(d)}
            style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ height: '140px', background: 'var(--paper-2)', position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--hairline)' }}>
              {d.fileUrl && d.fileUrl.startsWith('data:image') ? (
                <img src={d.fileUrl} alt={d.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--concrete)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, marginTop: '8px', letterSpacing: '0.05em', color: 'var(--rust)' }}>PDF</span>
                </div>
              )}
            </div>

            <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 8 }}>
                {d.title}
              </div>
              
              <div style={{ fontSize: '0.7rem', color: 'var(--concrete)', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{d.date || new Date().toISOString().split('T')[0]}</span>
                {d.revision && <span style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: '4px' }}>{d.revision}</span>}
              </div>

              {canEdit && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--hairline)' }}>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={(e) => { e.stopPropagation(); setShowWizardForDrawing(d); }} 
                    style={{ padding: '3px 8px', fontSize: '0.65rem', color: 'var(--gold-dark)', borderColor: 'var(--gold)', flex: 1 }}
                  >
                    ✨ Gen Schedule
                  </button>
                  <button className="expense-action-btn" onClick={(e) => { e.stopPropagation(); handleEdit(d); }} title="Edit">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="expense-action-btn del" onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
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
