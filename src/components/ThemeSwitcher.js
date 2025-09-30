import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { rgbaFromHex } from '../utils/ThemeManager';

const ThemeSwitcher = () => {
  const { selectedTheme, changeTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleThemeSelect = (themeId) => {
    changeTheme(themeId);
    setIsOpen(false);
  };


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.theme-switcher-dropdown')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Group themes into three columns
  const groupThemesIntoColumns = (themes) => {
    const column1 = [];
    const column2 = [];
    const column3 = [];
    
    themes.forEach((theme, index) => {
      if (index % 3 === 0) {
        column1.push(theme);
      } else if (index % 3 === 1) {
        column2.push(theme);
      } else {
        column3.push(theme);
      }
    });
    
    return [column1, column2, column3];
  };

  const [column1, column2, column3] = groupThemesIntoColumns(themes);

  return (
    <div className="theme-switcher-dropdown">
      <button 
        className="theme-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: `linear-gradient(135deg, ${selectedTheme.tokens['--panel']} 0%, ${selectedTheme.tokens['--bg-bottom']} 100%)`,
          borderColor: selectedTheme.tokens['--border'],
          color: selectedTheme.tokens['--text-primary']
        }}
      >
        <div className="theme-preview">
          <span
            className="theme-dot"
            style={{ background: selectedTheme.tokens['--accent'] }}
          />
        </div>
        <span className="theme-name">{selectedTheme.name}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <>
          <div className="dropdown-overlay" onClick={() => setIsOpen(false)} />
          <div 
            className="theme-dropdown-menu"
            style={{
              background: selectedTheme.tokens['--panel'],
              borderColor: selectedTheme.tokens['--border'],
              boxShadow: `0 8px 32px ${rgbaFromHex(selectedTheme.tokens['--accent'], 0.15)}`
            }}
          >
            <div className="dropdown-header" style={{ color: selectedTheme.tokens['--text-secondary'] }}>
              Choose Theme
            </div>
            
            <div className="theme-options-container">
              <div className="theme-grid">
                {/* Column 1 */}
                <div className="theme-column">
                  {column1.map(theme => (
                    <button
                      key={theme.id}
                      className={`theme-option ${selectedTheme.id === theme.id ? 'active' : ''}`}
                      onClick={() => handleThemeSelect(theme.id)}
                      style={{
                        borderColor: selectedTheme.id === theme.id 
                          ? theme.tokens['--accent']
                          : 'transparent'
                      }}
                    >
                      <div className="theme-option-preview">
                        <span
                          className="theme-dot"
                          style={{ background: theme.tokens['--accent'] }}
                        />
                      </div>
                      <div className="theme-option-info">
                        <div 
                          className="theme-option-name"
                          style={{ color: selectedTheme.tokens['--text-primary'] }}
                        >
                          {theme.name}
                        </div>
                        <div 
                          className="theme-option-family"
                          style={{ color: selectedTheme.tokens['--text-secondary'] }}
                        >
                          {theme.family}
                        </div>
                      </div>
                      {selectedTheme.id === theme.id && (
                        <div className="theme-check" style={{ color: theme.tokens['--accent'] }}>
                          ✓
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Column 2 */}
                <div className="theme-column">
                  {column2.map(theme => (
                    <button
                      key={theme.id}
                      className={`theme-option ${selectedTheme.id === theme.id ? 'active' : ''}`}
                      onClick={() => handleThemeSelect(theme.id)}
                      style={{
                        borderColor: selectedTheme.id === theme.id 
                          ? theme.tokens['--accent']
                          : 'transparent'
                      }}
                    >
                      <div className="theme-option-preview">
                        <span
                          className="theme-dot"
                          style={{ background: theme.tokens['--accent'] }}
                        />
                      </div>
                      <div className="theme-option-info">
                        <div 
                          className="theme-option-name"
                          style={{ color: selectedTheme.tokens['--text-primary'] }}
                        >
                          {theme.name}
                        </div>
                        <div 
                          className="theme-option-family"
                          style={{ color: selectedTheme.tokens['--text-secondary'] }}
                        >
                          {theme.family}
                        </div>
                      </div>
                      {selectedTheme.id === theme.id && (
                        <div className="theme-check" style={{ color: theme.tokens['--accent'] }}>
                          ✓
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Column 3 */}
                <div className="theme-column">
                  {column3.map(theme => (
                    <button
                      key={theme.id}
                      className={`theme-option ${selectedTheme.id === theme.id ? 'active' : ''}`}
                      onClick={() => handleThemeSelect(theme.id)}
                      style={{
                        borderColor: selectedTheme.id === theme.id 
                          ? theme.tokens['--accent']
                          : 'transparent'
                      }}
                    >
                      <div className="theme-option-preview">
                        <span
                          className="theme-dot"
                          style={{ background: theme.tokens['--accent'] }}
                        />
                      </div>
                      <div className="theme-option-info">
                        <div 
                          className="theme-option-name"
                          style={{ color: selectedTheme.tokens['--text-primary'] }}
                        >
                          {theme.name}
                        </div>
                        <div 
                          className="theme-option-family"
                          style={{ color: selectedTheme.tokens['--text-secondary'] }}
                        >
                          {theme.family}
                        </div>
                      </div>
                      {selectedTheme.id === theme.id && (
                        <div className="theme-check" style={{ color: theme.tokens['--accent'] }}>
                          ✓
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


export default ThemeSwitcher;