import { beforeEach, describe, expect, it, vi } from 'vitest';

const tauriMocks = vi.hoisted(() => ({
  getSecureValue: vi.fn(),
  setSecureValue: vi.fn(),
  invokeTauriCommand: vi.fn(),
}));

vi.mock('@/services/tauri', () => tauriMocks);

import { useAuthStore } from '@/stores/authStore';

describe('AI credential write ordering', () => {
  beforeEach(() => {
    tauriMocks.getSecureValue.mockReset().mockResolvedValue('');
    tauriMocks.setSecureValue.mockReset().mockResolvedValue(undefined);
    tauriMocks.invokeTauriCommand.mockReset().mockResolvedValue(undefined);
    useAuthStore.setState({
      apiKeys: { openai: '', claude: '', gemini: '' },
      connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' },
      statusMessages: { openai: '', claude: '', gemini: '' },
    });
  });

  it('serializes same-provider key writes so the newest secret is written last', async () => {
    const resolvers: Array<() => void> = [];
    tauriMocks.setSecureValue.mockImplementation(() => new Promise<void>((resolve) => { resolvers.push(resolve); }));

    const first = useAuthStore.getState().setApiKey('openai', 'old-key');
    await vi.waitFor(() => expect(tauriMocks.setSecureValue).toHaveBeenCalledTimes(1));
    const second = useAuthStore.getState().setApiKey('openai', 'new-key');
    expect(tauriMocks.setSecureValue).toHaveBeenCalledTimes(1);

    resolvers[0]?.();
    await vi.waitFor(() => expect(tauriMocks.setSecureValue).toHaveBeenCalledTimes(2));
    expect(tauriMocks.setSecureValue.mock.calls[1]).toEqual(['openai_api_key', 'new-key']);
    resolvers[1]?.();
    await Promise.all([first, second]);

    expect(useAuthStore.getState().apiKeys.openai).toBe('new-key');
  });

  it('keeps only a presence marker in the native auth store after saving', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    try {
      await useAuthStore.getState().setApiKey('openai', 'native-secret');
      expect(useAuthStore.getState().apiKeys.openai).toBe('__seomi_secret_present__');
    } finally {
      delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    }
  });
});
