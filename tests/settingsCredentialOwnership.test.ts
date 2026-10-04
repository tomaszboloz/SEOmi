import { expect, it, vi } from 'vitest';
import { credentialsFixture, selectCredentialProject } from './fixtures/settingsCredentials';
import { deferred } from './fixtures/gscSliceDirect';

it.each(['google', 'dataforseo'] as const)('newer %s hydration supersedes old success and error', async (kind) => {
  for (const failure of [false, true]) {
    const f = credentialsFixture(); const old = deferred<string>();
    f.get.mockReturnValueOnce(old.promise);
    const load = kind === 'google' ? f.store.getState().loadGoogleMetricsApiKey : f.store.getState().loadDataForSeoCredentials;
    const pending = load();
    f.get.mockResolvedValue('latest'); await load();
    if (failure) old.reject(new Error('stale failure')); else old.resolve('stale');
    await pending;
    expect(f.store.getState().secureStorageError).toBeNull();
    if (kind === 'google') expect(f.store.getState().googleMetricsApiKey).toBe('latest');
    else expect(f.store.getState().dataForSeoCredentials).toEqual({ login: 'latest', password: 'latest' });
  }
});

it.each(['google', 'dataforseo'] as const)('save invalidates an earlier %s keychain read', async (kind) => {
  const f = credentialsFixture(); const old = deferred<string>();
  f.get.mockReturnValueOnce(old.promise);
  const pending = kind === 'google' ? f.store.getState().loadGoogleMetricsApiKey() : f.store.getState().loadDataForSeoCredentials();
  if (kind === 'google') await f.store.getState().saveGoogleMetricsApiKey('saved');
  else await f.store.getState().saveDataForSeoCredentials({ login: 'saved', password: 'saved' });
  old.resolve('old'); await pending;
  if (kind === 'google') expect(f.store.getState().googleMetricsApiKey).toBe('saved');
  else expect(f.store.getState().dataForSeoCredentials).toEqual({ login: 'saved', password: 'saved' });
});

it.each(['google', 'dataforseo'] as const)('loads %s only after an in-flight save finishes', async (kind) => {
  const f = credentialsFixture(); const native = deferred<void>();
  f.set.mockReturnValueOnce(native.promise);
  const save = kind === 'google' ? f.store.getState().saveGoogleMetricsApiKey('saved') : f.store.getState().saveDataForSeoCredentials({ login: 'saved', password: 'saved' });
  await vi.waitFor(() => expect(f.set).toHaveBeenCalled());
  const load = kind === 'google' ? f.store.getState().loadGoogleMetricsApiKey() : f.store.getState().loadDataForSeoCredentials();
  expect(f.get).not.toHaveBeenCalled();
  f.get.mockResolvedValue('saved'); native.resolve();
  await Promise.all([save, load]);
  expect(f.store.getState().secureStorageError).toBeNull();
  if (kind === 'google') expect(f.store.getState().googleMetricsApiKey).toBe('saved');
  else expect(f.store.getState().dataForSeoCredentials).toEqual({ login: 'saved', password: 'saved' });
});

it('does not leave saving enabled when the current project finishes before another project', async () => {
  const f = credentialsFixture(); const old = deferred<void>();
  f.set.mockReturnValueOnce(old.promise);
  const pending = f.store.getState().saveGoogleMetricsApiKey('one-key');
  await vi.waitFor(() => expect(f.set).toHaveBeenCalledTimes(1));
  selectCredentialProject('two');
  await f.store.getState().saveGoogleMetricsApiKey('two-key');
  expect(f.store.getState().isSaving).toBe(false);
  old.resolve(); await pending;
  expect(f.store.getState().googleMetricsApiKey).toBe('two-key');
});

it('waits for both credential writes to settle after a partial failure before starting the next save', async () => {
  const f = credentialsFixture(); const password = deferred<void>();
  f.set.mockRejectedValueOnce(new Error('login write failed')).mockReturnValueOnce(password.promise);
  const first = f.store.getState().saveDataForSeoCredentials({ login: 'old', password: 'old' });
  const firstResult = first.catch(error => error);
  await vi.waitFor(() => expect(f.set).toHaveBeenCalledTimes(2));
  const next = f.store.getState().saveDataForSeoCredentials({ login: 'new', password: 'new' });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(f.set).toHaveBeenCalledTimes(2);
  password.resolve();
  expect(await firstResult).toEqual(new Error('login write failed'));
  await next;
  expect(f.set.mock.calls.slice(2)).toEqual([['dataforseo_login_one', 'new'], ['dataforseo_password_one', 'new']]);
  expect(f.store.getState().dataForSeoCredentials).toEqual({ login: 'new', password: 'new' });
  expect(f.store.getState().secureStorageError).toBeNull();
  expect(f.store.getState().isSaving).toBe(false);
});
