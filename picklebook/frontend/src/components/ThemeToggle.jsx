import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button type="button" className={`theme-toggle ${className}`} onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={isDark} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
