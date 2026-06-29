import { Link } from 'react-router-dom';
import { getModuleById } from '../config/projectModules';

export default function Topbar({ publicMode = false, projectName, activeTab, onMenuToggle, onSearchOpen }) {
  const currentModule = activeTab ? getModuleById(activeTab) : null;

  return (
    <nav className="topbar">
      <div className="topbar-left">
        {!publicMode && onMenuToggle && (
          <button className="topbar-hamburger" onClick={onMenuToggle} aria-label="Toggle sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        {publicMode && (
          <Link to="#" className="topbar-brand">
            <img src="/logo.jpg" alt="Omji Construction" className="logo-img" />
            <span>Omji Construction</span>
          </Link>
        )}
        {!publicMode && projectName && (
          <div className="topbar-breadcrumb">
            <Link to="/" className="topbar-breadcrumb-link">Projects</Link>
            <span className="topbar-breadcrumb-sep">/</span>
            <span className="topbar-breadcrumb-current">{projectName}</span>
            {currentModule && currentModule.id !== 'dashboard' && (
              <>
                <span className="topbar-breadcrumb-sep">/</span>
                <span className="topbar-breadcrumb-module">
                  {currentModule.icon} {currentModule.label}
                </span>
              </>
            )}
          </div>
        )}
        {!publicMode && !projectName && (
          <div className="topbar-breadcrumb">
            <span className="topbar-breadcrumb-current">All Projects</span>
          </div>
        )}
      </div>

      <div className="topbar-right">
        {!publicMode && onSearchOpen && (
          <button className="topbar-search-btn" onClick={onSearchOpen} title="Search (Ctrl+K)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="topbar-search-label">Search</span>
            <kbd className="topbar-kbd">⌘K</kbd>
          </button>
        )}
        {publicMode && (
          <span className="topbar-public-badge">CLIENT VIEW</span>
        )}
      </div>
    </nav>
  );
}
