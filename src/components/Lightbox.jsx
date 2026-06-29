import { useState } from 'react';

export default function Lightbox({ photos, initialIndex = 0, onClose }) {
  const [idx, setIdx] = useState(initialIndex);
  const photo = photos[idx];

  if (!photo) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      <img
        src={photo.url}
        alt={photo.caption || 'Site photo'}
        className="lightbox-img"
        onClick={(e) => {
          e.stopPropagation();
          if (photos.length > 1) {
            const rect = e.target.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX < rect.width / 2) {
              setIdx(i => (i - 1 + photos.length) % photos.length);
            } else {
              setIdx(i => (i + 1) % photos.length);
            }
          }
        }}
      />
      {photos.length > 1 && (
        <>
          <button
            style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem'
            }}
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + photos.length) % photos.length); }}
          >
            ‹
          </button>
          <button
            style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem'
            }}
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % photos.length); }}
          >
            ›
          </button>
        </>
      )}
      {photo.caption && (
        <div className="lightbox-caption">{photo.caption}</div>
      )}
    </div>
  );
}
