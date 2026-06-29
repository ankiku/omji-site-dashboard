import { getModuleById, getCategoryForModule } from '../config/projectModules';

export default function ModulePageHeader({ activeTab, setActiveTab }) {
  const mod = getModuleById(activeTab);
  const category = getCategoryForModule(activeTab);

  if (!mod || activeTab === 'dashboard') return null;

  return (
    <div className="module-page-header">
      <div className="module-page-header-main">
        <button
          type="button"
          className="module-page-back"
          onClick={() => setActiveTab('dashboard')}
          aria-label="Back to dashboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Dashboard</span>
        </button>
        <div className="module-page-title-row">
          <span className="module-page-icon" aria-hidden>{mod.icon}</span>
          <div>
            <h2 className="module-page-title">{mod.label}</h2>
            {category && (
              <span className="module-page-breadcrumb">
                {category.icon} {category.label}
              </span>
            )}
          </div>
        </div>
        <p className="module-page-desc">{mod.description}</p>
      </div>
    </div>
  );
}
