import React, { createContext, useContext, useState, useLayoutEffect, useCallback } from 'react';
import { 
  THEME_PROFILES, 
  applyThemeToRoot, 
  getStoredTheme, 
  setStoredTheme, 
  getCurrentTheme,
  getCustomTheme,
  setCustomTheme as setCustomThemeStorage,
  applyCustomTheme
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
  const [customTheme, setCustomThemeState] = useState(getCustomTheme);
  
  // Get the selected theme with full tokens
  const selectedTheme = selectedThemeId === 'custom' && customTheme 
    ? customTheme 
    : getCurrentTheme(selectedThemeId);

  // Apply theme immediately when it changes (before paint)
  useLayoutEffect(() => {
    if (selectedThemeId === 'custom' && customTheme) {
      applyCustomTheme(customTheme);
    } else {
      applyThemeToRoot(selectedThemeId);
    }
    setStoredTheme(selectedThemeId);
  }, [selectedThemeId, customTheme]);

  const changeTheme = useCallback((themeId) => {
    setSelectedThemeId(themeId);
  }, []);

  const applyCustomColors = useCallback((primaryColor, accentColor, mode = 'dark') => {
    // This returns the full theme object with tokens
    const newCustomTheme = setCustomThemeStorage(primaryColor, accentColor, mode);
    setCustomThemeState(newCustomTheme);
    setSelectedThemeId('custom');
  }, []);

  const value = {
    selectedThemeId,
    selectedTheme,
    customTheme,
    changeTheme,
    applyCustomColors,
    themes: THEME_PROFILES
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};