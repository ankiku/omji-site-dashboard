import { MODULE_CATEGORIES } from '../config/projectModules';

export default function ModuleHub({ activeTab, setActiveTab, compact = false }) {
  return (
    <div className={`module-hub ${compact ? 'module-hub-compact' : ''}`}>
      <div className="module-hub-intro">
        <h2 className="module-hub-title">Project Modules</h2>
        <p className="module-hub-subtitle">
          Everything organized in one place — tap any module to jump straight in.
        </p>
      </div>

      <div className="module-hub-categories">
        {MODULE_CATEGORIES.map((category) => (
          <section key={category.id} className="module-hub-category">
            <header className="module-hub-category-header">
              <span className="module-hub-category-icon" aria-hidden>{category.icon}</span>
              <div>
                <h3 className="module-hub-category-label">{category.label}</h3>
                {!compact && (
                  <p className="module-hub-category-desc">{category.description}</p>
                )}
              </div>
            </header>
            <div className="module-hub-grid">
              {category.modules.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  className={`module-hub-card ${activeTab === mod.id ? 'active' : ''} ${mod.highlight ? 'highlight' : ''}`}
                  onClick={() => setActiveTab(mod.id)}
                >
                  <span className="module-hub-card-icon" aria-hidden>{mod.icon}</span>
                  <span className="module-hub-card-label">{mod.label}</span>
                  {!compact && (
                    <span className="module-hub-card-desc">{mod.description}</span>
                  )}
                  {activeTab === mod.id && (
                    <span className="module-hub-card-active-dot" aria-label="Current module" />
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
