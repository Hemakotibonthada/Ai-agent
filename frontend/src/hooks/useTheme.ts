/* ===================================================================
   Nexus AI OS — useTheme Hook
   Dark / light mode with system-preference detection
   =================================================================== */

import { useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';

export function useTheme() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  /* ---- Resolve effective theme ---- */
  const resolvedTheme: 'dark' | 'light' =
    theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

  /* ---- Apply class on <html> ---- */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.classList.toggle('light', resolvedTheme === 'light');
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  /* ---- Listen for OS theme changes when set to "system" ---- */
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setTheme('system'); // triggers re-render
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, setTheme]);

  /* ---- Toggle ---- */
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return { theme, resolvedTheme, setTheme, toggleTheme } as const;
}

export default useTheme;
