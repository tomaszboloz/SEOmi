import { create } from 'zustand';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { createAuthConnection } from '@/stores/auth/connection';
import type { AuthState } from '@/stores/auth/types';
import type { AiCliStatus } from '@/types';
import { AIService } from '@/services/ai';
import { invokeTauriCommand } from '@/services/tauri';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), getSecureValue: vi.fn(), setSecureValue: vi.fn() }));
const fixture = () => create<AuthState>((set, get) => ({ ...useAuthStore.getInitialState(),
  connectionMethod: { openai: 'local_cli', claude: 'local_cli', gemini: 'local_cli' },
  refreshProviderModels: vi.fn(), ...createAuthConnection(set, get) }));
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
beforeEach(() => { vi.restoreAllMocks(); vi.mocked(invokeTauriCommand).mockReset(); });

describe('auth connection detection races and error contracts', () => {
  it('ignores stale successful detection and preserves explicit connection results', async () => {
    const old = deferred<AiCliStatus[]>();
    vi.mocked(invokeTauriCommand).mockReturnValueOnce(old.promise).mockResolvedValueOnce([
      { provider: 'claude', available: true, command: 'claude', detail: '' },
    ]);
    const auth = fixture();
    auth.setState({ connectionStatus: { openai: 'testing', claude: 'unconfigured', gemini: 'error' },
      statusMessages: { openai: 'checking', claude: 'old message', gemini: 'explicit failure' } });
    const stale = auth.getState().detectLocalClients();
    await auth.getState().detectLocalClients();
    expect(auth.getState().connectionStatus).toEqual({ openai: 'testing', claude: 'connected', gemini: 'error' });
    expect(auth.getState().statusMessages).toEqual({ openai: 'checking', claude: '', gemini: 'explicit failure' });
    expect(auth.getState().cliStatus.openai).toBeNull();
    old.resolve([{ provider: 'openai', available: true, command: 'codex', detail: 'stale' }]);
    await stale;
    expect(auth.getState().cliStatus.openai).toBeNull();
    expect(auth.getState().cliStatus.claude?.command).toBe('claude');
  });
  it.each([new Error('native failure'), 'string failure'])('reports current detection rejection %s', async (failure) => {
    const auth = fixture();
    auth.setState({ provider: 'gemini' });
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(failure);
    await auth.getState().detectLocalClients();
    expect(auth.getState().statusMessages.gemini).toBe(failure instanceof Error ? failure.message : failure);
    expect(auth.getState().connectionStatus.gemini).toBe('unconfigured');
  });
  it('ignores stale detection failures after a newer successful detection', async () => {
    const old = deferred<AiCliStatus[]>();
    vi.mocked(invokeTauriCommand).mockReturnValueOnce(old.promise).mockResolvedValueOnce([]);
    const auth = fixture();
    const stale = auth.getState().detectLocalClients();
    await auth.getState().detectLocalClients();
    old.reject('stale error');
    await stale;
    expect(auth.getState().statusMessages.openai).toBe('');
  });
  it('handles non-Error CLI failures and refreshes models only after successful API checks', async () => {
    const auth = fixture();
    vi.spyOn(AIService, 'testCliConnection').mockRejectedValueOnce('CLI unavailable').mockResolvedValueOnce({ success: true, message: 'CLI verified' });
    const failure = await auth.getState().testProviderConnection('claude');
    expect(failure.success).toBe(false);
    expect(failure.message).toContain('CLI unavailable');
    expect(auth.getState().connectionStatus.claude).toBe('error');
    await auth.getState().testProviderConnection('claude');
    expect(auth.getState().connectionStatus.claude).toBe('connected');
    expect(auth.getState().refreshProviderModels).not.toHaveBeenCalled();
    auth.setState({ connectionMethod: { openai: 'api_key', claude: 'local_cli', gemini: 'local_cli' } });
    vi.spyOn(AIService, 'testConnection').mockResolvedValueOnce({ success: true, message: 'API verified' });
    await auth.getState().testProviderConnection('openai');
    expect(auth.getState().refreshProviderModels).toHaveBeenCalledExactlyOnceWith('openai');
  });
});
