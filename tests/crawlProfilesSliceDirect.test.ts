import { beforeEach, expect, it, vi } from 'vitest';
import { createCrawlProfilesSlice } from '@/stores/tools/crawlProfilesSlice';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
const input = { name: '  fixture  ', userAgent: ' fixture-agent ', headers: [{ name: 'X-Fixture', value: 'fixture-value' }],
  cookie: 'fixture-cookie', proxyUrl: 'http://proxy.test/' };
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'profiles-direct' }); });

it('persists URL, limit and configuration through the direct profile factory', () => {
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlProfilesSlice(set, get, services));
  actions.setCrawlUrl('https://example.test/');
  actions.setCrawlLimit(42);
  actions.setCrawlConfig({ maxDepth: 3 });
  expect(store.getState()).toMatchObject({ crawlUrl: 'https://example.test/', crawlLimit: 42, crawlConfig: { maxDepth: 3 } });
  expect(JSON.parse(localStorage.getItem('seomi_project_profiles-direct_crawl_settings')!))
    .toMatchObject({ url: 'https://example.test/', limit: 42, config: { maxDepth: 3 } });
});

it('sends private profile fields only to native storage and keeps metadata in project preferences', async () => {
  const invoke = vi.fn().mockResolvedValue(undefined);
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlProfilesSlice(set, get, services), { invoke });
  const profile = await actions.saveCrawlRequestProfile(input);
  expect(invoke).toHaveBeenCalledWith('save_crawl_auth_profile', expect.objectContaining({
    projectId: 'profiles-direct', profileId: profile.id, cookie: input.cookie, proxyUrl: input.proxyUrl, headers: input.headers,
  }));
  expect(profile).toMatchObject({ name: 'fixture', userAgent: 'fixture-agent', hasCookie: true, hasHeaders: true, hasProxy: true });
  expect(store.getState().crawlConfig).toMatchObject({ requestProfileId: profile.id, userAgent: 'fixture-agent' });
  const stored = localStorage.getItem('seomi_project_profiles-direct_crawl_request_profiles_v1') || '';
  expect(stored).not.toContain('fixture-cookie');
  expect(stored).not.toContain('fixture-value');
  expect(stored).not.toContain('proxy.test');
  await actions.saveCrawlRequestProfile({ ...input, id: profile.id, name: 'updated', headers: [], cookie: '', proxyUrl: '' });
  expect(store.getState().crawlRequestProfiles).toHaveLength(1);
  expect(store.getState().crawlRequestProfiles[0]).toMatchObject({ createdAt: profile.createdAt, hasCookie: false, hasHeaders: false, hasProxy: false });
  const other = await actions.saveCrawlRequestProfile({ ...input, name: 'other' });
  await actions.deleteCrawlRequestProfile(profile.id);
  expect(store.getState().crawlConfig.requestProfileId).toBe(other.id);
  expect(store.getState().crawlRequestProfiles.map(row => row.id)).toEqual([other.id]);
  await actions.deleteCrawlRequestProfile(other.id);
  expect(store.getState().crawlRequestProfiles).toEqual([]);
  expect(store.getState().crawlConfig.requestProfileId).toBeUndefined();
});

it.each([{ name: '' }, { name: 'x'.repeat(81) }, { userAgent: 'x'.repeat(1025) }])(
  'rejects invalid profile before native writes: %j', async patch => {
    const invoke = vi.fn();
    const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlProfilesSlice(set, get, services), { invoke });
    await expect(actions.saveCrawlRequestProfile({ ...input, ...patch })).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
    expect(store.getState().isSavingCrawlRequestProfile).toBe(false);
  },
);

it('requires a project for profile creation and deletion', async () => {
  useProjectStore.setState({ activeProjectId: null });
  const invoke = vi.fn();
  const { actions } = isolatedToolsSlice((set, get, services) => createCrawlProfilesSlice(set, get, services), { invoke });
  await expect(actions.saveCrawlRequestProfile(input)).rejects.toThrow();
  await expect(actions.deleteCrawlRequestProfile('missing')).rejects.toThrow();
  expect(invoke).not.toHaveBeenCalled();
});

it('contains native profile failure and restores the saving indicator', async () => {
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlProfilesSlice(set, get, services),
    { invoke: vi.fn().mockRejectedValue(new Error('native failure')) });
  await expect(actions.saveCrawlRequestProfile(input)).rejects.toThrow('native failure');
  expect(store.getState().isSavingCrawlRequestProfile).toBe(false);
  expect(store.getState().crawlRequestProfiles).toEqual([]);
});
