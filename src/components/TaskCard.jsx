import { useState, useEffect, useRef } from 'react';
import StatusBadge from './StatusBadge';
import TaskEditor from './TaskEditor';
import { formatDate, statusClass } from '../utils/helpers';
import { updateTask, uploadPhoto, addPhotoRecord, subscribeToTaskPhotos, deleteTask } from '../services/localStorageService';
import { compressImage } from '../utils/imageUtils';

const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Delayed'];

export default function TaskCard({ task, projectId, canEdit = false, onPhotoClick, phases = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(task.remarks || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!expanded || !projectId || !task.id) return;
    const unsub = subscribeToTaskPhotos(projectId, task.id, setPhotos);
    return unsub;
  }, [expanded, projectId, task.id]);

  // Keep notes in sync with task prop
  useEffect(() => {
    setNotes(task.remarks || '');
  }, [task.remarks]);

  const handleStatusChange = async (newStatus) => {
    const updates = { status: newStatus };
    const now = new Date();
    if (newStatus === 'In Progress' && !task.actualStart) {
      updates.actualStart = now;
    }
    if (newStatus === 'Completed' && !task.actualFinish) {
      updates.actualFinish = now;
      if (!task.actualStart) updates.actualStart = now;
    }
    try {
      await updateTask(projectId, task.id, updates);
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await updateTask(projectId, task.id, { remarks: notes });
    } catch (err) {
      console.error('Error saving notes:', err);
    }
    setSaving(false);
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        const { url, timestamp } = await uploadPhoto(projectId, task.id, compressed, setUploadProgress);
        await addPhotoRecord(projectId, task.id, {
          url,
          caption: '',
          uploaderName: 'Team',
          timestamp,
        });
      } catch (err) {
        console.error('Error uploading photo:', err);
      }
    }
    setUploading(false);
    setUploadProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask(projectId, task.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task.');
    }
  };

  return (
    <>
      <div className={`task-card ${expanded ? 'expanded' : ''}`}>
        <div className="task-card-header" onClick={() => setExpanded(!expanded)}>
          <div className={`task-dot ${statusClass(task.status)}`} />
          <span className="task-number">{task.taskNo}</span>
          <span className="task-title">{task.activity}</span>
          <StatusBadge status={task.status} />
          {canEdit && (
            <button
              className="task-edit-btn"
              title="Edit Task"
              onClick={(e) => { e.stopPropagation(); setShowEditor(true); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <span className="task-chevron">▾</span>
        </div>

        {expanded && (
          <div className="task-card-body">
            <div className="task-meta-grid">
              <div className="task-meta-item">
                <label>Planned Start</label>
                <span>{formatDate(task.plannedStart)}</span>
              </div>
              <div className="task-meta-item">
                <label>Planned Finish</label>
                <span>{formatDate(task.plannedFinish)}</span>
              </div>
              <div className="task-meta-item">
                <label>Actual Start</label>
                <span>{formatDate(task.actualStart)}</span>
              </div>
              <div className="task-meta-item">
                <label>Actual Finish</label>
                <span>{formatDate(task.actualFinish)}</span>
              </div>
              <div className="task-meta-item">
                <label>Duration</label>
                <span>{task.duration ? `${task.duration} days` : '—'}</span>
              </div>
              <div className="task-meta-item">
                <label>Trade</label>
                <span>{task.trade || '—'}</span>
              </div>
              <div className="task-meta-item">
                <label>Structural Zone</label>
                <span>{task.structuralZone || '—'}</span>
              </div>
            </div>

            {/* Status buttons - only for editors */}
            {canEdit && (
              <div style={{ marginBottom: 'var(--sp-md)' }}>
                <label style={{
                  display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: 8
                }}>
                  Update Status
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      className={`btn btn-sm ${task.status === s ? 
                        (s === 'Completed' ? 'btn-green' : s === 'Delayed' ? 'btn-rust' : 
                         s === 'In Progress' ? 'btn-amber' : 'btn-outline') 
                        : 'btn-outline'}`}
                      onClick={() => handleStatusChange(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Photos strip */}
            <div style={{ marginBottom: 'var(--sp-md)' }}>
              <label style={{
                display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 8
              }}>
                Photos ({photos.length})
              </label>
              <div className="photo-grid">
                {photos.map((photo, i) => (
                  <div
                    key={photo.id}
                    className="photo-thumb"
                    onClick={() => onPhotoClick && onPhotoClick(photos, i)}
                  >
                    <img src={photo.url} alt={photo.caption || 'Site photo'} loading="lazy" />
                  </div>
                ))}
                {canEdit && (
                  <div className="photo-add" onClick={() => fileRef.current?.click()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Add Photo
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                )}
              </div>
              {uploading && (
                <div className="upload-bar">
                  <div className="upload-bar-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label style={{
                display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                color: 'var(--concrete)', textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 8
              }}>
                Remarks / Notes
              </label>
              {canEdit ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    className="form-textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add site notes, observations..."
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveNotes}
                    disabled={saving}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {saving ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: '0.9rem', color: notes ? 'var(--ink)' : 'var(--concrete)' }}>
                  {notes || 'No remarks'}
                </p>
              )}
            </div>

            {/* Task Actions for editors */}
            {canEdit && (
              <div className="task-actions-bar">
                <button className="btn btn-outline btn-sm" onClick={() => setShowEditor(true)} style={{ gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Task
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ gap: 6, color: 'var(--rust)', borderColor: 'var(--rust)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditor && (
        <TaskEditor
          task={task}
          projectId={projectId}
          phases={phases}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--rust)' }}>⚠ Delete Task</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>✕</button>
            </div>
            <p style={{ fontSize: '0.9rem', marginBottom: 'var(--sp-md)', lineHeight: 1.6 }}>
              Are you sure you want to delete task <strong>{task.taskNo}: {task.activity}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
              <button className="btn btn-rust" onClick={handleDeleteTask} style={{ flex: 1 }}>
                Yes, Delete Task
              </button>
              <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
