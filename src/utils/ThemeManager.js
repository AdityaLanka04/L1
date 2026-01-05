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

// Color palette for custom theme picker
export const COLOR_PALETTE = [
  { name: 'Gold', value: '#D7B38C' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Rose', value: '#EC4899' },
  { name: 'Crimson', value: '#DC143C' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Lime', value: '#84CC16' }
];

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
  
  // Dashboard-specific variables
  root.style.setProperty('--dashboard-accent', theme.accent);
  root.style.setProperty('--dashboard-bg-primary', theme.mode === 'dark' ? '#0b0b0c' : '#fefefe');
  
  // Glow effect
  const { r, g, b } = hexToRgb(theme.accent);
  root.style.setProperty('--glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
  
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
      '--glow': `rgba(${hexToRgb(theme.accent).r}, ${hexToRgb(theme.accent).g}, ${hexToRgb(theme.accent).b}, 0.35)`,
      '--dashboard-accent': theme.accent,
      '--dashboard-bg-primary': theme.mode === 'dark' ? '#0b0b0c' : '#fefefe'
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
    '--glow': `rgba(${hexToRgb(t.accent).r}, ${hexToRgb(t.accent).g}, ${hexToRgb(t.accent).b}, 0.35)`,
    '--dashboard-accent': t.accent,
    '--dashboard-bg-primary': t.mode === 'dark' ? '#0b0b0c' : '#fefefe'
  }
}));


// Custom theme support
export function getCustomTheme() {
  const stored = localStorage.getItem('customTheme');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Return with full tokens for compatibility
      return buildCustomThemeTokens(parsed);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function setCustomTheme(primaryColor, accentColor, mode = 'dark') {
  const customTheme = {
    id: 'custom',
    name: 'Custom Theme',
    mode,
    primary: primaryColor,
    accent: accentColor,
    accentHover: lightenColor(accentColor, 15)
  };
  localStorage.setItem('customTheme', JSON.stringify(customTheme));
  return buildCustomThemeTokens(customTheme);
}

function buildCustomThemeTokens(customTheme) {
  if (!customTheme) return null;
  
  const primaryColor = customTheme.primary || (customTheme.mode === 'dark' ? '#0b0b0c' : '#fefefe');
  const accentColor = customTheme.accent || '#D7B38C';
  const accentHover = customTheme.accentHover || lightenColor(accentColor, 15);
  
  // Generate derived colors from primary
  const bgSecondary = customTheme.mode === 'dark' 
    ? lightenColor(primaryColor, 6) 
    : darkenColor(primaryColor, 2);
  const borderColor = customTheme.mode === 'dark'
    ? lightenColor(primaryColor, 12)
    : darkenColor(primaryColor, 10);
  
  const tokens = {
    '--bg-primary': primaryColor,
    '--bg-secondary': bgSecondary,
    '--bg-top': primaryColor,
    '--bg-bottom': customTheme.mode === 'dark' ? lightenColor(primaryColor, 3) : darkenColor(primaryColor, 1),
    '--panel': bgSecondary,
    '--primary': bgSecondary,
    '--primary-contrast': customTheme.mode === 'dark' ? '#EAECEF' : '#1a1a1a',
    '--text-primary': customTheme.mode === 'dark' ? '#EAECEF' : '#1a1a1a',
    '--text-secondary': customTheme.mode === 'dark' ? '#B8C0CC' : '#666666',
    '--border': borderColor,
    '--accent': accentColor,
    '--accent-2': accentHover,
    '--accent-hover': accentHover,
    '--hero-bg': bgSecondary,
    '--hero-text': customTheme.mode === 'dark' ? '#EAECEF' : '#1a1a1a',
    '--success': customTheme.mode === 'dark' ? '#10B981' : '#16A34A',
    '--warning': customTheme.mode === 'dark' ? '#F59E0B' : '#D97706',
    '--danger': customTheme.mode === 'dark' ? '#EF4444' : '#DC2626',
    '--glow': `rgba(${hexToRgb(accentColor).r}, ${hexToRgb(accentColor).g}, ${hexToRgb(accentColor).b}, 0.35)`,
    // Dashboard-specific variables
    '--dashboard-accent': accentColor,
    '--dashboard-bg-primary': primaryColor
  };
  
  return {
    ...customTheme,
    primary: primaryColor,
    accent: accentColor,
    accentHover,
    tokens,
    family: customTheme.mode === 'dark' ? 'Dark' : 'Light'
  };
}

export function applyCustomTheme(customTheme) {
  if (!customTheme) return;
  
  const root = document.documentElement;
  const themeWithTokens = customTheme.tokens ? customTheme : buildCustomThemeTokens(customTheme);
  
  if (themeWithTokens && themeWithTokens.tokens) {
    // Apply ALL tokens to root
    Object.entries(themeWithTokens.tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  root.setAttribute('data-theme-mode', customTheme.mode);
  root.setAttribute('data-theme-id', 'custom');
}

export function lightenColor(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const amount = Math.round(2.55 * percent);
  const newR = Math.min(255, r + amount);
  const newG = Math.min(255, g + amount);
  const newB = Math.min(255, b + amount);
  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

export function darkenColor(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const amount = Math.round(2.55 * percent);
  const newR = Math.max(0, r - amount);
  const newG = Math.max(0, g - amount);
  const newB = Math.max(0, b - amount);
  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

// Primary color palette (background colors)
export const PRIMARY_PALETTE = {
  dark: [
    { name: 'Midnight', value: '#0b0b0c' },
    { name: 'Charcoal', value: '#1a1a2e' },
    { name: 'Navy', value: '#0f1729' },
    { name: 'Forest', value: '#0d1912' },
    { name: 'Wine', value: '#1a0f14' },
    { name: 'Slate', value: '#1e293b' }
  ],
  light: [
    { name: 'Snow', value: '#fefefe' },
    { name: 'Cream', value: '#faf8f5' },
    { name: 'Ice', value: '#f0f9ff' },
    { name: 'Mint', value: '#f0fdf4' },
    { name: 'Blush', value: '#fdf2f8' },
    { name: 'Pearl', value: '#f8fafc' }
  ]
};
