import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { MODULE_CATEGORIES } from '../config/projectModules';

const DEFAULT_EXPANDED = Object.fromEntries(
  MODULE_CATEGORIES.map((c) => [c.id, false])
);

function loadExpandedState() {
  try {
    const saved = localStorage.getItem('osr_sidebar_groups_v2');
    if (saved) return { ...DEFAULT_EXPANDED, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return DEFAULT_EXPANDED;
}

export default function Sidebar({
  collapsed, setCollapsed, mobileOpen, setMobileOpen,
  activeTab, setActiveTab, inProject = false,
}) {
  const location = useLocation();
  const { userProfile, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [expandedGroups, setExpandedGroups] = useState(loadExpandedState);

  const isCollapsed = collapsed && !mobileOpen;

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    if (mobileOpen) setMobileOpen(false);
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      localStorage.setItem('osr_sidebar_groups_v2', JSON.stringify(next));
      return next;
    });
  };

  // Auto-expand the group that contains the active tab
  useEffect(() => {
    if (activeTab) {
      const activeCategory = MODULE_CATEGORIES.find(c => c.modules.some(m => m.id === activeTab));
      if (activeCategory && expandedGroups[activeCategory.id] === false) {
        setExpandedGroups(prev => {
          const next = { ...prev, [activeCategory.id]: true };
          localStorage.setItem('osr_sidebar_groups_v2', JSON.stringify(next));
          return next;
        });
      }
    }
  }, [activeTab]);

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <Link to="/" className="sidebar-logo" onClick={() => mobileOpen && setMobileOpen(false)}>
            <img src="/logo.jpg" alt="Omji Construction" className="logo-img" />
            {!isCollapsed && <span className="sidebar-logo-text">Omji Site Register</span>}
          </Link>
          <button
            className="sidebar-toggle"
            onClick={() => { setCollapsed(!collapsed); if (mobileOpen) setMobileOpen(false); }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed
                ? <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
                : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            {!isCollapsed && <div className="sidebar-section-label">Navigation</div>}
            <Link
              to="/"
              className={`sidebar-item ${location.pathname === '/' ? 'active' : ''}`}
              onClick={() => mobileOpen && setMobileOpen(false)}
            >
              <span className="sidebar-item-icon">🏠</span>
              {!isCollapsed && <span className="sidebar-item-label">All Projects</span>}
            </Link>
            {isAdmin && (
              <Link
                to="/projects/new"
                className={`sidebar-item ${location.pathname === '/projects/new' ? 'active' : ''}`}
                onClick={() => mobileOpen && setMobileOpen(false)}
              >
                <span className="sidebar-item-icon">➕</span>
                {!isCollapsed && <span className="sidebar-item-label">New Project</span>}
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/users"
                className={`sidebar-item ${location.pathname === '/users' ? 'active' : ''}`}
                onClick={() => mobileOpen && setMobileOpen(false)}
              >
                <span className="sidebar-item-icon">👥</span>
                {!isCollapsed && <span className="sidebar-item-label">User Access</span>}
              </Link>
            )}
            <Link
              to="/change-password"
              className={`sidebar-item ${location.pathname === '/change-password' ? 'active' : ''}`}
              onClick={() => mobileOpen && setMobileOpen(false)}
            >
              <span className="sidebar-item-icon">🔑</span>
              {!isCollapsed && <span className="sidebar-item-label">Change Password</span>}
            </Link>
          </div>

          {inProject && (
            <div className="sidebar-section sidebar-modules-section">
              {!isCollapsed && (
                <div className="sidebar-section-label sidebar-modules-label">
                  Project Modules
                  <span className="sidebar-module-count">
                    {MODULE_CATEGORIES.reduce((n, c) => n + c.modules.length, 0)}
                  </span>
                </div>
              )}
              {MODULE_CATEGORIES.map((category) => {
                const isOpen = isCollapsed || expandedGroups[category.id] !== false;
                const hasActive = category.modules.some((m) => m.id === activeTab);

                return (
                  <div key={category.id} className={`sidebar-group ${hasActive ? 'has-active' : ''}`}>
                    {!isCollapsed && (
                      <button
                        type="button"
                        className="sidebar-group-toggle"
                        onClick={() => toggleGroup(category.id)}
                        aria-expanded={isOpen}
                      >
                        <span className="sidebar-group-icon">{category.icon}</span>
                        <span className="sidebar-group-label">{category.label}</span>
                        <svg
                          className={`sidebar-group-chevron ${isOpen ? 'open' : ''}`}
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}
                    {(isOpen || isCollapsed) && (
                      <div className="sidebar-group-items">
                        {category.modules.map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            className={`sidebar-item sidebar-module-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleNavClick(tab.id)}
                            title={isCollapsed ? tab.label : undefined}
                          >
                            <span className="sidebar-item-icon">{tab.icon}</span>
                            {!isCollapsed && <span className="sidebar-item-label">{tab.label}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-item sidebar-theme-btn" onClick={toggleTheme}>
            <span className="sidebar-item-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            {!isCollapsed && <span className="sidebar-item-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {(userProfile?.name || userProfile?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{userProfile?.name || userProfile?.email}</span>
                <span className="sidebar-user-role">{userProfile?.role?.toUpperCase()}</span>
              </div>
            )}
            {!isCollapsed && (
              <button type="button" className="sidebar-logout-btn" onClick={logout} title="Logout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
