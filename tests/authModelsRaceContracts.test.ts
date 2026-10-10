import { create } from 'zustand';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { createAuthModels, readCachedModels } from '@/stores/auth/models';
import type { AuthState } from '@/stores/auth/types';
import { listProviderModels, type AiModelOption } from '@/services/ai/modelList';

vi.mock('@/services/ai/modelList', () => ({ listProviderModels: vi.fn() }));
const known = [{ id: 'known-model', label: 'Known model' }];
const fixture = () => create<AuthState>((set, get) => ({ ...useAuthStore.getInitialState(),
  apiKeys: { openai: 'fixture-key', claude: '', gemini: '' },
  connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
  availableModels: { openai: known, claude: [], gemini: [] }, ...createAuthModels(set, get) }));
const deferred = () => {
  let resolve!: (models: AiModelOption[]) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<AiModelOption[]>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
beforeEach(() => { localStorage.clear(); vi.mocked(listProviderModels).mockReset(); });

describe('provider model caches and refresh races', () => {
  it.each(['not JSON', '{}', '[{"id":"","label":"Invalid"}]'])(
    'rejects malformed or invalid cache %s', (cache) => {
      localStorage.setItem('seomi_ai_models_openai_v1', cache);
      expect(readCachedModels('openai')).toEqual([]);
    },
  );
  it('keeps a previous valid list when a current refresh returns no models', async () => {
    const auth = fixture();
    vi.mocked(listProviderModels).mockResolvedValueOnce([]);
    await auth.getState().refreshProviderModels('openai');
    expect(auth.getState().availableModels.openai).toEqual(known);
    expect(auth.getState().modelListStatus.openai).toBe('error');
    expect(localStorage.getItem('seomi_ai_models_openai_v1')).toBeNull();
  });
  it.each(['success', 'failure'])('ignores stale refresh %s after a newer list is saved', async (outcome) => {
    const old = deferred();
    const fresh = [{ id: 'fresh-model', label: 'Fresh model' }];
    vi.mocked(listProviderModels).mockReturnValueOnce(old.promise).mockResolvedValueOnce(fresh);
    const auth = fixture();
    const stale = auth.getState().refreshProviderModels('openai');
    expect(auth.getState().modelListStatus.openai).toBe('loading');
    await auth.getState().refreshProviderModels('openai');
    if (outcome === 'success') old.resolve([{ id: 'stale-model', label: 'Stale' }]);
    else old.reject('stale failure');
    await stale;
    expect(auth.getState().availableModels.openai).toEqual(fresh);
    expect(auth.getState().modelListStatus.openai).toBe('idle');
    expect(JSON.parse(localStorage.getItem('seomi_ai_models_openai_v1')!)).toEqual(fresh);
  });
  it('settles current failures and skips refreshes for blank API keys or CLI connections', async () => {
    const auth = fixture();
    vi.mocked(listProviderModels).mockRejectedValueOnce('provider error');
    await auth.getState().refreshProviderModels('openai');
    expect(auth.getState().modelListStatus.openai).toBe('error');
    expect(auth.getState().availableModels.openai).toEqual(known);
    vi.mocked(listProviderModels).mockClear();
    await auth.getState().refreshProviderModels('claude');
    auth.setState({ connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'api_key' } });
    await auth.getState().refreshProviderModels('openai');
    expect(listProviderModels).not.toHaveBeenCalled();
  });
});
