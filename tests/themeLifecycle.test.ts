import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn().mockResolvedValue(undefined),
  getSecureValue: vi.fn().mockResolvedValue(''),
  setSecureValue: vi.fn().mockResolvedValue(undefined),
}));
let dark = true;
let notify: (() => void) | undefined;
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.style.display = 'grid';
  dark = true;
  notify = undefined;
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: dark,
    addEventListener: (type: string, callback: () => void) => {
      expect(type).toBe('change');
      notify = callback;
    },
  })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.className = '';
  document.documentElement.style.display = '';
});

describe('theme lifecycle before native configuration', () => {
  it('restores light at module initialization and preserves the display property', async () => {
    localStorage.setItem('seomi_theme', 'light');
    const { useSettingsStore } = await import('@/stores/settingsStore');
    expect(useSettingsStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.display).toBe('grid');
  });

  it('follows both directions of OS changes only while system is selected', async () => {
    localStorage.setItem('seomi_theme', 'system');
    const { useSettingsStore } = await import('@/stores/settingsStore');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    dark = false;
    expect(notify).toBeTypeOf('function');
    notify?.();
    expect(document.documentElement.classList.contains('light')).toBe(true);
    dark = true;
    notify?.();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await useSettingsStore.getState().setTheme('light');
    notify?.();
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.style.display).toBe('grid');
  });

  it('does not override an explicit dark theme when the OS is light', async () => {
    dark = false;
    localStorage.setItem('seomi_theme', 'dark');
    await import('@/stores/settingsStore');
    notify?.();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('defaults system to dark when matchMedia is unavailable', async () => {
    vi.stubGlobal('matchMedia', undefined);
    localStorage.setItem('seomi_theme', 'system');
    await import('@/stores/settingsStore');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
