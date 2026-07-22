import { useState } from 'react';
import { MODULE_CATEGORIES, getCoreMobileTabs, getModuleById } from '../config/projectModules';

export default function MobileModuleNav({ activeTab, setActiveTab }) {
  const [showMore, setShowMore] = useState(false);
  const coreTabs = getCoreMobileTabs();

  const isSecondaryActive = !coreTabs.some((t) => t.id === activeTab) && activeTab !== 'dashboard';
  const activeSecondary = isSecondaryActive ? getModuleById(activeTab) : null;

  return (
    <>
      <div className="mobile-module-nav">
        {coreTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mobile-module-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setShowMore(false);
            }}
          >
            <span className="mobile-module-icon">{tab.icon}</span>
            <span className="mobile-module-label">
              {tab.id === 'visual' ? 'Building' : tab.label.split(' ')[0]}
            </span>
          </button>
        ))}
        <button
          type="button"
          className={`mobile-module-btn ${isSecondaryActive ? 'active' : ''}`}
          onClick={() => setShowMore((prev) => !prev)}
        >
          <span className="mobile-module-icon">{activeSecondary ? activeSecondary.icon : '⋯'}</span>
          <span className="mobile-module-label">
            {activeSecondary ? activeSecondary.label.split(' ')[0] : 'More'}
          </span>
        </button>
      </div>

      <div
        className={`mobile-sheet-overlay ${showMore ? 'active' : ''}`}
        onClick={() => setShowMore(false)}
      />
      <div className={`mobile-sheet-content ${showMore ? 'active' : ''}`}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-title-row">
          <div>
            <h3>All Modules</h3>
            <p className="mobile-sheet-subtitle">Organized by category — tap to open</p>
          </div>
          <button type="button" className="mobile-sheet-close" onClick={() => setShowMore(false)}>✕</button>
        </div>

        {MODULE_CATEGORIES.map((category) => (
          <div key={category.id} className="mobile-sheet-category">
            <div className="mobile-sheet-category-label">
              <span>{category.icon}</span> {category.label}
            </div>
            <div className="mobile-sheet-grid">
              {category.modules.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`mobile-sheet-grid-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowMore(false);
                  }}
                >
                  <span className="mobile-sheet-grid-icon">{tab.icon}</span>
                  <span className="mobile-sheet-grid-label">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
