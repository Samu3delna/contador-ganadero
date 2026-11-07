import { useEffect, useState, useMemo } from 'react';
import { ThemeContext } from './theme';
export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B131B' : '#F4F8F5');
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const sync = () => {
      let saved;
      try { saved = localStorage.getItem('cg-theme'); } catch { /* Use system preference. */ }
      setTheme(saved === 'light' || saved === 'dark' ? saved : media?.matches ? 'dark' : 'light');
    };
    media?.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    return () => { media?.removeEventListener('change', sync); window.removeEventListener('storage', sync); };
  }, []);
  const value = useMemo(() => ({ theme, toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('cg-theme', next); } catch { /* Session-only preference. */ }
    setTheme(next);
  } }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
