import React, { createContext, useContext, useState, useLayoutEffect } from 'react';
import { 
  THEME_PROFILES, 
  applyThemeToRoot, 
  getStoredTheme, 
  setStoredTheme, 
  getCurrentTheme 
} from '../utils/ThemeManager';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [selectedThemeId, setSelectedThemeId] = useState(getStoredTheme);
  const selectedTheme = getCurrentTheme(selectedThemeId);

  // Apply theme immediately when it changes (before paint)
  useLayoutEffect(() => {
    applyThemeToRoot(selectedThemeId);
    setStoredTheme(selectedThemeId);
  }, [selectedThemeId]);

  const changeTheme = (themeId) => {
    setSelectedThemeId(themeId);
  };

  const value = {
    selectedThemeId,
    selectedTheme,
    changeTheme,
    themes: THEME_PROFILES
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};