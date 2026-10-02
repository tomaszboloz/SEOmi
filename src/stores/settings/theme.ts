import type { SettingsState } from './types';
import type { StoreApi } from 'zustand';

export function applyThemeToDOM(theme: 'dark' | 'light' | 'system') {
  const root = document.documentElement;
  const wasLight = root.classList.contains('light');
  const systemDark = typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-color-scheme: dark)').matches;
  const light = theme === 'light' || (theme === 'system' && !systemDark);
  root.classList.toggle('dark', !light);
  root.classList.toggle('light', light);
  if (wasLight !== light) {
    // WebKit keeps the previous result of color-mix() utilities (every
    // semi-transparent colour) when only the palette variables change, so the
    // sidebar and header stayed dark until a restart. Rebuilding the render
    // tree makes it resolve them again.
    const display = root.style.display;
    root.style.display = 'none';
    void root.offsetHeight;
    root.style.display = display;
  }
}

export const initializeSettingsTheme = (store: StoreApi<SettingsState>) => {
  if (typeof document === 'undefined') return;
  applyThemeToDOM(store.getState().theme);
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      if (store.getState().theme === 'system') applyThemeToDOM('system');
    });
  }
};
