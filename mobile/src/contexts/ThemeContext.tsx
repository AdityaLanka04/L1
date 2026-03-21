import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  COLOR_PALETTE,
  PRIMARY_PALETTE,
  THEME_PROFILES,
  ThemeMode,
  MobileTheme,
  StoredCustomTheme,
  buildCustomTheme,
  getDefaultTheme,
  getStoredCustomTheme,
  getStoredThemeId,
  getThemeById,
  setStoredCustomTheme,
  setStoredThemeId,
} from '../utils/theme';

type ThemeContextValue = {
  ready: boolean;
  selectedThemeId: string;
  selectedTheme: MobileTheme;
  customTheme: MobileTheme | null;
  themes: typeof THEME_PROFILES;
  colorPalette: typeof COLOR_PALETTE;
  primaryPalette: typeof PRIMARY_PALETTE;
  changeTheme: (themeId: string) => Promise<void>;
  applyCustomColors: (primaryColor: string, accentColor: string, mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('gold-dark');
  const [customTheme, setCustomTheme] = useState<MobileTheme | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [storedThemeId, storedCustomTheme] = await Promise.all([
        getStoredThemeId(),
        getStoredCustomTheme(),
      ]);

      if (!mounted) return;
      setSelectedThemeId(storedThemeId);
      setCustomTheme(storedCustomTheme ? buildCustomTheme(storedCustomTheme as StoredCustomTheme) : null);
      setReady(true);
    };

    load().catch(() => {
      if (!mounted) return;
      setSelectedThemeId('gold-dark');
      setCustomTheme(null);
      setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedTheme = useMemo(() => {
    if (selectedThemeId === 'custom' && customTheme) return customTheme;
    return getThemeById(selectedThemeId);
  }, [selectedThemeId, customTheme]);

  const changeTheme = useCallback(async (themeId: string) => {
    setSelectedThemeId(themeId);
    await setStoredThemeId(themeId);
  }, []);

  const applyCustomColors = useCallback(async (primaryColor: string, accentColor: string, mode: ThemeMode) => {
    const nextTheme = await setStoredCustomTheme(primaryColor, accentColor, mode);
    setCustomTheme(nextTheme);
    setSelectedThemeId('custom');
    await setStoredThemeId('custom');
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    ready,
    selectedThemeId,
    selectedTheme: ready ? selectedTheme : getDefaultTheme(),
    customTheme,
    themes: THEME_PROFILES,
    colorPalette: COLOR_PALETTE,
    primaryPalette: PRIMARY_PALETTE,
    changeTheme,
    applyCustomColors,
  }), [ready, selectedThemeId, selectedTheme, customTheme, changeTheme, applyCustomColors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
}
