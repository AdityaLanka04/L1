export const THEMES = {
  'gold-dark': {
    id: 'gold-dark',
    name: 'Gold Monochrome',
    mode: 'dark',
    accent: '#D7B38C',
    accentHover: '#E5C9A8'
  },
  'blue-dark': {
    id: 'blue-dark',
    name: 'Ocean Blue',
    mode: 'dark',
    accent: '#3B82F6',
    accentHover: '#60A5FA'
  },
  'green-dark': {
    id: 'green-dark',
    name: 'Emerald',
    mode: 'dark',
    accent: '#10B981',
    accentHover: '#34D399'
  },
  'purple-dark': {
    id: 'purple-dark',
    name: 'Royal Purple',
    mode: 'dark',
    accent: '#8B5CF6',
    accentHover: '#A78BFA'
  },
  'rose-dark': {
    id: 'rose-dark',
    name: 'Midnight Rose',
    mode: 'dark',
    accent: '#EC4899',
    accentHover: '#F472B6'
  },
  'crimson-dark': {
    id: 'crimson-dark',
    name: 'Crimson',
    mode: 'dark',
    accent: '#DC143C',
    accentHover: '#EF4444'
  },
  'gold-light': {
    id: 'gold-light',
    name: 'Golden Hour',
    mode: 'light',
    accent: '#B8860B',
    accentHover: '#D4A017'
  },
  'blue-light': {
    id: 'blue-light',
    name: 'Azure Sky',
    mode: 'light',
    accent: '#2563EB',
    accentHover: '#3B82F6'
  },
  'green-light': {
    id: 'green-light',
    name: 'Spring Meadow',
    mode: 'light',
    accent: '#059669',
    accentHover: '#10B981'
  },
  'purple-light': {
    id: 'purple-light',
    name: 'Cotton Candy',
    mode: 'light',
    accent: '#7C3AED',
    accentHover: '#8B5CF6'
  },
  'rose-light': {
    id: 'rose-light',
    name: 'Cherry Blossom',
    mode: 'light',
    accent: '#DB2777',
    accentHover: '#EC4899'
  },
  'teal-light': {
    id: 'teal-light',
    name: 'Teal Breeze',
    mode: 'light',
    accent: '#0D9488',
    accentHover: '#14B8A6'
  }
};

const DARK_BASE = {
  '--bg-primary': '#0b0b0c',
  '--bg-secondary': '#16181d',
  '--text-primary': '#EAECEF',
  '--text-secondary': '#B8C0CC',
  '--border': '#2a2f37',
  '--success': '#10B981',
  '--warning': '#F59E0B',
  '--danger': '#EF4444'
};

const LIGHT_BASE = {
  '--bg-primary': '#fefefe',
  '--bg-secondary': '#ffffff',
  '--text-primary': '#1a1a1a',
  '--text-secondary': '#666666',
  '--border': '#e2e8f0',
  '--success': '#16A34A',
  '--warning': '#D97706',
  '--danger': '#DC2626'
};

const THEME_ALIASES = {
  'gold-monochrome': 'gold-dark',
  'royal-depths': 'purple-dark',
  'midnight-rose': 'rose-dark',
  'solar-eclipse': 'gold-dark',
  'neon-synthwave': 'rose-dark',
  'crimson-depths': 'crimson-dark',
  'champagne-light': 'gold-light',
  'ocean-breeze': 'blue-light',
  'azure-sky': 'blue-light',
  'midnight-sky': 'purple-light',
  'coral-sunset': 'gold-light',
  'spring-meadow': 'green-light',
  'golden-hour': 'gold-light',
  'rose-gold': 'rose-light',
  'cherry-blossom': 'rose-light',
  'peach-blossom': 'rose-light',
  'teal-breeze': 'teal-light',
  'cotton-candy': 'purple-light'
};

export function applyThemeToRoot(themeId) {
  const normalized = THEME_ALIASES[themeId] || themeId;
  const theme = THEMES[normalized] || THEMES['gold-dark'];
  const root = document.documentElement;
  const base = theme.mode === 'dark' ? DARK_BASE : LIGHT_BASE;

  Object.entries(base).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-hover', theme.accentHover);
  root.setAttribute('data-theme-mode', theme.mode);
  root.setAttribute('data-theme-id', theme.id);
}

export function getStoredTheme() {
  return localStorage.getItem('themeProfile') || 'gold-dark';
}

export function setStoredTheme(themeId) {
  localStorage.setItem('themeProfile', themeId);
}

export function getCurrentTheme(themeId) {
  const normalized = THEME_ALIASES[themeId] || themeId;
  const theme = THEMES[normalized] || THEMES['gold-dark'];
  
  // Return with tokens for backward compatibility
  const base = theme.mode === 'dark' ? DARK_BASE : LIGHT_BASE;
  return {
    ...theme,
    family: theme.mode === 'dark' ? 'Dark' : 'Light',
    tokens: {
      '--accent': theme.accent,
      '--accent-2': theme.accentHover,
      ...base,
      '--bg-top': theme.mode === 'dark' ? '#0b0b0c' : '#fefefe',
      '--bg-bottom': theme.mode === 'dark' ? '#0f1012' : '#f8f9fa',
      '--panel': theme.mode === 'dark' ? '#16181d' : '#ffffff',
      '--primary': theme.mode === 'dark' ? '#16181d' : '#ffffff',
      '--primary-contrast': theme.mode === 'dark' ? '#EAECEF' : '#1a1a1a',
      '--hero-bg': theme.mode === 'dark' ? '#16181d' : '#ffffff',
      '--hero-text': theme.mode === 'dark' ? '#EAECEF' : '#1a1a1a',
      '--glow': `rgba(${hexToRgb(theme.accent).r}, ${hexToRgb(theme.accent).g}, ${hexToRgb(theme.accent).b}, 0.35)`
    }
  };
}

export function getThemesByMode(mode) {
  return Object.values(THEMES).filter(theme => theme.mode === mode);
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

export function rgbaFromHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const THEME_PROFILES = Object.values(THEMES).map(t => ({
  id: t.id,
  name: t.name,
  mode: t.mode,
  family: t.mode === 'dark' ? 'Dark' : 'Light',
  tokens: {
    '--accent': t.accent,
    '--accent-2': t.accentHover,
    ...(t.mode === 'dark' ? DARK_BASE : LIGHT_BASE),
    '--bg-top': t.mode === 'dark' ? '#0b0b0c' : '#fefefe',
    '--bg-bottom': t.mode === 'dark' ? '#0f1012' : '#f8f9fa',
    '--panel': t.mode === 'dark' ? '#16181d' : '#ffffff',
    '--primary': t.mode === 'dark' ? '#16181d' : '#ffffff',
    '--primary-contrast': t.mode === 'dark' ? '#EAECEF' : '#1a1a1a',
    '--hero-bg': t.mode === 'dark' ? '#16181d' : '#ffffff',
    '--hero-text': t.mode === 'dark' ? '#EAECEF' : '#1a1a1a',
    '--glow': `rgba(${hexToRgb(t.accent).r}, ${hexToRgb(t.accent).g}, ${hexToRgb(t.accent).b}, 0.35)`
  }
}));