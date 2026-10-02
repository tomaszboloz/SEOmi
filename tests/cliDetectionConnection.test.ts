import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import type { AiCliStatus, AiConnectionState } from '@/types';

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: native.invoke,
  getSecureValue: vi.fn().mockResolvedValue(''),
  setSecureValue: vi.fn().mockResolvedValue(undefined),
}));
const detected: AiCliStatus[] = ['openai', 'claude', 'gemini'].map((provider) => ({
  provider: provider as AiCliStatus['provider'], command: provider,
  available: true, detail: `${provider} authenticated`,
}));

beforeEach(() => {
  native.invoke.mockReset();
  localStorage.clear();
  useAuthStore.setState({
    activeProjectId: null, provider: 'claude',
    connectionMethod: { openai: 'local_cli', claude: 'local_cli', gemini: 'local_cli' },
    connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' },
    statusMessages: { openai: '', claude: '', gemini: '' },
    cliStatus: { openai: null, claude: null, gemini: null },
  });
});

describe('asynchronous CLI detection connection restoration', () => {
  it('restores authenticated Codex and Claude while requiring a Gemini request', async () => {
    native.invoke.mockResolvedValue(detected);
    await useAuthStore.getState().detectLocalClients();
    expect(native.invoke).toHaveBeenCalledWith('detect_ai_clis');
    expect(useAuthStore.getState().connectionStatus).toEqual({
      openai: 'connected', claude: 'connected', gemini: 'unconfigured',
    });
    expect(useAuthStore.getState().statusMessages.claude).toBe('claude authenticated');
  });

  it('does not connect absent, unauthenticated, or API-based providers', async () => {
    useAuthStore.setState({ connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'local_cli' } });
    native.invoke.mockResolvedValue(detected.filter((status) => status.provider !== 'gemini')
      .map((status) => ({ ...status, available: status.provider !== 'openai' })));
    await useAuthStore.getState().detectLocalClients();
    expect(useAuthStore.getState().connectionStatus).toEqual({
      openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured',
    });
    expect(useAuthStore.getState().cliStatus.gemini).toBeNull();
  });

  it.each<AiConnectionState>(['connected', 'error', 'testing'])('preserves an explicit %s result', async (status) => {
    useAuthStore.setState({
      connectionStatus: { openai: status, claude: status, gemini: status },
      statusMessages: { openai: 'explicit', claude: 'explicit', gemini: 'explicit' },
    });
    native.invoke.mockResolvedValue(detected);
    await useAuthStore.getState().detectLocalClients();
    expect(useAuthStore.getState().connectionStatus).toEqual({ openai: status, claude: status, gemini: status });
    expect(useAuthStore.getState().statusMessages).toEqual({ openai: 'explicit', claude: 'explicit', gemini: 'explicit' });
  });

  it('ignores a stale detection completing after a newer result', async () => {
    let release!: (statuses: AiCliStatus[]) => void;
    native.invoke.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }))
      .mockResolvedValueOnce([]);
    const old = useAuthStore.getState().detectLocalClients();
    await useAuthStore.getState().detectLocalClients();
    release(detected);
    await old;
    expect(useAuthStore.getState().cliStatus).toEqual({ openai: null, claude: null, gemini: null });
    expect(useAuthStore.getState().isProviderConnected()).toBe(false);
  });
});
