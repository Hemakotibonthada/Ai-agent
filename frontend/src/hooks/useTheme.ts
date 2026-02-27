/* ===================================================================
   Nexus AI OS — useTheme Hook
   Multi-theme support with 8 distinct themes
   CSS variables are applied directly via JS for guaranteed specificity
   =================================================================== */

import { useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';

/* ---- Theme definitions ---- */
export interface ThemeColors {
  surface: string;
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeDef {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  description: string;
  colors: ThemeColors;
  preview: { bg: string; card: string; primary: string; secondary: string; accent: string };
}

export const THEMES: ThemeDef[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    description: 'Deep space dark with electric blue accents',
    colors: {
      surface: '30 30 46', bg: '15 15 26', card: '37 37 56', border: '46 46 69',
      text: '226 232 240', muted: '148 163 184',
      primary: '59 130 246', secondary: '139 92 246', accent: '6 182 212',
      success: '16 185 129', warning: '245 158 11', error: '239 68 68',
    },
    preview: { bg: '#0f0f1a', card: '#252538', primary: '#3B82F6', secondary: '#8B5CF6', accent: '#06B6D4' },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    mode: 'light',
    description: 'Clean and bright for daytime productivity',
    colors: {
      surface: '245 245 250', bg: '250 250 252', card: '255 255 255', border: '226 226 234',
      text: '30 30 46', muted: '100 110 130',
      primary: '59 130 246', secondary: '124 58 237', accent: '14 165 233',
      success: '16 185 129', warning: '245 158 11', error: '239 68 68',
    },
    preview: { bg: '#fafafc', card: '#ffffff', primary: '#3B82F6', secondary: '#7C3AED', accent: '#0EA5E9' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    mode: 'dark',
    description: 'Warm amber and crimson desert tones',
    colors: {
      surface: '48 30 24', bg: '32 18 14', card: '60 42 34', border: '88 56 44',
      text: '242 224 216', muted: '176 140 128',
      primary: '249 115 22', secondary: '239 68 68', accent: '251 191 36',
      success: '132 204 22', warning: '251 191 36', error: '239 68 68',
    },
    preview: { bg: '#20120e', card: '#3c2a22', primary: '#F97316', secondary: '#EF4444', accent: '#FBBF24' },
  },
  {
    id: 'forest',
    name: 'Forest',
    mode: 'dark',
    description: 'Serene emerald greens from deep woods',
    colors: {
      surface: '22 46 28', bg: '14 30 18', card: '28 56 35', border: '44 78 52',
      text: '220 237 222', muted: '134 176 142',
      primary: '16 185 129', secondary: '34 197 94', accent: '45 212 191',
      success: '34 197 94', warning: '250 204 21', error: '248 113 113',
    },
    preview: { bg: '#0e1e12', card: '#1c3823', primary: '#10B981', secondary: '#22C55E', accent: '#2DD4BF' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    mode: 'dark',
    description: 'Deep sea blues and coastal teals',
    colors: {
      surface: '18 34 58', bg: '12 22 42', card: '24 44 72', border: '38 64 100',
      text: '210 228 246', muted: '128 164 198',
      primary: '56 189 248', secondary: '99 102 241', accent: '34 211 238',
      success: '52 211 153', warning: '251 191 36', error: '251 113 133',
    },
    preview: { bg: '#0c162a', card: '#182c48', primary: '#38BDF8', secondary: '#6366F1', accent: '#22D3EE' },
  },
  {
    id: 'rose',
    name: 'Rosé',
    mode: 'light',
    description: 'Elegant pink tones for a soft feel',
    colors: {
      surface: '253 242 248', bg: '255 248 252', card: '255 255 255', border: '244 214 228',
      text: '64 20 48', muted: '140 86 118',
      primary: '236 72 153', secondary: '168 85 247', accent: '244 114 182',
      success: '52 211 153', warning: '251 146 60', error: '225 29 72',
    },
    preview: { bg: '#fff8fc', card: '#ffffff', primary: '#EC4899', secondary: '#A855F7', accent: '#F472B6' },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    mode: 'dark',
    description: 'Neon matrix vibes with electric greens',
    colors: {
      surface: '28 12 48', bg: '16 6 30', card: '38 18 62', border: '62 30 90',
      text: '232 220 255', muted: '160 130 200',
      primary: '0 255 136', secondary: '255 0 200', accent: '0 240 255',
      success: '0 255 136', warning: '255 240 0', error: '255 60 100',
    },
    preview: { bg: '#10061e', card: '#26123e', primary: '#00FF88', secondary: '#FF00C8', accent: '#00F0FF' },
  },
  {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    description: 'Arctic blue-greys inspired by Nordic design',
    colors: {
      surface: '46 52 64', bg: '36 41 51', card: '59 66 82', border: '67 76 94',
      text: '216 222 233', muted: '136 148 168',
      primary: '136 192 208', secondary: '180 142 173', accent: '163 190 140',
      success: '163 190 140', warning: '235 203 139', error: '191 97 106',
    },
    preview: { bg: '#242932', card: '#3B4252', primary: '#88C0D0', secondary: '#B48EAD', accent: '#A3BE8C' },
  },
];

const THEME_IDS = THEMES.map((t) => t.id);

/** All CSS custom property names we manage */
const CSS_VAR_KEYS: (keyof ThemeColors)[] = [
  'surface', 'bg', 'card', 'border', 'text', 'muted',
  'primary', 'secondary', 'accent', 'success', 'warning', 'error',
];

export function useTheme() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  /* ---- Resolve the theme id ---- */
  const themeId = THEME_IDS.includes(theme) ? theme : 'midnight';
  const themeDef = THEMES.find((t) => t.id === themeId)!;
  const isDark = themeDef.mode === 'dark';

  /* ---- Apply theme: set CSS variables directly on <html> ---- */
  useEffect(() => {
    const root = document.documentElement;

    // 1. Set CSS custom properties directly (inline style = highest specificity)
    CSS_VAR_KEYS.forEach((key) => {
      root.style.setProperty(`--nexus-${key}`, themeDef.colors[key]);
    });

    // 2. Toggle dark/light class for Tailwind darkMode:'class'
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, [themeId, isDark, themeDef]);

  /* ---- Cycle through themes ---- */
  const toggleTheme = useCallback(() => {
    const idx = THEME_IDS.indexOf(themeId);
    const nextIdx = (idx + 1) % THEME_IDS.length;
    setTheme(THEME_IDS[nextIdx]);
  }, [themeId, setTheme]);

  return {
    theme: themeId,
    themeDef,
    themes: THEMES,
    isDark,
    resolvedTheme: isDark ? 'dark' : 'light',
    setTheme,
    toggleTheme,
  } as const;
}

export default useTheme;
