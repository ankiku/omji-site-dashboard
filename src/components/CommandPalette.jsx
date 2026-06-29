import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllProjects } from '../services/localStorageService';
import { ALL_MODULES, MODULE_CATEGORIES } from '../config/projectModules';

export default function CommandPalette({ open, onClose, inProject = false, activeTab, setActiveTab }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const q = query.toLowerCase().trim();

    async function search() {
      const items = [];

      if (!q) {
        if (inProject) {
          MODULE_CATEGORIES.forEach((cat) => {
            cat.modules.forEach((mod) => {
              items.push({
                type: 'module',
                label: mod.label,
                sub: `${cat.label} · ${mod.description}`,
                icon: mod.icon,
                action: () => setActiveTab?.(mod.id),
              });
            });
          });
        }
        const commands = [
          { label: 'Go to All Projects', sub: 'View project list', action: () => navigate('/'), keywords: 'home list projects all', icon: '🏠' },
          { label: 'Create New Project', sub: 'Start a new project', action: () => navigate('/projects/new'), keywords: 'new create add project', icon: '➕' },
          { label: 'Export Backup Data', sub: 'Download all data as JSON', action: () => { document.querySelector('#export-backup-btn')?.click(); }, keywords: 'export backup download save data', icon: '💾' },
        ];
        commands.forEach((c) => items.push({ type: 'command', ...c }));
        setResults(items.slice(0, 16));
        setSelectedIdx(0);
        return;
      }

      const projects = await getAllProjects();
      projects.forEach((p) => {
        if (
          p.name?.toLowerCase().includes(q)
          || p.clientName?.toLowerCase().includes(q)
          || p.location?.toLowerCase().includes(q)
        ) {
          items.push({
            type: 'project',
            label: p.name,
            sub: `${p.clientName || ''} · ${p.location || ''}`,
            icon: '📁',
            action: () => navigate(`/projects/${p.id}`),
          });
        }
      });

      if (inProject) {
        ALL_MODULES.forEach((mod) => {
          const cat = MODULE_CATEGORIES.find((c) => c.modules.some((m) => m.id === mod.id));
          if (
            mod.label.toLowerCase().includes(q)
            || mod.description?.toLowerCase().includes(q)
            || cat?.label.toLowerCase().includes(q)
          ) {
            items.push({
              type: 'module',
              label: mod.label,
              sub: `${cat?.label || ''} · ${mod.description}`,
              icon: mod.icon,
              action: () => setActiveTab?.(mod.id),
            });
          }
        });
      }

      const commands = [
        { label: 'Create New Project', sub: 'Start a new project', action: () => navigate('/projects/new'), keywords: 'new create add project', icon: '➕' },
        { label: 'Go to All Projects', sub: 'View project list', action: () => navigate('/'), keywords: 'home list projects all', icon: '🏠' },
        { label: 'Export Backup Data', sub: 'Download all data as JSON', action: () => { document.querySelector('#export-backup-btn')?.click(); }, keywords: 'export backup download save data', icon: '💾' },
      ];
      commands.forEach((c) => {
        if (c.label.toLowerCase().includes(q) || c.keywords?.includes(q)) {
          items.push({ type: 'command', ...c });
        }
      });

      setResults(items.slice(0, 12));
      setSelectedIdx(0);
    }

    search();
  }, [query, navigate, inProject, setActiveTab]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[selectedIdx]) { results[selectedIdx].action(); onClose(); }
    else if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  const typeIcon = (r) => r.icon || (r.type === 'project' ? '📁' : '⚡');

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <svg className="cmd-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inProject ? 'Search modules, projects, commands...' : 'Search projects, commands...'}
          />
          <kbd className="cmd-kbd">ESC</kbd>
        </div>
        {results.length > 0 && (
          <div className="cmd-results">
            {!query && inProject && (
              <div className="cmd-section-label">Quick jump to module</div>
            )}
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.label}-${i}`}
                type="button"
                className={`cmd-result-item ${i === selectedIdx ? 'cmd-selected' : ''}`}
                onClick={() => { r.action(); onClose(); }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span className="cmd-result-type">{typeIcon(r)}</span>
                <div className="cmd-result-text">
                  <span className="cmd-result-label">{r.label}</span>
                  {r.sub && <span className="cmd-result-sub">{r.sub}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="cmd-empty">No results for &quot;{query}&quot;</div>
        )}
      </div>
    </div>
  );
}
