import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { THEMES } from '../utils/ThemeManager';
import { Palette } from 'lucide-react';

const ThemeSwitcher = () => {
  const { selectedTheme, changeTheme } = useTheme();
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const handleThemeChange = (themeId) => {
    changeTheme(themeId);
    setShowThemeSelector(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dashboard-theme-switcher')) {
        setShowThemeSelector(false);
      }
    };

    if (showThemeSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showThemeSelector]);

  return (
    <div className="dashboard-theme-switcher">
      <button 
        className="dashboard-theme-selector-btn"
        onClick={() => setShowThemeSelector(!showThemeSelector)}
      >
        <Palette size={16} />
        Theme
      </button>
      {showThemeSelector && (
        <div className="dashboard-theme-selector-dropdown">
          <div className="dashboard-theme-section">
            <h4>Dark Themes</h4>
            <div className="dashboard-theme-grid">
              {Object.values(THEMES).filter(t => t.mode === 'dark').map(theme => (
                <button
                  key={theme.id}
                  className={`dashboard-theme-option ${selectedTheme === theme.id ? 'active' : ''}`}
                  onClick={() => handleThemeChange(theme.id)}
                  style={{ 
                    '--theme-primary': '#0b0b0c',
                    '--theme-accent': theme.accent,
                    background: `linear-gradient(135deg, #0b0b0c 0%, ${theme.accent} 100%)`
                  }}
                >
                  <span className="sparkle"></span>
                  <span className="sparkle"></span>
                  <span className="sparkle"></span>
                  {theme.name}
                  <div className="dashboard-theme-colors">
                    <div className="dashboard-theme-color-dot dashboard-theme-color-primary" style={{ background: '#0b0b0c' }}></div>
                    <div className="dashboard-theme-color-dot dashboard-theme-color-accent" style={{ background: theme.accent }}></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="dashboard-theme-section">
            <h4>Light Themes</h4>
            <div className="dashboard-theme-grid">
              {Object.values(THEMES).filter(t => t.mode === 'light').map(theme => (
                <button
                  key={theme.id}
                  className={`dashboard-theme-option ${selectedTheme === theme.id ? 'active' : ''}`}
                  onClick={() => handleThemeChange(theme.id)}
                  style={{ 
                    '--theme-primary': '#fefefe',
                    '--theme-accent': theme.accent,
                    background: `linear-gradient(135deg, #fefefe 0%, ${theme.accent} 100%)`
                  }}
                >
                  <span className="sparkle"></span>
                  <span className="sparkle"></span>
                  <span className="sparkle"></span>
                  {theme.name}
                  <div className="dashboard-theme-colors">
                    <div className="dashboard-theme-color-dot dashboard-theme-color-primary" style={{ background: '#fefefe' }}></div>
                    <div className="dashboard-theme-color-dot dashboard-theme-color-accent" style={{ background: theme.accent }}></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;