// Theme profiles with all color tokens - Enhanced with proper color theory
export const THEME_PROFILES = [
  // === DARK THEMES ===
  {
    id: 'gold-monochrome',
    name: 'Gold Monochrome',
    family: 'Monochrome',
    mode: 'dark',
    tokens: {
      '--bg-top': '#0a0a0b',
      '--bg-bottom': '#1a1a1f',
      '--panel': '#16181d',
      '--border': '#2a2f37',
      '--text-primary': '#EAECEF',
      '--text-secondary': '#B8C0CC',
      '--accent': '#D7B38C',
      '--accent-2': '#B88F63',
      '--success': '#4ade80',
      '--warning': '#f59e0b',
      '--danger': '#ef4444',
      '--glow': 'rgba(215,179,140,0.35)',
    },
  },
  {
    id: 'teal-complementary',
    name: 'Teal Ocean',
    family: 'Complementary',
    mode: 'dark',
    tokens: {
      '--bg-top': '#051519',
      '--bg-bottom': '#0f2429',
      '--panel': '#141b1d',
      '--border': '#253033',
      '--text-primary': '#E8FAFA',
      '--text-secondary': '#B6D2D2',
      '--accent': '#14B8A6',
      '--accent-2': '#D97706',
      '--success': '#34d399',
      '--warning': '#fbbf24',
      '--danger': '#f87171',
      '--glow': 'rgba(20,184,166,0.35)',
    },
  },
  {
    id: 'royal-purple',
    name: 'Royal Depths',
    family: 'Split-Complementary',
    mode: 'dark',
    tokens: {
      '--bg-top': '#0d0b15',
      '--bg-bottom': '#1a0f2e',
      '--panel': '#151220',
      '--border': '#2d2440',
      '--text-primary': '#F8F7FF',
      '--text-secondary': '#D4CFEA',
      '--accent': '#8B5CF6',
      '--accent-2': '#F59E0B',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(139,92,246,0.4)',
    },
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    family: 'Triadic',
    mode: 'dark',
    tokens: {
      '--bg-top': '#0a1512',
      '--bg-bottom': '#0f2a1e',
      '--panel': '#132318',
      '--border': '#1f3d2b',
      '--text-primary': '#ECFDF5',
      '--text-secondary': '#D1FAE5',
      '--accent': '#10B981',
      '--accent-2': '#EC4899',
      '--success': '#22C55E',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(16,185,129,0.35)',
    },
  },
  {
    id: 'cosmic-blue',
    name: 'Cosmic Blue',
    family: 'Tetradic',
    mode: 'dark',
    tokens: {
      '--bg-top': '#0b1121',
      '--bg-bottom': '#1e2951',
      '--panel': '#161f3a',
      '--border': '#2a3d66',
      '--text-primary': '#F0F4FF',
      '--text-secondary': '#C7D2FE',
      '--accent': '#3B82F6',
      '--accent-2': '#F97316',
      '--success': '#22C55E',
      '--warning': '#F59E0B',
      '--danger': '#DC2626',
      '--glow': 'rgba(59,130,246,0.4)',
    },
  },
  {
    id: 'sunset-warmth',
    name: 'Sunset Warmth',
    family: 'Analogous',
    mode: 'dark',
    tokens: {
      '--bg-top': '#1a0f0a',
      '--bg-bottom': '#3d1a0f',
      '--panel': '#2a1611',
      '--border': '#4a2518',
      '--text-primary': '#FFF8F1',
      '--text-secondary': '#FDBA74',
      '--accent': '#EA580C',
      '--accent-2': '#DC2626',
      '--success': '#22C55E',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(234,88,12,0.4)',
    },
  },
  {
    id: 'midnight-rose',
    name: 'Midnight Rose',
    family: 'Complementary',
    mode: 'dark',
    tokens: {
      '--bg-top': '#1a0b14',
      '--bg-bottom': '#2d1327',
      '--panel': '#241520',
      '--border': '#3d2235',
      '--text-primary': '#FDF2F8',
      '--text-secondary': '#F9A8D4',
      '--accent': '#EC4899',
      '--accent-2': '#10B981',
      '--success': '#22C55E',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(236,72,153,0.35)',
    },
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    family: 'High Contrast',
    mode: 'dark',
    tokens: {
      '--bg-top': '#000000',
      '--bg-bottom': '#0a0a0a',
      '--panel': '#111111',
      '--border': '#333333',
      '--text-primary': '#00FF00',
      '--text-secondary': '#00CC00',
      '--accent': '#00FFFF',
      '--accent-2': '#FF00FF',
      '--success': '#00FF00',
      '--warning': '#FFFF00',
      '--danger': '#FF0000',
      '--glow': 'rgba(0,255,255,0.5)',
    },
  },

  // === LIGHT THEMES ===
  {
    id: 'champagne-light',
    name: 'Champagne Light',
    family: 'Monochrome',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F8F6F3',
      '--panel': '#FFFFFF',
      '--border': '#E5E1DC',
      '--text-primary': '#2D2A26',
      '--text-secondary': '#5C5852',
      '--accent': '#B8860B',
      '--accent-2': '#8B6914',
      '--success': '#16A34A',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--glow': 'rgba(184,134,11,0.15)',
    },
  },
  {
    id: 'ocean-breeze-light',
    name: 'Ocean Breeze',
    family: 'Complementary',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F0FDFA',
      '--panel': '#FFFFFF',
      '--border': '#CCFBF1',
      '--text-primary': '#134E4A',
      '--text-secondary': '#0F766E',
      '--accent': '#0D9488',
      '--accent-2': '#EA580C',
      '--success': '#059669',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--glow': 'rgba(13,148,136,0.2)',
    },
  },
  {
    id: 'lavender-dream-light',
    name: 'Lavender Dream',
    family: 'Split-Complementary',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F8F6FF',
      '--panel': '#FFFFFF',
      '--border': '#E9E5FF',
      '--text-primary': '#4C1D95',
      '--text-secondary': '#6D28D9',
      '--accent': '#8B5CF6',
      '--accent-2': '#F59E0B',
      '--success': '#059669',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--glow': 'rgba(139,92,246,0.15)',
    },
  },
  {
    id: 'spring-meadow-light',
    name: 'Spring Meadow',
    family: 'Triadic',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F0FDF4',
      '--panel': '#FFFFFF',
      '--border': '#DCFCE7',
      '--text-primary': '#14532D',
      '--text-secondary': '#166534',
      '--accent': '#22C55E',
      '--accent-2': '#EC4899',
      '--success': '#16A34A',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--glow': 'rgba(34,197,94,0.15)',
    },
  },
  {
    id: 'azure-sky-light',
    name: 'Azure Sky',
    family: 'Tetradic',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#EFF6FF',
      '--panel': '#FFFFFF',
      '--border': '#DBEAFE',
      '--text-primary': '#1E3A8A',
      '--text-secondary': '#1D4ED8',
      '--accent': '#3B82F6',
      '--accent-2': '#F97316',
      '--success': '#059669',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--glow': 'rgba(59,130,246,0.15)',
    },
  },
  {
    id: 'coral-sunset-light',
    name: 'Coral Sunset',
    family: 'Analogous',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#FFF7ED',
      '--panel': '#FFFFFF',
      '--border': '#FED7AA',
      '--text-primary': '#9A3412',
      '--text-secondary': '#C2410C',
      '--accent': '#EA580C',
      '--accent-2': '#DC2626',
      '--success': '#059669',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--glow': 'rgba(234,88,12,0.15)',
    },
  },
  {
    id: 'cherry-blossom-light',
    name: 'Cherry Blossom',
    family: 'Complementary',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#FDF2F8',
      '--panel': '#FFFFFF',
      '--border': '#FBCFE8',
      '--text-primary': '#831843',
      '--text-secondary': '#BE185D',
      '--accent': '#EC4899',
      '--accent-2': '#10B981',
      '--success': '#059669',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--glow': 'rgba(236,72,153,0.15)',
    },
  },
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    family: 'High Contrast',
    mode: 'light',
    tokens: {
      '--bg-top': '#FFFFFF',
      '--bg-bottom': '#FAFAFA',
      '--panel': '#FFFFFF',
      '--border': '#E5E5E5',
      '--text-primary': '#000000',
      '--text-secondary': '#525252',
      '--accent': '#404040',
      '--accent-2': '#737373',
      '--success': '#16A34A',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--glow': 'rgba(64,64,64,0.1)',
    },
  },

  // === NEW PREMIUM THEMES ===
  
  // Split-Complementary: Deep Amber + Blue-Violet + Red-Violet
  {
    id: 'amber-twilight',
    name: 'Amber Twilight',
    family: 'Split-Complementary',
    mode: 'dark',
    tokens: {
      '--bg-top': '#0f0a05',
      '--bg-bottom': '#2a1a0f',
      '--panel': '#1a1208',
      '--border': '#3d2817',
      '--text-primary': '#FFF8E1',
      '--text-secondary': '#FFE0B2',
      '--accent': '#FF8F00',
      '--accent-2': '#5E35B1',
      '--success': '#4CAF50',
      '--warning': '#FF6F00',
      '--danger': '#C2185B',
      '--glow': 'rgba(255,143,0,0.4)',
    },
  },

  // Triadic: Crimson + Emerald + Sapphire
  {
    id: 'crimson-depths',
    name: 'Crimson Depths',
    family: 'Triadic',
    mode: 'dark',
    tokens: {
      '--bg-top': '#1a0510',
      '--bg-bottom': '#330a1f',
      '--panel': '#220815',
      '--border': '#4a1b2e',
      '--text-primary': '#FFE4E9',
      '--text-secondary': '#FFCDD2',
      '--accent': '#DC143C',
      '--accent-2': '#00695C',
      '--success': '#1976D2',
      '--warning': '#FF8F00',
      '--danger': '#D32F2F',
      '--glow': 'rgba(220,20,60,0.45)',
    },
  },

  // Analogous: Deep Ocean Blues
  {
    id: 'abyssal-depths',
    name: 'Abyssal Depths',
    family: 'Analogous',
    mode: 'dark',
    tokens: {
      '--bg-top': '#051419',
      '--bg-bottom': '#0a2332',
      '--panel': '#0f1e28',
      '--border': '#1b3544',
      '--text-primary': '#E1F5FE',
      '--text-secondary': '#B3E5FC',
      '--accent': '#00ACC1',
      '--accent-2': '#1565C0',
      '--success': '#00695C',
      '--warning': '#FF8F00',
      '--danger': '#D32F2F',
      '--glow': 'rgba(0,172,193,0.4)',
    },
  },

  // Tetradic: Magenta + Green + Orange + Blue
  {
    id: 'neon-synthwave',
    name: 'Neon Synthwave',
    family: 'Tetradic',
    mode: 'dark',
    tokens: {
      '--bg-top': '#0d0d1a',
      '--bg-bottom': '#1a1a33',
      '--panel': '#141426',
      '--border': '#2d2d4a',
      '--text-primary': '#F8F8FF',
      '--text-secondary': '#E6E6FA',
      '--accent': '#FF1493',
      '--accent-2': '#00FF7F',
      '--success': '#00FF7F',
      '--warning': '#FF4500',
      '--danger': '#FF1493',
      '--glow': 'rgba(255,20,147,0.5)',
    },
  },

  // Monochromatic: Rich Purples
  {
    id: 'violet-storm',
    name: 'Violet Storm',
    family: 'Monochrome',
    mode: 'dark',
    tokens: {
      '--bg-top': '#0f0a1a',
      '--bg-bottom': '#1f1533',
      '--panel': '#171226',
      '--border': '#2e2040',
      '--text-primary': '#F3E5F5',
      '--text-secondary': '#E1BEE7',
      '--accent': '#9C27B0',
      '--accent-2': '#6A1B9A',
      '--success': '#4CAF50',
      '--warning': '#FF9800',
      '--danger': '#F44336',
      '--glow': 'rgba(156,39,176,0.4)',
    },
  },

  // Double Complementary: Warm/Cool Balance
  {
    id: 'solar-eclipse',
    name: 'Solar Eclipse',
    family: 'Double Complementary',
    mode: 'dark',
    tokens: {
      '--bg-top': '#1a1205',
      '--bg-bottom': '#33240a',
      '--panel': '#221808',
      '--border': '#4a3317',
      '--text-primary': '#FFFDE7',
      '--text-secondary': '#FFF8C4',
      '--accent': '#FFD700',
      '--accent-2': '#191970',
      '--success': '#32CD32',
      '--warning': '#FF8C00',
      '--danger': '#DC143C',
      '--glow': 'rgba(255,215,0,0.4)',
    },
  },

  // Light themes
  {
    id: 'golden-hour-light',
    name: 'Golden Hour',
    family: 'Monochrome',
    mode: 'light',
    tokens: {
      '--bg-top': '#FFFEF7',
      '--bg-bottom': '#FFF8E1',
      '--panel': '#FFFFFF',
      '--border': '#F3E5AB',
      '--text-primary': '#5D4E37',
      '--text-secondary': '#8B7355',
      '--accent': '#DAA520',
      '--accent-2': '#B8860B',
      '--success': '#2E7D32',
      '--warning': '#F57C00',
      '--danger': '#C62828',
      '--glow': 'rgba(218,165,32,0.2)',
    },
  },

  {
    id: 'sage-berry-light',
    name: 'Sage & Berry',
    family: 'Split-Complementary',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F8FBF8',
      '--panel': '#FFFFFF',
      '--border': '#E8F2E8',
      '--text-primary': '#2D5016',
      '--text-secondary': '#558B2F',
      '--accent': '#689F38',
      '--accent-2': '#C2185B',
      '--success': '#4CAF50',
      '--warning': '#FF9800',
      '--danger': '#E91E63',
      '--glow': 'rgba(104,159,56,0.15)',
    },
  },

  // Soft pastels with high contrast text
  {
    id: 'cotton-candy-light',
    name: 'Cotton Candy',
    family: 'Analogous',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#FEF7FF',
      '--panel': '#FFFFFF',
      '--border': '#F3E8FF',
      '--text-primary': '#4C1D95',
      '--text-secondary': '#6B21A8',
      '--accent': '#A855F7',
      '--accent-2': '#EC4899',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(168,85,247,0.12)',
    },
  },

  // Professional blue-gray
  {
    id: 'steel-light',
    name: 'Steel Professional',
    family: 'Monochrome',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F8FAFC',
      '--panel': '#FFFFFF',
      '--border': '#E2E8F0',
      '--text-primary': '#1E293B',
      '--text-secondary': '#475569',
      '--accent': '#3B82F6',
      '--accent-2': '#64748B',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(59,130,246,0.1)',
    },
  },

  // Warm beige and browns
  {
    id: 'coffee-cream-light',
    name: 'Coffee & Cream',
    family: 'Analogous',
    mode: 'light',
    tokens: {
      '--bg-top': '#FFFEFB',
      '--bg-bottom': '#FEF3E2',
      '--panel': '#FFFFFF',
      '--border': '#F3E8D3',
      '--text-primary': '#451A03',
      '--text-secondary': '#92400E',
      '--accent': '#D97706',
      '--accent-2': '#A16207',
      '--success': '#059669',
      '--warning': '#DC2626',
      '--danger': '#B91C1C',
      '--glow': 'rgba(217,119,6,0.15)',
    },
  },

  // Fresh mint green
  {
    id: 'mint-fresh-light',
    name: 'Mint Fresh',
    family: 'Complementary',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F0FDF9',
      '--panel': '#FFFFFF',
      '--border': '#D1FAE5',
      '--text-primary': '#064E3B',
      '--text-secondary': '#047857',
      '--accent': '#10B981',
      '--accent-2': '#DC2626',
      '--success': '#059669',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--glow': 'rgba(16,185,129,0.12)',
    },
  },

  // Soft coral and peach
  {
    id: 'peach-blossom-light',
    name: 'Peach Blossom',
    family: 'Analogous',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#FEF2F2',
      '--panel': '#FFFFFF',
      '--border': '#FECACA',
      '--text-primary': '#7F1D1D',
      '--text-secondary': '#B91C1C',
      '--accent': '#F87171',
      '--accent-2': '#FB923C',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(248,113,113,0.15)',
    },
  },

  // Cool gray-blue professional
  {
    id: 'cloud-nine-light',
    name: 'Cloud Nine',
    family: 'Monochrome',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F1F5F9',
      '--panel': '#FFFFFF',
      '--border': '#CBD5E1',
      '--text-primary': '#0F172A',
      '--text-secondary': '#334155',
      '--accent': '#0EA5E9',
      '--accent-2': '#6366F1',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(14,165,233,0.1)',
    },
  },

  // Warm sand and terracotta
  {
    id: 'desert-sand-light',
    name: 'Desert Sand',
    family: 'Analogous',
    mode: 'light',
    tokens: {
      '--bg-top': '#FFFEFB',
      '--bg-bottom': '#FEF3C7',
      '--panel': '#FFFFFF',
      '--border': '#FDE68A',
      '--text-primary': '#78350F',
      '--text-secondary': '#92400E',
      '--accent': '#F59E0B',
      '--accent-2': '#EA580C',
      '--success': '#10B981',
      '--warning': '#DC2626',
      '--danger': '#B91C1C',
      '--glow': 'rgba(245,158,11,0.15)',
    },
  },

  // Sophisticated purple-gray
  {
    id: 'amethyst-light',
    name: 'Amethyst',
    family: 'Split-Complementary',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#FAF5FF',
      '--panel': '#FFFFFF',
      '--border': '#E9D5FF',
      '--text-primary': '#581C87',
      '--text-secondary': '#7C3AED',
      '--accent': '#8B5CF6',
      '--accent-2': '#10B981',
      '--success': '#059669',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(139,92,246,0.12)',
    },
  },

  // Fresh lime and citrus
  {
    id: 'citrus-splash-light',
    name: 'Citrus Splash',
    family: 'Triadic',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F7FEE7',
      '--panel': '#FFFFFF',
      '--border': '#D9F99D',
      '--text-primary': '#365314',
      '--text-secondary': '#4D7C0F',
      '--accent': '#84CC16',
      '--accent-2': '#EF4444',
      '--success': '#22C55E',
      '--warning': '#F59E0B',
      '--danger': '#DC2626',
      '--glow': 'rgba(132,204,22,0.15)',
    },
  },

  // Soft indigo
  {
    id: 'midnight-sky-light',
    name: 'Midnight Sky',
    family: 'Monochrome',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#EEF2FF',
      '--panel': '#FFFFFF',
      '--border': '#C7D2FE',
      '--text-primary': '#312E81',
      '--text-secondary': '#3730A3',
      '--accent': '#6366F1',
      '--accent-2': '#8B5CF6',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(99,102,241,0.12)',
    },
  },

  // Elegant rose gold
  {
    id: 'rose-gold-light',
    name: 'Rose Gold',
    family: 'Analogous',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#FFF1F2',
      '--panel': '#FFFFFF',
      '--border': '#FECDD3',
      '--text-primary': '#881337',
      '--text-secondary': '#BE123C',
      '--accent': '#FB7185',
      '--accent-2': '#F97316',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(251,113,133,0.15)',
    },
  },

  // Clean emerald
  {
    id: 'emerald-garden-light',
    name: 'Emerald Garden',
    family: 'Complementary',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#ECFDF5',
      '--panel': '#FFFFFF',
      '--border': '#A7F3D0',
      '--text-primary': '#064E3B',
      '--text-secondary': '#065F46',
      '--accent': '#059669',
      '--accent-2': '#DC2626',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--glow': 'rgba(5,150,105,0.12)',
    },
  },

  // Warm honey
  {
    id: 'honey-glow-light',
    name: 'Honey Glow',
    family: 'Analogous',
    mode: 'light',
    tokens: {
      '--bg-top': '#FFFBEB',
      '--bg-bottom': '#FEF3C7',
      '--panel': '#FFFFFF',
      '--border': '#FCD34D',
      '--text-primary': '#78350F',
      '--text-secondary': '#B45309',
      '--accent': '#F59E0B',
      '--accent-2': '#EA580C',
      '--success': '#10B981',
      '--warning': '#DC2626',
      '--danger': '#B91C1C',
      '--glow': 'rgba(245,158,11,0.2)',
    },
  },

  // Clean teal
  {
    id: 'teal-breeze-light',
    name: 'Teal Breeze',
    family: 'Complementary',
    mode: 'light',
    tokens: {
      '--bg-top': '#FEFEFE',
      '--bg-bottom': '#F0FDFA',
      '--panel': '#FFFFFF',
      '--border': '#99F6E4',
      '--text-primary': '#134E4A',
      '--text-secondary': '#0F766E',
      '--accent': '#14B8A6',
      '--accent-2': '#EF4444',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#DC2626',
      '--glow': 'rgba(20,184,166,0.12)',
    },
  }
];

// Enhanced utility functions
export function applyThemeToRoot(tokens) {
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function getStoredTheme() {
  return localStorage.getItem('themeProfile') || 'gold-monochrome';
}

export function setStoredTheme(themeId) {
  localStorage.setItem('themeProfile', themeId);
}

export function getCurrentTheme(themeId) {
  return THEME_PROFILES.find(t => t.id === themeId) || THEME_PROFILES[0];
}

export function getThemesByMode(mode) {
  return THEME_PROFILES.filter(theme => theme.mode === mode);
}

export function getThemesByFamily(family) {
  return THEME_PROFILES.filter(theme => theme.family === family);
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

export function rgbaFromHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getContrastRatio(color1, color2) {
  const getLuminance = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}