export const THEME_STORAGE_KEY = 'picklebook_theme';

export function normalizeTheme(value) {
  return value === 'light' || value === 'dark' ? value : null;
}

export function resolveTheme(preference, systemDark = false) {
  return normalizeTheme(preference) || (systemDark ? 'dark' : 'light');
}

export function readThemePreference(storage) {
  try {
    const source = storage === undefined ? window.localStorage : storage;
    return normalizeTheme(source?.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveThemePreference(theme, storage) {
  const preference = normalizeTheme(theme);
  if (!preference) return false;
  try {
    const source = storage === undefined ? window.localStorage : storage;
    source.setItem(THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function applyTheme(theme, targetDocument = document) {
  const resolved = resolveTheme(theme);
  const root = targetDocument.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.style.backgroundColor = resolved === 'dark' ? '#0b1812' : '#f8f9f3';
  const browserColor = targetDocument.querySelector('meta[name="theme-color"]');
  if (browserColor) browserColor.content = resolved === 'dark' ? '#0b1812' : '#f8f9f3';
}
