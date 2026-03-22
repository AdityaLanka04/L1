import { Platform } from 'react-native';

export const NOTE_FONT_OPTIONS = [
  'Inter',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Monaco',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
] as const;

export type NoteFontName = (typeof NOTE_FONT_OPTIONS)[number];

export function normalizeNoteFont(font?: string | null): NoteFontName {
  if (font && NOTE_FONT_OPTIONS.includes(font as NoteFontName)) {
    return font as NoteFontName;
  }
  return 'Inter';
}

export function resolveNoteFont(font?: string | null, role: 'body' | 'title' | 'mono' = 'body') {
  const normalized = normalizeNoteFont(font);

  if (normalized === 'Inter') {
    if (role === 'title') return 'Inter_900Black';
    if (role === 'mono') return Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
    return 'Inter_400Regular';
  }

  if (normalized === 'Courier New' || normalized === 'Monaco') {
    return Platform.select({
      ios: normalized === 'Monaco' ? 'Menlo' : 'Courier New',
      android: 'monospace',
      default: 'monospace',
    });
  }

  if (normalized === 'Georgia' || normalized === 'Times New Roman') {
    return Platform.select({
      ios: normalized,
      android: 'serif',
      default: 'serif',
    });
  }

  if (normalized === 'Roboto') {
    return Platform.select({
      ios: 'Arial',
      android: 'Roboto',
      default: 'sans-serif',
    });
  }

  if (normalized === 'Arial') {
    return Platform.select({
      ios: 'Arial',
      android: 'sans-serif',
      default: 'sans-serif',
    });
  }

  return Platform.select({
    ios: normalized,
    android: 'sans-serif',
    default: 'sans-serif',
  });
}
