import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettingsStore } from '../src/stores/settingsStore';
import { connectSettingsStores } from '@/services/settingsComposition';

let disconnect: () => void;

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

beforeAll(() => { disconnect = connectSettingsStores(); });

afterAll(() => disconnect());

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
