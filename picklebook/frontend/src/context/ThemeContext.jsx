import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { applyTheme, normalizeTheme, readThemePreference, resolveTheme, saveThemePreference, THEME_STORAGE_KEY } from '../utils/theme';

const ThemeContext = createContext(null);
const systemPrefersDark = () => Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readThemePreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const theme = resolveTheme(preference, systemDark);

  useLayoutEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return undefined;
    const onChange = event => setSystemDark(event.matches);
    setSystemDark(query.matches);
    if (query.addEventListener) query.addEventListener('change', onChange);
    else query.addListener?.(onChange);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', onChange);
      else query.removeListener?.(onChange);
    };
  }, []);

  useEffect(() => {
    const onStorage = event => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setPreference(event.key === null ? null : normalizeTheme(event.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback(value => {
    const next = normalizeTheme(value);
    if (!next) return;
    setPreference(next);
    saveThemePreference(next);
  }, []);
  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, preference, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
