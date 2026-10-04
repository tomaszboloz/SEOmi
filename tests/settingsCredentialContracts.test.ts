import { expect, it, vi } from 'vitest';
import { credentialsFixture, selectCredentialProject } from './fixtures/settingsCredentials';
import { deferred } from './fixtures/gscSliceDirect';

it.each(['google', 'dataforseo'] as const)('clears %s before loading and skips native reads without a project', async (kind) => {
  const f = credentialsFixture();
  f.store.setState({ dataForSeoCredentials: { login: 'old', password: 'old' }, googleMetricsApiKey: 'old' });
  selectCredentialProject('');
  await (kind === 'google' ? f.store.getState().loadGoogleMetricsApiKey() : f.store.getState().loadDataForSeoCredentials());
  expect(f.get).not.toHaveBeenCalled();
  if (kind === 'google') expect(f.store.getState().googleMetricsApiKey).toBe('');
  else expect(f.store.getState().dataForSeoCredentials).toEqual({ login: '', password: '' });
});

it.each(['google', 'dataforseo'] as const)('uses exact project keys and clears old %s secrets while reading', async (kind) => {
  const f = credentialsFixture(); const value = deferred<string>();
  f.store.setState({ dataForSeoCredentials: { login: 'old', password: 'old' }, googleMetricsApiKey: 'old', secureStorageError: 'old' });
  f.get.mockReturnValue(value.promise);
  const pending = kind === 'google' ? f.store.getState().loadGoogleMetricsApiKey() : f.store.getState().loadDataForSeoCredentials();
  expect(f.store.getState().secureStorageError).toBeNull();
  if (kind === 'google') {
    expect(f.get.mock.calls).toEqual([['google_metrics_api_key_one']]);
    expect(f.store.getState().googleMetricsApiKey).toBe('');
  } else {
    expect(f.get.mock.calls).toEqual([['dataforseo_login_one'], ['dataforseo_password_one']]);
    expect(f.store.getState().dataForSeoCredentials).toEqual({ login: '', password: '' });
  }
  value.resolve('loaded'); await pending;
  if (kind === 'google') expect(f.store.getState().googleMetricsApiKey).toBe('loaded');
  else expect(f.store.getState().dataForSeoCredentials).toEqual({ login: 'loaded', password: 'loaded' });
});

it.each(['google', 'dataforseo'] as const)('reports current %s read/write errors and preserves their rejection identity', async (kind) => {
  for (const error of [new Error('vault unavailable'), 'unknown vault failure']) {
    const f = credentialsFixture();
    f.get.mockRejectedValue(error);
    await (kind === 'google' ? f.store.getState().loadGoogleMetricsApiKey() : f.store.getState().loadDataForSeoCredentials());
    expect(f.store.getState().secureStorageError).toBe(error instanceof Error ? error.message : error);
    f.set.mockRejectedValue(error);
    const save = kind === 'google' ? f.store.getState().saveGoogleMetricsApiKey('key') : f.store.getState().saveDataForSeoCredentials({ login: 'login', password: 'pass' });
    await expect(save).rejects.toBe(error);
    expect(f.store.getState().secureStorageError).toBe(error instanceof Error ? error.message : error);
    expect(f.store.getState().isSaving).toBe(false);
  }
});

it.each(['google', 'dataforseo'] as const)('ignores stale %s read failures and write results after project switch', async (kind) => {
  const f = credentialsFixture(); const read = deferred<string>();
  f.get.mockReturnValueOnce(read.promise);
  const load = kind === 'google' ? f.store.getState().loadGoogleMetricsApiKey() : f.store.getState().loadDataForSeoCredentials();
  selectCredentialProject('two'); read.reject(new Error('stale')); await load;
  expect(f.store.getState().secureStorageError).toBeNull();
  selectCredentialProject('one'); const write = deferred<void>();
  f.set.mockReturnValueOnce(write.promise);
  const save = kind === 'google' ? f.store.getState().saveGoogleMetricsApiKey('old') : f.store.getState().saveDataForSeoCredentials({ login: 'old', password: 'old' });
  await vi.waitFor(() => expect(f.set).toHaveBeenCalled());
  selectCredentialProject('two'); write.resolve(); await save;
  expect(f.store.getState().googleMetricsApiKey).toBe('');
  expect(f.store.getState().dataForSeoCredentials).toEqual({ login: '', password: '' });
});

it.each(['google', 'dataforseo'] as const)('rejects %s saves without a project before native access', async (kind) => {
  const f = credentialsFixture(); selectCredentialProject('');
  const save = kind === 'google' ? f.store.getState().saveGoogleMetricsApiKey('key') : f.store.getState().saveDataForSeoCredentials({ login: 'login', password: 'pass' });
  await expect(save).rejects.toBeInstanceOf(Error);
  expect(f.set).not.toHaveBeenCalled();
  expect(f.store.getState().isSaving).toBe(false);
  expect(f.store.getState().secureStorageError).toBeTruthy();
});

it('keeps independent credential queues saving until both kinds complete', async () => {
  const f = credentialsFixture(); const first = deferred<void>(); const second = deferred<void>();
  f.set.mockReturnValueOnce(first.promise);
  const google = f.store.getState().saveGoogleMetricsApiKey(' trimmed ');
  await vi.waitFor(() => expect(f.set).toHaveBeenCalledTimes(1));
  f.set.mockReturnValueOnce(second.promise);
  const dfs = f.store.getState().saveDataForSeoCredentials({ login: ' login ', password: ' password ' });
  await vi.waitFor(() => expect(f.set).toHaveBeenCalledTimes(3));
  first.resolve(); await google;
  expect(f.store.getState().isSaving).toBe(true);
  second.resolve(); await dfs;
  expect(f.store.getState().isSaving).toBe(false);
  expect(f.store.getState().googleMetricsApiKey).toBe('trimmed');
  expect(f.set.mock.calls).toEqual([['google_metrics_api_key_one', 'trimmed'], ['dataforseo_login_one', ' login '], ['dataforseo_password_one', ' password ']]);
});

it.each(['google', 'dataforseo'] as const)('recovers a failed %s queue and skips a superseded waiting read', async (kind) => {
  const f = credentialsFixture(); const native = deferred<void>();
  f.set.mockReturnValueOnce(native.promise);
  const save = (value: string) => kind === 'google' ? f.store.getState().saveGoogleMetricsApiKey(value)
    : f.store.getState().saveDataForSeoCredentials({ login: value, password: value });
  const old = save('old'); const failed = old.catch(error => error);
  await vi.waitFor(() => expect(f.set).toHaveBeenCalled());
  const load = kind === 'google' ? f.store.getState().loadGoogleMetricsApiKey() : f.store.getState().loadDataForSeoCredentials();
  const latest = save('latest');
  native.reject(new Error('old failure'));
  expect(await failed).toEqual(new Error('old failure'));
  await Promise.all([load, latest]);
  expect(f.get).not.toHaveBeenCalled();
  expect(f.store.getState().secureStorageError).toBeNull();
  expect(f.store.getState().isSaving).toBe(false);
  if (kind === 'google') expect(f.store.getState().googleMetricsApiKey).toBe('latest');
  else expect(f.store.getState().dataForSeoCredentials).toEqual({ login: 'latest', password: 'latest' });
});
