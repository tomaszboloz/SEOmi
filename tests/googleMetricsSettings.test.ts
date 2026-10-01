import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';

const settingsMocks = vi.hoisted(() => ({
  getSecureValueMock: vi.fn(),
  setSecureValueMock: vi.fn(),
  invokeTauriCommandMock: vi.fn(),
}));

vi.mock('../src/services/tauri', () => ({
  getSecureValue: settingsMocks.getSecureValueMock,
  setSecureValue: settingsMocks.setSecureValueMock,
  invokeTauriCommand: settingsMocks.invokeTauriCommandMock,
}));

describe('project-scoped Google performance API key settings', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'project-one');
    settingsMocks.getSecureValueMock.mockReset().mockResolvedValue('');
    settingsMocks.setSecureValueMock.mockReset().mockResolvedValue(undefined);
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue(undefined);
    useSettingsStore.setState({ googleMetricsApiKey: '', secureStorageError: null, isSaving: false });
  });

  it('stores only a trimmed key under the active project credential name', async () => {
    await useSettingsStore.getState().saveGoogleMetricsApiKey('  google-key  ');

    expect(settingsMocks.setSecureValueMock).toHaveBeenCalledWith('google_metrics_api_key_project-one', 'google-key');
    expect(useSettingsStore.getState().googleMetricsApiKey).toBe('google-key');
  });

  it('loads the selected project key from secure storage without reusing another project key', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-two');
    settingsMocks.getSecureValueMock.mockResolvedValue('second-project-key');
    await useSettingsStore.getState().loadGoogleMetricsApiKey();

    expect(settingsMocks.getSecureValueMock).toHaveBeenCalledWith('google_metrics_api_key_project-two');
    expect(useSettingsStore.getState().googleMetricsApiKey).toBe('second-project-key');
  });

  it('ignores a secure-store response that belongs to a project left during the read', async () => {
    let resolveRead: ((value: string) => void) | undefined;
    settingsMocks.getSecureValueMock.mockImplementation(() => new Promise<string>((resolve) => { resolveRead = resolve; }));

    const pending = useSettingsStore.getState().loadGoogleMetricsApiKey();
    localStorage.setItem('seomi_active_project_v1', 'project-two');
    resolveRead?.('old-project-key');
    await pending;

    expect(useSettingsStore.getState().googleMetricsApiKey).toBe('');
  });

  it('does not leak DataForSEO credentials when the project changes during keychain hydration', async () => {
    const resolvers: Array<(value: string) => void> = [];
    settingsMocks.getSecureValueMock.mockImplementation(() => new Promise<string>((resolve) => { resolvers.push(resolve); }));

    const pending = useSettingsStore.getState().loadDataForSeoCredentials();
    localStorage.setItem('seomi_active_project_v1', 'project-two');
    resolvers.forEach((resolve) => resolve('old-project-secret'));
    await pending;

    expect(useSettingsStore.getState().dataForSeoCredentials).toEqual({ login: '', password: '' });
  });

  it('serializes concurrent config writes and keeps the latest snapshot last', async () => {
    const resolvers: Array<() => void> = [];
    settingsMocks.invokeTauriCommandMock.mockImplementation((command: string) => {
      if (command === 'save_config') return new Promise<void>((resolve) => { resolvers.push(resolve); });
      return Promise.resolve(undefined);
    });

    const first = useSettingsStore.getState().updateConfig({ theme: 'light' });
    await vi.waitFor(() => expect(settingsMocks.invokeTauriCommandMock).toHaveBeenCalledTimes(1));
    const second = useSettingsStore.getState().updateConfig({ language: 'pl' });
    expect(settingsMocks.invokeTauriCommandMock).toHaveBeenCalledTimes(1);

    resolvers[0]?.();
    await vi.waitFor(() => expect(settingsMocks.invokeTauriCommandMock).toHaveBeenCalledTimes(2));
    expect(settingsMocks.invokeTauriCommandMock.mock.calls[1]?.[1]).toMatchObject({ config: { theme: 'light', language: 'pl' } });
    resolvers[1]?.();
    await Promise.all([first, second]);
    expect(useSettingsStore.getState().isSaving).toBe(false);
  });

  it('serializes concurrent secure API-key writes and keeps the newest value last', async () => {
    const resolvers: Array<() => void> = [];
    settingsMocks.setSecureValueMock.mockImplementation(() => new Promise<void>((resolve) => { resolvers.push(resolve); }));

    const first = useSettingsStore.getState().saveGoogleMetricsApiKey('old-key');
    await vi.waitFor(() => expect(settingsMocks.setSecureValueMock).toHaveBeenCalledTimes(1));
    const second = useSettingsStore.getState().saveGoogleMetricsApiKey('new-key');
    expect(settingsMocks.setSecureValueMock).toHaveBeenCalledTimes(1);

    resolvers[0]?.();
    await vi.waitFor(() => expect(settingsMocks.setSecureValueMock).toHaveBeenCalledTimes(2));
    expect(settingsMocks.setSecureValueMock.mock.calls[1]).toEqual(['google_metrics_api_key_project-one', 'new-key']);
    resolvers[1]?.();
    await Promise.all([first, second]);

    expect(useSettingsStore.getState().googleMetricsApiKey).toBe('new-key');
    expect(useSettingsStore.getState().isSaving).toBe(false);
  });
});


describe('general settings propagate into the active audit controls', () => {
  const originalConfig = useSettingsStore.getState().config;
  it('restores persisted user agent and provider/model after restarting', async () => {
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue({ ...originalConfig, default_user_agent: 'custom-agent/1.0', ai_provider: 'claude', ai_model: 'claude-test-model' });
    settingsMocks.getSecureValueMock.mockResolvedValue('');
    await useSettingsStore.getState().loadConfig();
    expect(useAuditStore.getState().selectedUserAgent).toBe('custom-agent/1.0');
    expect(useAuthStore.getState().provider).toBe('claude');
    expect(useAuthStore.getState().model).toBe('claude-test-model');
    useSettingsStore.setState({ config: originalConfig });
  });

  it('immediately applies a changed default user agent and persists it', async () => {
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue(undefined);
    await useSettingsStore.getState().updateConfig({ default_user_agent: 'googlebot_mobile' });
    expect(useAuditStore.getState().selectedUserAgent).toBe('googlebot_mobile');
    expect(settingsMocks.invokeTauriCommandMock).toHaveBeenCalledWith('save_config', expect.objectContaining({ config: expect.objectContaining({ default_user_agent: 'googlebot_mobile' }) }));
    useSettingsStore.setState({ config: originalConfig });
  });
});

describe('configuration failure state', () => {
  it('keeps the current settings and exposes read failures until a successful reload', async () => {
    const original = useSettingsStore.getState().config;
    settingsMocks.invokeTauriCommandMock.mockRejectedValueOnce(new Error('unreadable configuration'));
    settingsMocks.getSecureValueMock.mockResolvedValue('');
    await useSettingsStore.getState().loadConfig();
    expect(useSettingsStore.getState().config).toEqual(original);
    expect(useSettingsStore.getState().configError).toBeTruthy();
    settingsMocks.invokeTauriCommandMock.mockResolvedValueOnce(original);
    await useSettingsStore.getState().loadConfig();
    expect(useSettingsStore.getState().configError).toBeNull();
  });

  it('exposes failed saves rather than clearing the failure as a success', async () => {
    settingsMocks.invokeTauriCommandMock.mockRejectedValueOnce(new Error('disk failure'));
    await useSettingsStore.getState().updateConfig({ theme: 'dark' });
    expect(useSettingsStore.getState().configError).toBeTruthy();
    expect(useSettingsStore.getState().isSaving).toBe(false);
  });
});
