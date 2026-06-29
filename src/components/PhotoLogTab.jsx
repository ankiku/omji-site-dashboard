import { useState, useRef, useCallback } from 'react';
import { addPhotoRecord, uploadPhoto } from '../services/localStorageService';
import { useToast } from '../contexts/ToastContext';
import { compressImage } from '../utils/imageUtils';

// ── Lazy-loading image with skeleton ──────────────────────────────────────────
function LazyPhoto({ src, alt, style }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef(null);

  const observerRef = useCallback((node) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }   // start loading 200px before visible
    );
    observer.observe(node);
  }, []);

  return (
    <div ref={observerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Skeleton shimmer */}
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, var(--hairline) 25%, rgba(200,195,185,0.35) 50%, var(--hairline) 75%)',
          backgroundSize: '200% 100%',
          animation: 'photoSkeletonShimmer 1.4s ease infinite',
          borderRadius: 2
        }} />
      )}
      {inView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{
            ...style,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.35s ease',
          }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}

export default function PhotoLogTab({ photos, tasks, projectId, canEdit, onPhotoClick }) {
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ urls: [], caption: '' });
  const [uploadProgress, setUploadProgress] = useState(0);
  const toast = useToast();

  const taskMap = {};
  tasks.forEach(t => { taskMap[t.id] = t; });

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Client-side compress before upload
        const compressed = await compressImage(file);
        const res = await uploadPhoto(projectId, 'general-photo', compressed);
        uploadedUrls.push(res.url);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      setForm(prev => ({ ...prev, urls: [...(prev.urls || []), ...uploadedUrls] }));
      toast.success(`${uploadedUrls.length} photo(s) ready for upload.`);
    } catch (err) {
      toast.error('Image processing failed: ' + err.message);
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!form.urls || form.urls.length === 0) return;
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      for (const url of form.urls) {
        await addPhotoRecord(projectId, 'general', {
          url: url,
          caption: form.caption,
          date: todayDate,
          timestamp: Date.now()
        });
      }
      toast.success(`${form.urls.length} general site photo(s) uploaded`);
      setForm({ urls: [], caption: '' });
      setShowUpload(false);
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    }
  };

  const filteredPhotos = photos.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'general') return p.taskId === 'general';
    if (filter === 'task') return p.taskId && p.taskId !== 'general';
    return true;
  });

  const groupedPhotos = {};
  filteredPhotos.forEach(p => {
    const d = p.date || (p.timestamp ? new Date(p.timestamp).toISOString().split('T')[0] : 'Unknown Date');
    if (!groupedPhotos[d]) groupedPhotos[d] = [];
    groupedPhotos[d].push(p);
  });
  const sortedDates = Object.keys(groupedPhotos).sort((a, b) => {
    if (a === 'Unknown Date') return 1;
    if (b === 'Unknown Date') return -1;
    return new Date(b) - new Date(a);
  });

  return (
    <>
      {/* Keyframe for skeleton shimmer injected once */}
      <style>{`
        @keyframes photoSkeletonShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--paper)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          flexWrap: 'wrap',
          gap: 'var(--sp-sm)'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>
              All Photos ({photos.length})
            </button>
            <button className={`btn btn-sm ${filter === 'task' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('task')}>
              Task Photos ({photos.filter(p => p.taskId && p.taskId !== 'general').length})
            </button>
            <button className={`btn btn-sm ${filter === 'general' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('general')}>
              General Photos ({photos.filter(p => p.taskId === 'general').length})
            </button>
          </div>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowUpload(!showUpload)}>
              {showUpload ? 'Cancel' : '➕ Upload Site Photo'}
            </button>
          )}
        </div>

        {showUpload && (
          <div style={{
            background: 'var(--paper)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
            padding: 'var(--sp-md)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>📷 Upload General Site Photo</h3>
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>Select Image File(s) *</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="form-input"
                  onChange={handleFileChange}
                  required
                  disabled={uploading}
                />
              </div>

              {/* Upload progress bar */}
              {uploading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--concrete)' }}>
                    Compressing &amp; uploading… {uploadProgress}%
                  </div>
                  <div style={{ height: '4px', background: 'var(--hairline)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${uploadProgress}%`,
                      background: 'var(--gold)',
                      borderRadius: '2px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}

              {form.urls && form.urls.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {form.urls.map((u, idx) => (
                    <div key={idx} style={{ width: '80px', height: '80px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--hairline)' }}>
                      <img src={u} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
              <div className="form-group">
                <label>Caption / Remarks</label>
                <input type="text" className="form-input" placeholder="e.g. Front facade view, block B excavation" value={form.caption} onChange={e => setForm(p => ({ ...p, caption: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={uploading || !form.urls || form.urls.length === 0}>
                  {uploading ? 'Processing...' : `Upload ${form.urls?.length || 0} Photo(s)`}
                </button>
              </div>
            </form>
          </div>
        )}

        {sortedDates.length === 0 ? (
          <div className="empty-state"><p>No photos found matching the selected filter.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
            {sortedDates.map(date => (
              <div key={date}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--hairline)' }}>
                  {date !== 'Unknown Date' ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : date}
                </h3>
                <div className="client-photo-grid photo-grid" style={{ gap: '16px', display: 'grid' }}>
                  {groupedPhotos[date].map((photo) => {
                    const task = taskMap[photo.taskId];
                    const isGeneral = photo.taskId === 'general';
                    const globalIndex = filteredPhotos.indexOf(photo);
                    return (
                      <div
                        key={photo.id}
                        className="photo-card"
                        style={{ cursor: 'pointer', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--paper)', boxShadow: 'var(--shadow-xs)' }}
                        onClick={() => onPhotoClick(filteredPhotos.map(item => ({ url: item.url, caption: item.caption })), globalIndex)}
                      >
                        <div className="photo-thumb" style={{ height: '130px', overflow: 'hidden' }}>
                          <LazyPhoto
                            src={photo.url}
                            alt={photo.caption || 'Site photo'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div style={{ padding: '10px' }}>
                          <span className={`expense-cat-badge ${isGeneral ? 'gold' : 'blue'}`} style={{ fontSize: '0.62rem', textTransform: 'uppercase', marginBottom: '6px', display: 'inline-block' }}>
                            {isGeneral ? 'General' : 'Task Link'}
                          </span>
                          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)', margin: '4px 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {photo.caption || (task ? task.activity : 'General site view')}
                          </p>
                          {task && <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--concrete)', margin: 0 }}>Task {task.taskNo}</p>}
                          <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--concrete)', marginTop: 4, marginBottom: 0 }}>{photo.timestamp ? new Date(photo.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
