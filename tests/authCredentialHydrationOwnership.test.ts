import { expect, it, vi } from 'vitest';
import { authCredentialsFixture } from './fixtures/authCredentials';
import { deferred } from './fixtures/gscSliceDirect';
import { apiKeySaveQueues } from '@/stores/auth/runtime';

it.each(['openai', 'claude', 'gemini'] as const)('waits for an in-flight %s key write before hydrating', async (provider) => {
  const f = authCredentialsFixture(); const native = deferred<void>();
  let persisted = false;
  f.set.mockImplementationOnce(() => native.promise.then(() => { persisted = true; }));
  f.get.mockImplementation(async () => persisted ? 'saved' : 'stale');
  const save = f.store.getState().setApiKey(provider, 'saved');
  await vi.waitFor(() => expect(f.set).toHaveBeenCalledTimes(1));
  const load = f.store.getState().hydrateCredentials();
  const readBeforeWrite = f.get.mock.calls.length;
  native.resolve(); await Promise.all([save, load]);
  expect(readBeforeWrite).toBe(0);
  expect(f.store.getState().apiKeys[provider]).toBe('saved');
  expect(f.store.getState().isHydrated).toBe(true);
  expect(apiKeySaveQueues.size).toBe(0);
});

it('waits for independent provider writes including failures before reading the vault', async () => {
  const f = authCredentialsFixture(); const first = deferred<void>(); const second = deferred<void>();
  f.set.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const openai = f.store.getState().setApiKey('openai', 'openai').catch(error => error);
  const claude = f.store.getState().setApiKey('claude', 'claude');
  await vi.waitFor(() => expect(f.set).toHaveBeenCalledTimes(2));
  const load = f.store.getState().hydrateCredentials();
  first.reject(new Error('vault write failed')); await openai;
  const readBeforeSecondWrite = f.get.mock.calls.length;
  f.get.mockResolvedValue('persisted'); second.resolve(); await Promise.all([claude, load]);
  expect(readBeforeSecondWrite).toBe(0);
  expect(f.get.mock.calls).toEqual([['openai_api_key'], ['claude_api_key'], ['gemini_api_key']]);
  expect(f.store.getState().apiKeys).toEqual({ openai: 'persisted', claude: 'persisted', gemini: 'persisted' });
});

it('does not read for hydration superseded by a newer queued save while waiting', async () => {
  const f = authCredentialsFixture(); const native = deferred<void>();
  f.set.mockReturnValueOnce(native.promise);
  const first = f.store.getState().setApiKey('openai', 'old');
  await vi.waitFor(() => expect(f.set).toHaveBeenCalledTimes(1));
  const load = f.store.getState().hydrateCredentials();
  const latest = f.store.getState().setApiKey('openai', 'latest');
  native.resolve(); await Promise.all([first, load, latest]);
  expect(f.get).not.toHaveBeenCalled();
  expect(f.store.getState().apiKeys.openai).toBe('latest');
});
