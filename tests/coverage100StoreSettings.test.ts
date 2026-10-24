import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSecureValue, invokeTauriCommand, setSecureValue } from '@/services/tauri';
import { createSettingsStore } from '@/stores/settingsStore';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), getSecureValue: vi.fn(), setSecureValue: vi.fn() }));
const invoke = vi.mocked(invokeTauriCommand);
const getSecret = vi.mocked(getSecureValue);
const setSecret = vi.mocked(setSecureValue);
const config = {
  theme: 'light' as const, language: 'de', default_user_agent: 'chrome_linux', request_timeout_secs: 20, max_redirects: 5,
  verify_ssl: true, ai_provider: 'claude' as const, ai_model: 'claude-sonnet-5', auto_check_updates: true, auto_install_updates: false,
};

beforeEach(() => {
  localStorage.clear(); invoke.mockReset(); getSecret.mockReset(); setSecret.mockReset();
});

describe('settings store config and secure credential races', () => {
  it('loads native config and propagates provider and user-agent consumers', async () => {
    const consumer = { applyUserAgent: vi.fn(), applyAiSelection: vi.fn() };
    invoke.mockResolvedValue(config);
    const store = createSettingsStore(consumer);
    await store.getState().loadConfig();
    expect(store.getState()).toMatchObject({ config, theme: 'light', language: 'de', configError: null });
    expect(consumer.applyUserAgent).toHaveBeenCalledWith('chrome_linux');
    expect(consumer.applyAiSelection).toHaveBeenCalledWith('claude', 'claude-sonnet-5');
  });

  it('surfaces load failures and serializes config writes in call order', async () => {
    invoke.mockRejectedValueOnce(new Error('read failed'));
    const store = createSettingsStore();
    await store.getState().loadConfig();
    expect(store.getState().configError).toBeTruthy();
    const saved: unknown[] = [];
    invoke.mockImplementation(async (command, args) => {
      if (command === 'save_config') saved.push((args as { config: unknown }).config);
      return undefined;
    });
    const first = store.getState().updateConfig({ theme: 'light' });
    const second = store.getState().updateConfig({ language: 'pl' });
    await Promise.all([first, second]);
    expect(saved).toHaveLength(2);
    expect((saved[0] as typeof config).theme).toBe('light');
    expect((saved[1] as typeof config).language).toBe('pl');
    expect(store.getState().isSaving).toBe(false);
  });

  it('restores the previous consumer binding after a temporary binding is removed', async () => {
    const base = { applyUserAgent: vi.fn() };
    const temporary = { applyUserAgent: vi.fn() };
    invoke.mockResolvedValue(undefined);
    const store = createSettingsStore(base);
    const remove = store.getState().bindConsumers(temporary);
    await store.getState().updateConfig({ default_user_agent: 'firefox' });
    expect(temporary.applyUserAgent).toHaveBeenCalledWith('firefox');
    remove();
    await store.getState().updateConfig({ default_user_agent: 'safari' });
    expect(base.applyUserAgent).toHaveBeenCalledWith('safari');
  });

  it('loads and saves project-scoped Google and DataForSEO secrets', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-a');
    getSecret.mockResolvedValueOnce('login').mockResolvedValueOnce('password').mockResolvedValueOnce('metrics');
    setSecret.mockResolvedValue(undefined);
    const store = createSettingsStore();
    await store.getState().loadDataForSeoCredentials();
    await store.getState().loadGoogleMetricsApiKey();
    expect(store.getState()).toMatchObject({ dataForSeoCredentials: { login: 'login', password: 'password' }, googleMetricsApiKey: 'metrics' });
    await store.getState().saveGoogleMetricsApiKey('  next-key  ');
    expect(setSecret).toHaveBeenCalledWith('google_metrics_api_key_project-a', 'next-key');
    expect(store.getState().googleMetricsApiKey).toBe('next-key');
  });
});
