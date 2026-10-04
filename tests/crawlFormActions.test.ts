import { afterEach, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { formHook } from './fixtures/crawlFormHook';
import { useToolsStore } from '@/stores/toolsStore';

afterEach(cleanup);

it('synchronizes URL/limit and resets transient state on project changes', () => {
  const f = formHook();
  expect(f.result.current.inputUrl).toBe('https://example.test');
  expect(f.result.current.selectedLimit).toBe(25);
  act(() => { f.result.current.setInputUrl('draft'); f.result.current.setSelectedLimit(90); f.result.current.toggleRow('page'); });
  expect(f.result.current.expandedRows).toEqual({ page: true });
  act(() => f.result.current.toggleRow('page'));
  expect(f.result.current.expandedRows).toEqual({ page: false });
  act(() => useToolsStore.setState({ crawlUrl: 'https://other.test', crawlLimit: 50 }));
  f.rerender({ project: 'two' });
  expect(f.result.current).toMatchObject({ inputUrl: 'https://other.test', selectedLimit: 50, expandedRows: {}, seedImportRejected: [] });
});

it('imports exact source text, retains rejection evidence and caps seed URLs at 10000', async () => {
  const f = formHook();
  await act(async () => f.result.current.importSeedUrls(undefined));
  expect(f.services.importUrls).not.toHaveBeenCalled();
  const urls = Array.from({ length: 10001 }, (_, i) => `https://example.test/${i}`);
  f.services.importUrls.mockReturnValueOnce({ urls, rejected: ['bad'] });
  await act(async () => f.result.current.importSeedUrls({ text: async () => 'csv content' } as File));
  expect(f.services.importUrls).toHaveBeenCalledWith('csv content');
  expect(f.result.current.seedImportRejected).toEqual(['bad']);
  expect(f.setCrawlConfig).toHaveBeenCalledWith({ seedUrls: urls.slice(0, 10000), listMode: true });
});

it.each(['allowedQueryParameters', 'deniedQueryParameters'] as const)('normalizes %s without losing ordering', (field) => {
  const f = formHook();
  act(() => f.result.current.setQueryParameterNames(field, ' first, ,second\n third '));
  expect(f.setCrawlConfig).toHaveBeenCalledWith({ [field]: ['first', 'second', 'third'] });
});

it('normalizes allowed hosts and updates only the selected custom search', () => {
  const f = formHook();
  act(() => f.result.current.setAllowedHosts(' example.test, ,other.test\n third.test '));
  expect(f.setCrawlConfig).toHaveBeenCalledWith({ allowedHosts: ['example.test', 'other.test', 'third.test'] });
  act(() => f.result.current.addCustomSearch());
  const search = f.setCrawlConfig.mock.calls.at(-1)![0].customSearches[0];
  expect(search).toMatchObject({ id: expect.any(String), selectorType: 'css', query: 'h1', resultType: 'text' });
  act(() => useToolsStore.setState({ crawlConfig: { ...useToolsStore.getState().crawlConfig, customSearches: [search, { ...search, id: 'other' }] } }));
  act(() => f.result.current.updateCustomSearch(search.id, { query: 'h2' }));
  expect(f.setCrawlConfig).toHaveBeenLastCalledWith({ customSearches: [{ ...search, query: 'h2' }, { ...search, id: 'other' }] });
  act(() => useToolsStore.setState({ crawlConfig: { ...useToolsStore.getState().crawlConfig, customSearches: Array.from({ length: 10 }, () => search) } }));
  f.setCrawlConfig.mockClear();
  act(() => f.result.current.addCustomSearch());
  expect(f.setCrawlConfig).not.toHaveBeenCalled();
});

it('saves parsed headers, cookie and proxy with exact arguments and clears a successful draft', async () => {
  const f = formHook();
  act(() => {
    f.result.current.setRequestProfileName('profile name'); f.result.current.setRequestProfileHeaders(' X-Test : value:tail \n \nEmpty:');
    f.result.current.setRequestProfileCookie('cookie'); f.result.current.setRequestProfileProxyUrl('http://proxy.test');
  });
  await act(async () => f.result.current.saveRequestProfile());
  expect(f.saveCrawlRequestProfile).toHaveBeenCalledWith({ name: 'profile name', userAgent: useToolsStore.getState().crawlConfig.userAgent || '',
    headers: [{ name: 'X-Test', value: 'value:tail' }, { name: 'Empty', value: '' }], cookie: 'cookie', proxyUrl: 'http://proxy.test' });
  expect(f.result.current).toMatchObject({ requestProfileName: '', requestProfileHeaders: '', requestProfileCookie: '', requestProfileProxyUrl: '', requestProfileStatusIsError: false });
});

it.each([new Error('owned failure'), 'unknown failure'])('reports current save/remove failure %s', async (error) => {
  const f = formHook();
  f.saveCrawlRequestProfile.mockRejectedValueOnce(error);
  await act(async () => f.result.current.saveRequestProfile());
  expect(f.result.current.requestProfileStatusIsError).toBe(true);
  expect(f.result.current.requestProfileStatus).toBe(error instanceof Error ? error.message : 'Unable to save the request profile.');
  f.deleteCrawlRequestProfile.mockRejectedValueOnce(error);
  await act(async () => f.result.current.removeRequestProfile());
  expect(f.result.current.requestProfileStatusIsError).toBe(true);
  expect(f.result.current.requestProfileStatus).toBe(error instanceof Error ? error.message : 'Unable to remove the request profile.');
});

it('removes the configured profile and skips removal without a selection', async () => {
  const f = formHook();
  await act(async () => f.result.current.removeRequestProfile());
  expect(f.deleteCrawlRequestProfile).toHaveBeenCalledWith('profile');
  expect(f.result.current.requestProfileStatusIsError).toBe(false);
  expect(f.result.current.requestProfileStatus).toBe('The profile and its secrets were removed from the system vault.');
  act(() => useToolsStore.setState({ crawlConfig: { ...useToolsStore.getState().crawlConfig, requestProfileId: undefined } }));
  f.deleteCrawlRequestProfile.mockClear();
  await act(async () => f.result.current.removeRequestProfile());
  expect(f.deleteCrawlRequestProfile).not.toHaveBeenCalled();
});

it('selects known profiles, keeps the existing user agent on empty metadata, and deselects explicitly', () => {
  const f = formHook();
  const profile = { id: 'known', name: 'Known', userAgent: 'Profile agent', hasProxy: false, createdAt: '', updatedAt: '' };
  act(() => useToolsStore.setState({ crawlRequestProfiles: [{ ...profile, id: 'other' }, profile] }));
  act(() => f.result.current.selectRequestProfile('known'));
  expect(f.setCrawlConfig).toHaveBeenLastCalledWith({ requestProfileId: 'known', userAgent: 'Profile agent' });
  expect(f.result.current.requestProfileStatus).toBe('Profile "Known" selected. Secrets are read natively only during the crawl.');
  act(() => useToolsStore.setState({ crawlRequestProfiles: [{ ...profile, userAgent: '' }] }));
  act(() => f.result.current.selectRequestProfile('known'));
  expect(f.setCrawlConfig).toHaveBeenLastCalledWith({ requestProfileId: 'known', userAgent: useToolsStore.getState().crawlConfig.userAgent });
  act(() => f.result.current.selectRequestProfile(''));
  expect(f.setCrawlConfig).toHaveBeenLastCalledWith({ requestProfileId: undefined, userAgent: useToolsStore.getState().crawlConfig.userAgent });
  expect(f.result.current.requestProfileStatus).toBeNull();
});
