import { expect, it, vi } from 'vitest';
import { authCredentialsFixture } from './fixtures/authCredentials';
import { deferred } from './fixtures/gscSliceDirect';
import { apiKeySaveQueues } from '@/stores/auth/runtime';

it.each(['openai', 'claude', 'gemini'] as const)('saves the exact %s secret and invalidates prior connection proof', async (provider) => {
  const f = authCredentialsFixture();
  f.store.setState({ connectionStatus: { openai: 'connected', claude: 'connected', gemini: 'connected' } });
  await f.store.getState().setApiKey(provider, ' saved ');
  expect(f.set).toHaveBeenCalledWith(`${provider}_api_key`, ' saved ');
  expect(f.store.getState().apiKeys[provider]).toBe(' saved ');
  expect(f.store.getState().connectionStatus[provider]).toBe('unconfigured');
  expect(f.store.getState().statusMessages[provider]).toBeTruthy();
  await f.store.getState().setApiKey(provider, '');
  expect(f.store.getState().apiKeys[provider]).toBe('');
  expect(f.store.getState().statusMessages[provider]).toBe('');
  expect(apiKeySaveQueues.size).toBe(0);
});

it.each([new Error('vault unavailable'), 'unknown vault failure'])('reports and rethrows current native save failure %s', async (error) => {
  const f = authCredentialsFixture(); f.set.mockRejectedValueOnce(error);
  await expect(f.store.getState().setApiKey('claude', 'key')).rejects.toBe(error);
  expect(f.store.getState().apiKeys.claude).toBe('');
  expect(f.store.getState().connectionStatus.claude).toBe('error');
  expect(f.store.getState().statusMessages.claude).toContain(error instanceof Error ? error.message : error);
  expect(apiKeySaveQueues.size).toBe(0);
});

it('recovers a failed queued write without accepting its stale error', async () => {
  const f = authCredentialsFixture(); const native = deferred<void>();
  f.set.mockReturnValueOnce(native.promise);
  const old = f.store.getState().setApiKey('openai', 'old');
  await vi.waitFor(() => expect(f.set).toHaveBeenCalledTimes(1));
  const latest = f.store.getState().setApiKey('openai', 'latest');
  native.reject(new Error('stale')); await old; await latest;
  expect(f.set.mock.calls).toEqual([['openai_api_key', 'old'], ['openai_api_key', 'latest']]);
  expect(f.store.getState().apiKeys.openai).toBe('latest');
  expect(f.store.getState().connectionStatus.openai).toBe('unconfigured');
  expect(f.store.getState().statusMessages.openai).not.toContain('stale');
});

it('hydrates all three exact secret names without inventing connection proof', async () => {
  const f = authCredentialsFixture();
  f.get.mockImplementation(async (name: string) => name);
  await f.store.getState().hydrateCredentials();
  expect(f.get.mock.calls).toEqual([['openai_api_key'], ['claude_api_key'], ['gemini_api_key']]);
  expect(f.store.getState().apiKeys).toEqual({ openai: 'openai_api_key', claude: 'claude_api_key', gemini: 'gemini_api_key' });
  expect(f.store.getState().isHydrated).toBe(true);
  expect(f.store.getState().connectionStatus).toEqual({ openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' });
});

it.each([new Error('read failed'), 'unknown read failure'])('marks current hydration complete and reports %s to selected provider', async (error) => {
  const f = authCredentialsFixture(); f.store.setState({ provider: 'gemini' });
  f.get.mockRejectedValueOnce(error);
  await f.store.getState().hydrateCredentials();
  expect(f.store.getState().isHydrated).toBe(true);
  expect(f.store.getState().statusMessages.gemini).toBe(error instanceof Error ? error.message : error);
  expect(f.store.getState().statusMessages.openai).toBe('');
});

it.each(['success', 'failure'] as const)('does not replace newer hydration with old %s', async (outcome) => {
  const f = authCredentialsFixture(); const native = deferred<string>();
  f.get.mockReturnValueOnce(native.promise);
  const old = f.store.getState().hydrateCredentials();
  f.get.mockResolvedValue('latest'); await f.store.getState().hydrateCredentials();
  if (outcome === 'success') native.resolve('stale'); else native.reject(new Error('stale'));
  await old;
  expect(f.store.getState().apiKeys).toEqual({ openai: 'latest', claude: 'latest', gemini: 'latest' });
  expect(f.store.getState().statusMessages.openai).toBe('');
});

it.each(['success', 'failure'] as const)('save invalidates a hydration already reading with stale %s', async (outcome) => {
  const f = authCredentialsFixture(); const native = deferred<string>();
  f.get.mockReturnValueOnce(native.promise);
  const old = f.store.getState().hydrateCredentials();
  await f.store.getState().setApiKey('openai', 'saved');
  const message = f.store.getState().statusMessages.openai;
  if (outcome === 'success') native.resolve('stale'); else native.reject(new Error('stale'));
  await old;
  expect(f.store.getState().apiKeys.openai).toBe('saved');
  expect(f.store.getState().statusMessages.openai).toBe(message);
});
