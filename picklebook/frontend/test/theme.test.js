import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme, readThemePreference, resolveTheme, saveThemePreference, THEME_STORAGE_KEY } from '../src/utils/theme.js';

test('system appearance is followed until a valid explicit theme exists', () => {
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(null, false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('outdated-value', true), 'dark');
});

test('corrupt or unavailable preference storage falls back safely', () => {
  assert.equal(readThemePreference({ getItem: () => 'invalid' }), null);
  assert.equal(readThemePreference({ getItem() { throw new Error('Storage blocked'); } }), null);
  assert.equal(saveThemePreference('dark', { setItem() { throw new Error('Storage full'); } }), false);
});

test('explicit choices are saved without changing unrelated storage', () => {
  const values = new Map([['picklebook_token', 'existing-session']]);
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(saveThemePreference('dark', storage), true);
  assert.equal(readThemePreference(storage), 'dark');
  assert.equal(values.get(THEME_STORAGE_KEY), 'dark');
  assert.equal(values.get('picklebook_token'), 'existing-session');
  assert.equal(saveThemePreference('invalid', storage), false);
  assert.equal(readThemePreference(storage), 'dark');
});

test('applying a theme updates browser appearance alongside the document attribute', () => {
  const classes = new Set();
  const browserColor = {};
  const doc = { documentElement: { dataset: {}, style: {}, classList: { toggle(name, active) { active ? classes.add(name) : classes.delete(name); } } }, querySelector: () => browserColor };
  applyTheme('dark', doc);
  assert.equal(doc.documentElement.dataset.theme, 'dark');
  assert.equal(doc.documentElement.style.colorScheme, 'dark');
  assert.equal(browserColor.content, '#0b1812');
  assert.ok(classes.has('dark'));
  applyTheme('light', doc);
  assert.equal(doc.documentElement.dataset.theme, 'light');
  assert.equal(doc.documentElement.style.colorScheme, 'light');
  assert.equal(browserColor.content, '#f8f9f3');
  assert.ok(!classes.has('dark'));
});
