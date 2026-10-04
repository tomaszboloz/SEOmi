import { afterEach, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { formHook } from './fixtures/crawlFormHook';
import { useToolsStore } from '@/stores/toolsStore';
import { deferred } from './fixtures/gscSliceDirect';

afterEach(cleanup);

it.each(['project', 'latest', 'unmount'] as const)('ignores an imported file after %s invalidation', async (mode) => {
  const f = formHook();
  const old = deferred<string>();
  let pending!: Promise<void>;
  act(() => { pending = f.result.current.importSeedUrls({ text: () => old.promise } as File); });
  if (mode === 'project') f.rerender({ project: 'two' });
  if (mode === 'unmount') f.unmount();
  if (mode === 'latest') await act(async () => f.result.current.importSeedUrls({ text: async () => 'latest' } as File));
  f.setCrawlConfig.mockClear(); f.services.importUrls.mockClear();
  await act(async () => { old.resolve('stale'); await pending; });
  expect(f.services.importUrls).not.toHaveBeenCalled();
  expect(f.setCrawlConfig).not.toHaveBeenCalled();
});

it.each(['save', 'remove'] as const)('ignores old %s success and failure after a project switch', async (operation) => {
  for (const failure of [false, true]) {
    const f = formHook();
    const old = deferred<void>();
    const mock = operation === 'save' ? f.saveCrawlRequestProfile : f.deleteCrawlRequestProfile;
    mock.mockReturnValueOnce(old.promise);
    let pending!: Promise<void>;
    act(() => { pending = operation === 'save' ? f.result.current.saveRequestProfile() : f.result.current.removeRequestProfile(); });
    f.rerender({ project: 'two' });
    await act(async () => { if (failure) old.reject(new Error('stale')); else old.resolve(); await pending; });
    expect(f.result.current.requestProfileStatus).toBeNull();
    expect(f.result.current.requestProfileStatusIsError).toBe(false);
    f.unmount();
  }
});

it('keeps an edited draft when an older save completes', async () => {
  const f = formHook(); const old = deferred<void>();
  act(() => f.result.current.setRequestProfileName('original'));
  f.saveCrawlRequestProfile.mockReturnValueOnce(old.promise);
  let pending!: Promise<void>;
  act(() => { pending = f.result.current.saveRequestProfile(); });
  act(() => f.result.current.setRequestProfileName('new draft'));
  await act(async () => { old.resolve(); await pending; });
  expect(f.result.current.requestProfileName).toBe('new draft');
  expect(f.result.current.requestProfileStatus).toBeNull();
});

it.each(['save', 'remove'] as const)('profile selection supersedes pending %s errors', async (operation) => {
  const f = formHook(); const old = deferred<void>();
  (operation === 'save' ? f.saveCrawlRequestProfile : f.deleteCrawlRequestProfile).mockReturnValueOnce(old.promise);
  let pending!: Promise<void>;
  act(() => { pending = operation === 'save' ? f.result.current.saveRequestProfile() : f.result.current.removeRequestProfile(); });
  act(() => f.result.current.selectRequestProfile(''));
  await act(async () => { old.reject(new Error('stale')); await pending; });
  expect(f.result.current.requestProfileStatus).toBeNull();
  expect(f.result.current.requestProfileStatusIsError).toBe(false);
});

it('reports malformed headers without rejecting the public action', async () => {
  const f = formHook();
  act(() => f.result.current.setRequestProfileHeaders('missing separator'));
  await act(async () => { await expect(f.result.current.saveRequestProfile()).resolves.toBeUndefined(); });
  expect(f.saveCrawlRequestProfile).not.toHaveBeenCalled();
  expect(f.result.current.requestProfileStatusIsError).toBe(true);
  expect(f.result.current.requestProfileStatus).toBeTruthy();
});

it.each(['save', 'remove'] as const)('latest profile operation owns completion after %s', async (operation) => {
  const f = formHook(); const old = deferred<void>(); const latest = deferred<void>();
  (operation === 'save' ? f.saveCrawlRequestProfile : f.deleteCrawlRequestProfile).mockReturnValueOnce(old.promise);
  let pending!: Promise<void>; let current!: Promise<void>;
  act(() => { pending = operation === 'save' ? f.result.current.saveRequestProfile() : f.result.current.removeRequestProfile(); });
  f.saveCrawlRequestProfile.mockReturnValueOnce(latest.promise);
  act(() => { current = f.result.current.saveRequestProfile(); });
  await act(async () => { old.resolve(); await pending; });
  expect(f.result.current.requestProfileStatus).toBeNull();
  await act(async () => { latest.resolve(); await current; });
  expect(f.result.current.requestProfileStatus).toBe('Profile saved. Sensitive headers and cookies remain only in the system vault.');
});

it.each(['save', 'remove'] as const)('does not report %s completion after unmount', async (operation) => {
  const f = formHook(); const old = deferred<void>();
  (operation === 'save' ? f.saveCrawlRequestProfile : f.deleteCrawlRequestProfile).mockReturnValueOnce(old.promise);
  let pending!: Promise<void>;
  act(() => { pending = operation === 'save' ? f.result.current.saveRequestProfile() : f.result.current.removeRequestProfile(); });
  const previous = f.result.current;
  f.unmount();
  await act(async () => { old.reject(new Error('stale')); await pending; });
  expect(f.result.current).toBe(previous);
  expect(f.result.current.requestProfileStatus).toBeNull();
});

it.each(['save', 'remove'] as const)('accepts its own %s configuration update before UI completion', async (operation) => {
  const f = formHook(); const native = deferred<void>();
  (operation === 'save' ? f.saveCrawlRequestProfile : f.deleteCrawlRequestProfile).mockReturnValueOnce(native.promise);
  let pending!: Promise<void>;
  act(() => { pending = operation === 'save' ? f.result.current.saveRequestProfile() : f.result.current.removeRequestProfile(); });
  act(() => useToolsStore.setState({ crawlConfig: { ...useToolsStore.getState().crawlConfig,
    requestProfileId: operation === 'save' ? 'new-profile' : undefined, userAgent: 'stored agent' } }));
  await act(async () => { native.resolve(); await pending; });
  expect(f.result.current.requestProfileStatusIsError).toBe(false);
  expect(f.result.current.requestProfileStatus).toBe(operation === 'save'
    ? 'Profile saved. Sensitive headers and cookies remain only in the system vault.'
    : 'The profile and its secrets were removed from the system vault.');
});
