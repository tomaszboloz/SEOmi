import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from '@/stores/settingsStore';
import { STORED_SECRET_MARKER } from '@/services/tauri/secrets';

const transport = vi.hoisted(() => ({ invoke: vi.fn(), getSecret: vi.fn().mockResolvedValue(''), setSecret: vi.fn() }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: transport.invoke, getSecureValue: transport.getSecret, setSecureValue: transport.setSecret }));
afterEach(() => { localStorage.clear(); vi.clearAllMocks(); });

const deferred = () => { let resolve!: () => void; let reject!: (error: Error) => void; const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };

describe('secure credential saves', () => {
  it('clears the saving state when the project changes before the save finishes', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-a');
    const pending = deferred();
    transport.setSecret.mockReturnValue(pending.promise);
    const store = createSettingsStore();
    const save = store.getState().saveGoogleMetricsApiKey(' key ');
    expect(store.getState().isSaving).toBe(true);
    localStorage.setItem('seomi_active_project_v1', 'project-b');
    pending.resolve();
    await save;
    expect(store.getState().isSaving).toBe(false);
    expect(store.getState().googleMetricsApiKey).toBe('');
  });

  it('applies only the latest of overlapping saves and writes them in order', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-a');
    const first = deferred();
    transport.setSecret.mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const store = createSettingsStore();
    const older = store.getState().saveGoogleMetricsApiKey('old');
    const newer = store.getState().saveGoogleMetricsApiKey('new');
    first.resolve();
    await Promise.all([older, newer]);
    expect(transport.setSecret.mock.calls.map(call => call[1])).toEqual(['old', 'new']);
    expect(store.getState().googleMetricsApiKey).toBe('new');
    expect(store.getState().isSaving).toBe(false);
  });

  it('reports a failed save for the active project and rethrows it', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-a');
    transport.setSecret.mockRejectedValue(new Error('keychain locked'));
    const store = createSettingsStore();
    await expect(store.getState().saveDataForSeoCredentials({ login: 'l', password: 'p' })).rejects.toThrow('keychain locked');
    expect(store.getState().secureStorageError).toBe('keychain locked');
    expect(store.getState().isSaving).toBe(false);
  });

  it('does not erase native credentials when redacted fields are saved unchanged', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-a');
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    try {
      transport.setSecret.mockResolvedValue(undefined);
      const store = createSettingsStore();
      store.setState({
        dataForSeoCredentials: { login: STORED_SECRET_MARKER, password: STORED_SECRET_MARKER },
        googleMetricsApiKey: STORED_SECRET_MARKER,
      });
      await store.getState().saveDataForSeoCredentials({ login: '', password: '' });
      await store.getState().saveGoogleMetricsApiKey('');
      expect(transport.setSecret).not.toHaveBeenCalled();
      expect(store.getState().dataForSeoCredentials).toEqual({ login: STORED_SECRET_MARKER, password: STORED_SECRET_MARKER });
      expect(store.getState().googleMetricsApiKey).toBe(STORED_SECRET_MARKER);
    } finally {
      delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    }
  });
});

describe('secure save target', () => {
  it('writes a queued save to the project that was active when it was requested', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-a');
    const first = deferred();
    transport.setSecret.mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const store = createSettingsStore();
    const older = store.getState().saveGoogleMetricsApiKey('first');
    const queued = store.getState().saveGoogleMetricsApiKey('second');
    localStorage.setItem('seomi_active_project_v1', 'project-b');
    first.resolve();
    await Promise.all([older, queued]);
    expect(transport.setSecret.mock.calls.map(call => call[0])).toEqual(['google_metrics_api_key_project-a', 'google_metrics_api_key_project-a']);
  });
});
