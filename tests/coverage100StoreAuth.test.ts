import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIService } from '@/services/ai';
import { getSecureValue, invokeTauriCommand, setSecureValue } from '@/services/tauri';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), getSecureValue: vi.fn(), setSecureValue: vi.fn() }));
const getSecret = vi.mocked(getSecureValue);
const setSecret = vi.mocked(setSecureValue);
const invoke = vi.mocked(invokeTauriCommand);

beforeEach(() => {
  localStorage.clear();
  getSecret.mockReset(); setSecret.mockReset(); invoke.mockReset();
  useAuthStore.setState({
    activeProjectId: null, provider: 'openai', model: 'gpt-4o', apiKeys: { openai: '', claude: '', gemini: '' },
    connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
    connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' },
    statusMessages: { openai: '', claude: '', gemini: '' }, isHydrated: false,
  });
});

describe('auth store generation and credential boundaries', () => {
  it('delegates generation and requires local CLI for provider-scoped generation', async () => {
    const generate = vi.spyOn(AIService, 'generateText').mockResolvedValue('answer');
    useAuthStore.setState({ apiKeys: { openai: 'key', claude: '', gemini: '' } });
    await expect(useAuthStore.getState().generateText('prompt')).resolves.toBe('answer');
    await expect(useAuthStore.getState().generateTextForProvider('openai', 'prompt')).rejects.toThrow();
    useAuthStore.getState().setConnectionMethod('openai', 'local_cli');
    await expect(useAuthStore.getState().generateTextForProvider('openai', 'prompt')).resolves.toBe('answer');
    useAuthStore.setState({ connectionStatus: { openai: 'connected', claude: 'unconfigured', gemini: 'unconfigured' } });
    expect(useAuthStore.getState().isProviderConnected()).toBe(true);
    generate.mockRestore();
  });

  it('retains only presence in native mode and reports failed secret saves', async () => {
    setSecret.mockResolvedValue(undefined);
    await useAuthStore.getState().setApiKey('openai', '  key  ');
    expect(useAuthStore.getState().apiKeys.openai).toBe('  key  ');
    expect(useAuthStore.getState().connectionStatus.openai).toBe('unconfigured');
    setSecret.mockRejectedValueOnce(new Error('keychain unavailable'));
    await expect(useAuthStore.getState().setApiKey('claude', 'key')).rejects.toThrow('keychain unavailable');
    expect(useAuthStore.getState().connectionStatus.claude).toBe('error');
  });

  it('hydrates all providers and surfaces keychain failures without clearing hydration state', async () => {
    getSecret.mockResolvedValueOnce('openai-secret').mockResolvedValueOnce('').mockResolvedValueOnce('gemini-secret');
    await useAuthStore.getState().hydrateCredentials();
    expect(useAuthStore.getState()).toMatchObject({ apiKeys: { openai: 'openai-secret', claude: '', gemini: 'gemini-secret' }, isHydrated: true });
    getSecret.mockRejectedValueOnce(new Error('read failed'));
    await useAuthStore.getState().hydrateCredentials();
    expect(useAuthStore.getState().isHydrated).toBe(true);
    expect(Object.values(useAuthStore.getState().statusMessages)).toContain('read failed');
  });

  it('hydrates detected CLI statuses and tests a local connection explicitly', async () => {
    useAuthStore.setState({ connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'local_cli' } });
    invoke.mockResolvedValueOnce([
      { provider: 'openai', available: true, command: 'openai', detail: 'ready' },
      { provider: 'claude', available: false, command: 'claude', detail: 'sign in' },
    ]);
    await useAuthStore.getState().detectLocalClients();
    expect(useAuthStore.getState().connectionStatus.openai).toBe('connected');
    expect(useAuthStore.getState().connectionStatus.gemini).toBe('unconfigured');
    invoke.mockResolvedValueOnce({ provider: 'openai', available: true, detail: 'authenticated' });
    await expect(useAuthStore.getState().testProviderConnection('openai')).resolves.toMatchObject({ success: true });
    expect(useAuthStore.getState().statusMessages.openai).toContain('authenticated');
  });
});
