/* ===================================================================
   Nexus AI OS — useTheme Hook
   Multi-theme support with 8 distinct themes
   =================================================================== */

import { useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';

/* ---- Theme definitions ---- */
export interface ThemeDef {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  description: string;
  preview: { bg: string; card: string; primary: string; secondary: string; accent: string };
}

export const THEMES: ThemeDef[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    description: 'Deep space dark with electric blue accents',
    preview: { bg: '#0f0f1a', card: '#252538', primary: '#3B82F6', secondary: '#8B5CF6', accent: '#06B6D4' },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    mode: 'light',
    description: 'Clean and bright for daytime productivity',
    preview: { bg: '#fafafc', card: '#ffffff', primary: '#3B82F6', secondary: '#7C3AED', accent: '#0EA5E9' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    mode: 'dark',
    description: 'Warm amber and crimson desert tones',
    preview: { bg: '#140e0d', card: '#2c201e', primary: '#F97316', secondary: '#EF4444', accent: '#FBBF24' },
  },
  {
    id: 'forest',
    name: 'Forest',
    mode: 'dark',
    description: 'Serene emerald greens from deep woods',
    preview: { bg: '#0c1610', card: '#1c2c22', primary: '#10B981', secondary: '#22C55E', accent: '#2DD4BF' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    mode: 'dark',
    description: 'Deep sea blues and coastal teals',
    preview: { bg: '#0a1220', card: '#18263a', primary: '#38BDF8', secondary: '#6366F1', accent: '#22D3EE' },
  },
  {
    id: 'rose',
    name: 'Rosé',
    mode: 'light',
    description: 'Elegant pink tones for a soft feel',
    preview: { bg: '#fff8fc', card: '#ffffff', primary: '#EC4899', secondary: '#A855F7', accent: '#F472B6' },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    mode: 'dark',
    description: 'Neon matrix vibes with electric greens',
    preview: { bg: '#08041c', card: '#180e28', primary: '#00FF88', secondary: '#FF00C8', accent: '#00F0FF' },
  },
  {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    description: 'Arctic blue-greys inspired by Nordic design',
    preview: { bg: '#242932', card: '#3B4252', primary: '#88C0D0', secondary: '#B48EAD', accent: '#A3BE8C' },
  },
];

const THEME_IDS = THEMES.map((t) => t.id);

export function useTheme() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  /* ---- Resolve the theme id ---- */
  const themeId = THEME_IDS.includes(theme) ? theme : 'midnight';
  const themeDef = THEMES.find((t) => t.id === themeId)!;
  const isDark = themeDef.mode === 'dark';

  /* ---- Apply classes on <html> ---- */
  useEffect(() => {
    const root = document.documentElement;

    // Remove all theme classes
    THEME_IDS.forEach((id) => root.classList.remove(`theme-${id}`));
    root.classList.remove('dark', 'light');

    // Apply new theme class
    root.classList.add(`theme-${themeId}`);
    // Apply dark/light for Tailwind darkMode:'class'
    root.classList.add(isDark ? 'dark' : 'light');
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, [themeId, isDark]);

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
