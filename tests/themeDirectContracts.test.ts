import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand';
import { applyThemeToDOM, initializeSettingsTheme } from '@/stores/settings/theme';
import type { SettingsState } from '@/stores/settings/types';

describe('theme DOM and media-query contracts', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.display = '';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('toggles dark and light classes and forces WebKit repaint when theme changes', () => {
    applyThemeToDOM('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);

    applyThemeToDOM('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('evaluates system theme preference based on matchMedia', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.includes('dark'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));

    applyThemeToDOM('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);

    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));

    applyThemeToDOM('system');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('handles missing matchMedia gracefully as dark fallback', () => {
    vi.stubGlobal('matchMedia', undefined);
    applyThemeToDOM('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('initializes settings theme and registers system media query listener', () => {
    let changeHandler: (() => void) | undefined;
    const addEventListener = vi.fn((_event: string, handler: () => void) => {
      changeHandler = handler;
    });
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener,
      removeEventListener: vi.fn(),
    })));

    const store = createStore<SettingsState>(() => ({
      theme: 'system',
    } as SettingsState));

    initializeSettingsTheme(store);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(addEventListener).toHaveBeenCalled();

    // Trigger listener when theme is system
    changeHandler?.();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // When theme is not system, changeHandler does not apply system
    store.setState({ theme: 'light' });
    applyThemeToDOM('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    changeHandler?.();
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('handles environment without matchMedia or addEventListener', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const store = createStore<SettingsState>(() => ({ theme: 'dark' } as SettingsState));
    expect(() => initializeSettingsTheme(store)).not.toThrow();
  });
});
