import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import {
  DEFAULT_CONFIG,
  activeProjectId,
  dataForSeoSecretNameFor,
  googleMetricsSecretNameFor,
} from '@/stores/settings/defaults';
import { createSettingsCredentials } from '@/stores/settings/credentials';
import { applyThemeToDOM, initializeSettingsTheme } from '@/stores/settings/theme';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  document.documentElement.className = '';
});

describe('settings defaults and secret names direct assertions', () => {
  it('DEFAULT_CONFIG provides valid initial application configuration', () => {
    expect(DEFAULT_CONFIG.theme).toBe('dark');
    expect(DEFAULT_CONFIG.default_user_agent).toBe('chrome_mac');
    expect(DEFAULT_CONFIG.verify_ssl).toBe(true);
    expect(DEFAULT_CONFIG.ai_provider).toBe('openai');
  });

  it('activeProjectId reads from storage or project store fallback', () => {
    expect(typeof activeProjectId()).toBe('string');
    localStorage.setItem('seomi_active_project_v1', 'project-xyz');
    expect(activeProjectId()).toBe('project-xyz');
  });

  it('dataForSeoSecretNameFor generates valid secret names and rejects invalid project IDs', () => {
    expect(dataForSeoSecretNameFor('login', 'proj-123')).toBe('dataforseo_login_proj-123');
    expect(dataForSeoSecretNameFor('password', 'proj-123')).toBe('dataforseo_password_proj-123');

    expect(() => dataForSeoSecretNameFor('login', 'invalid/id')).toThrow();
    expect(() => dataForSeoSecretNameFor('login', '')).toThrow();
    expect(() => dataForSeoSecretNameFor('login', 'a'.repeat(81))).toThrow();
  });

  it('googleMetricsSecretNameFor generates valid secret names and rejects invalid IDs', () => {
    expect(googleMetricsSecretNameFor('proj-abc')).toBe('google_metrics_api_key_proj-abc');

    expect(() => googleMetricsSecretNameFor('bad id with spaces')).toThrow();
    expect(() => googleMetricsSecretNameFor('')).toThrow();
  });

  it('applyThemeToDOM toggles dark and light classes on document root', () => {
    applyThemeToDOM('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    applyThemeToDOM('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('initializeSettingsTheme applies initial theme and handles listener setup', () => {
    const mockStore = {
      getState: () => ({ theme: 'light' as const }),
    } as any;
    initializeSettingsTheme(mockStore);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('createSettingsCredentials returns credentials methods', () => {
    const set = () => undefined;
    const get = () => ({} as any);
    const slice = createSettingsCredentials(set, get);
    expect(typeof slice.loadDataForSeoCredentials).toBe('function');
    expect(typeof slice.saveDataForSeoCredentials).toBe('function');
  });
});
