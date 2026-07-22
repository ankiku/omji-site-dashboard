import { useState, useEffect } from 'react';
import {
  subscribeToCuringRecords,
  addCuringRecord,
  updateCuringRecord,
  deleteCuringRecord,
  uploadPhoto
} from '../services/localStorageService';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from './ConfirmDialog';
import { compressImage } from '../utils/imageUtils';

export default function CuringLog({ projectId, canEdit, project, onPhotoClick }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const [records, setRecords] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    remarks: '',
    photoUrls: []
  });

  useEffect(() => {
    return subscribeToCuringRecords(projectId, setRecords);
  }, [projectId]);

  // Flatten both simple photo records and legacy nested curing session records
  const curingPhotos = [];
  records.forEach(r => {
    if (r.curingSessions && Array.isArray(r.curingSessions) && r.curingSessions.length > 0) {
      r.curingSessions.forEach(session => {
        curingPhotos.push({
          id: session.id,
          pourId: r.id,
          memberName: r.memberName || 'General Pour',
          isSession: true,
          date: session.date || r.castingDate || new Date(session.createdAt || r.createdAt || Date.now()).toISOString().split('T')[0],
          photoUrl: session.photoUrl,
          remarks: session.remarks || `Water curing for ${r.memberName || 'concrete component'}`,
          createdAt: session.createdAt || r.createdAt || new Date().toISOString()
        });
      });
    } else {
      curingPhotos.push({
        id: r.id,
        isSession: false,
        date: r.date || new Date(r.createdAt || Date.now()).toISOString().split('T')[0],
        photoUrl: r.photoUrl,
        remarks: r.remarks || 'Water curing photo',
        createdAt: r.createdAt || new Date().toISOString()
      });
    }
  });

  // Sort by curing date descending, then creation date descending
  curingPhotos.sort((a, b) => {
    const diff = new Date(b.date) - new Date(a.date);
    if (diff !== 0) return diff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Filter photos by search query
  const filteredPhotos = curingPhotos.filter(p => {
    const term = searchQuery.toLowerCase();
    return (
      p.date.includes(term) ||
      (p.remarks && p.remarks.toLowerCase().includes(term)) ||
      (p.memberName && p.memberName.toLowerCase().includes(term))
    );
  });

  const groupedCuringPhotos = {};
  filteredPhotos.forEach(p => {
    const d = p.date || 'Unknown Date';
    if (!groupedCuringPhotos[d]) groupedCuringPhotos[d] = [];
    groupedCuringPhotos[d].push(p);
  });
  const sortedDates = Object.keys(groupedCuringPhotos).sort((a, b) => {
    if (a === 'Unknown Date') return 1;
    if (b === 'Unknown Date') return -1;
    return new Date(b) - new Date(a);
  });

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const compressed = await compressImage(file);
        const res = await uploadPhoto(projectId, 'curing', compressed);
        uploadedUrls.push(res.url);
      }
      setForm(prev => ({ ...prev, photoUrls: [...(prev.photoUrls || []), ...uploadedUrls] }));
      toast.success(`${uploadedUrls.length} photo(s) uploaded successfully.`);
    } catch (err) {
      toast.error('Failed to upload image: ' + err.message);
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.photoUrls || form.photoUrls.length === 0) {
      toast.error('Please select and upload a water curing photo.');
      return;
    }

    try {
      for (const url of form.photoUrls) {
        await addCuringRecord(projectId, {
          date: form.date,
          photoUrl: url,
          remarks: form.remarks || 'Daily water curing completed',
          createdAt: new Date().toISOString()
        });
      }

      toast.success('Daily water curing image(s) saved.');
      setForm({
        date: new Date().toISOString().split('T')[0],
        remarks: '',
        photoUrls: []
      });
      setShowUploadModal(false);
    } catch (err) {
      toast.error('Failed to save curing log: ' + err.message);
    }
  };

  const handleDelete = async (photo) => {
    const ok = await confirm({
      title: 'Delete Curing Photo',
      message: 'Are you sure you want to permanently delete this curing verification photo?',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;

    try {
      if (photo.isSession) {
        // If it's a session inside a legacy pour record, update the parent record
        const parent = records.find(r => r.id === photo.pourId);
        if (parent) {
          const updatedSessions = parent.curingSessions.filter(s => s.id !== photo.id);
          if (updatedSessions.length === 0) {
            // Delete parent too if it has no sessions left
            await deleteCuringRecord(projectId, parent.id);
          } else {
            await updateCuringRecord(projectId, parent.id, {
              ...parent,
              curingSessions: updatedSessions
            });
          }
        }
      } else {
        // Simple curing photo record deletion
        await deleteCuringRecord(projectId, photo.id);
      }
      toast.success('Curing verification photo deleted.');
    } catch (err) {
      toast.error('Failed to delete photo: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
      {dialog}

      {/* Curing Log Header */}
      <div className="card-premium" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 24px',
        flexWrap: 'wrap',
        gap: 'var(--sp-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'var(--gold-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            border: '1px solid var(--gold-opacity)'
          }}>
            💧
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--gold-dark)', letterSpacing: '-0.02em' }}>
              Daily Curing Log
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--concrete)', fontWeight: 500 }}>
              Water curing verification photo register and logs.
            </p>
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowUploadModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Curing Image
          </button>
        )}
      </div>

      {/* Search Filter Panel */}
      <div style={{ display: 'flex', gap: 'var(--sp-md)', alignItems: 'center' }}>
        <div className="search-box" style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by date or remarks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px', height: '42px' }}
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--concrete)" strokeWidth="2" style={{ position: 'absolute', left: '14px', top: '13px' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--concrete)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Showing {filteredPhotos.length} of {curingPhotos.length} logs
        </div>
      </div>

      {/* Photos Grid Register */}
      {sortedDates.length === 0 ? (
        <div className="card" style={{ padding: 'var(--sp-xl)', textAlign: 'center', borderStyle: 'dashed' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--concrete)', margin: 0 }}>
            {searchQuery ? 'No curing photos matched your search.' : 'No water curing logs recorded yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
          {sortedDates.map(date => (
            <div key={date}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--hairline)' }}>
                {date !== 'Unknown Date' ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : date}
              </h3>
              <div className="client-photo-grid">
                {groupedCuringPhotos[date].map((photo) => {
                  const globalIndex = filteredPhotos.indexOf(photo);
                  return (
                    <div
                      key={photo.id}
                      className="card-premium"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        padding: 0,
                        border: '1px solid var(--hairline)',
                        background: 'var(--paper)',
                        position: 'relative'
                      }}
                    >
                      {/* Photo click area */}
                      <div
                        className="curing-img-container"
                        style={{
                          height: '200px',
                          cursor: 'pointer',
                          position: 'relative',
                          overflow: 'hidden',
                          background: 'var(--paper-2)'
                        }}
                        onClick={() => onPhotoClick(filteredPhotos.map(p => ({
                          url: p.photoUrl,
                          caption: p.remarks || `Water curing log - ${p.date}`
                        })), globalIndex)}
                      >
                        <img
                          src={photo.photoUrl}
                          alt="Daily water curing log"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.3s ease'
                          }}
                          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseOut={e => e.currentTarget.style.transform = 'scale(1.0)'}
                        />
                        
                        {/* Date Stamp overlay */}
                        <div className="date-stamp" style={{
                          position: 'absolute',
                          top: '12px',
                          left: '12px',
                          background: 'var(--gold-dark)',
                          color: '#FFF',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          📅 {photo.date}
                        </div>
                      </div>

                      {/* Remarks/Details footer */}
                      <div className="card-footer" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'var(--sp-sm)' }}>
                        <div>
                          {photo.memberName && (
                            <div style={{ marginBottom: '6px' }}>
                              <span className="log-badge" style={{ fontSize: '0.65rem', background: 'var(--paper-2)', color: 'var(--gold-dark)', borderColor: 'var(--gold-opacity)' }}>
                                {photo.memberName}
                              </span>
                            </div>
                          )}
                          <p style={{
                            margin: 0,
                            fontSize: '0.85rem',
                            lineHeight: 1.4,
                            color: 'var(--ink)',
                            fontWeight: 500,
                            wordBreak: 'break-word'
                          }}>
                            {photo.remarks}
                          </p>
                        </div>

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderTop: '1px solid var(--hairline)',
                          paddingTop: '12px',
                          marginTop: '4px'
                        }}>
                          <span className="time-stamp" style={{ fontSize: '0.7rem', color: 'var(--concrete)', fontFamily: 'var(--font-mono)' }}>
                            {new Date(photo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          
                          {canEdit && (
                            <button
                              className="btn-link"
                              onClick={() => handleDelete(photo)}
                              style={{
                                border: 'none',
                                background: 'none',
                                color: 'var(--rust)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Upload Curing Photo */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--ink)' }}>
                Upload Curing Verification
              </h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ marginTop: 'var(--sp-md)' }}>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.78rem' }}>Curing Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: 'var(--sp-md)' }}>
                <label style={{ fontWeight: 600, fontSize: '0.78rem' }}>Curing Image(s) *</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="form-input"
                  onChange={handleFileChange}
                  required={!form.photoUrls || form.photoUrls.length === 0}
                />
              </div>

              {/* Upload Preview */}
              {form.photoUrls && form.photoUrls.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'var(--sp-sm)' }}>
                  {form.photoUrls.map((u, idx) => (
                    <div key={idx} style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      border: '1px solid var(--hairline)',
                      background: 'var(--paper-2)'
                    }}>
                      <img src={u} alt="Curing Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group" style={{ marginTop: 'var(--sp-md)' }}>
                <label style={{ fontWeight: 600, fontSize: '0.78rem' }}>Curing Remarks / Caption</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.remarks}
                  placeholder="e.g. Columns water wetting - 4th Day complete"
                  onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: 'var(--sp-lg)' }}>
                <button type="submit" className="btn btn-primary" disabled={uploading || !form.photoUrls || form.photoUrls.length === 0}>
                  {uploading ? 'Processing Image...' : `✓ Save ${form.photoUrls?.length || 0} Curing Log(s)`}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
