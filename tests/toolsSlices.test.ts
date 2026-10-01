import { createStore } from 'zustand/vanilla';
import { beforeEach, expect, it, vi } from 'vitest';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { createGscSlice } from '@/stores/tools/gscSlice';
import { toolsServices } from '@/stores/tools/services';
import type { ToolsServices, ToolsState } from '@/stores/tools/contracts';
import { beginToolRequest, isLatestToolRequest, errorMessage } from '@/stores/tools/runtime';
import { DEFAULT_CRAWL_CONFIG, normalizeCrawlLinkUrl, normalizeInterruptedCrawl, newestInterruptedCrawl } from '@/stores/tools/crawlPersistence';

beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'slice-project' }); });

const setup = (services: ToolsServices) => {
  const store = createStore<ToolsState>(() => ({ ...useToolsStore.getState(),
    gscClientId: 'client-id', gscClientSecret: '', gscProperty: '', gscProperties: [], isGscConnected: false,
    gscError: null, isGscLoading: false }));
  const actions = createGscSlice(store.setState, store.getState, services);
  return { store, actions };
};

it('resumes GSC through an injected transport and selects an actual property', async () => {
  const services = { ...toolsServices };
  const invoke = vi.spyOn(services, 'invoke').mockResolvedValue([{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }]);
  const { store, actions } = setup(services);
  await actions.resumeGsc();
  expect(invoke).toHaveBeenCalledWith('list_search_console_properties', { projectId: 'slice-project', clientId: 'client-id' });
  expect(store.getState()).toMatchObject({ isGscConnected: true, isGscLoading: false, gscProperty: 'sc-domain:example.com' });
});

it('contains GSC transport errors and clears loading without fabricating properties', async () => {
  const services = { ...toolsServices };
  const invoke = vi.spyOn(services, 'invoke').mockRejectedValue(new Error('fixture transport failure'));
  const { store, actions } = setup(services);
  await actions.resumeGsc();
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(store.getState()).toMatchObject({ isGscConnected: false, isGscLoading: false, gscError: 'fixture transport failure', gscProperties: [] });
});

it('rejects an old project response even with an isolated slice and dependency fixture', async () => {
  let resolveResponse!: (value: unknown) => void;
  const services = { ...toolsServices };
  const invoke = vi.spyOn(services, 'invoke').mockReturnValue(new Promise(resolve => { resolveResponse = resolve; }));
  const { store, actions } = setup(services);
  const pending = actions.resumeGsc();
  useProjectStore.setState({ activeProjectId: 'new-project' });
  store.setState({ isGscLoading: false });
  resolveResponse([{ siteUrl: 'sc-domain:old-project.example', permissionLevel: 'siteOwner' }]);
  await pending;
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(store.getState()).toMatchObject({ isGscConnected: false, gscProperties: [], gscProperty: '', isGscLoading: false });
});

it('keeps request tokens independent by operation and rejects superseded requests', () => {
  const first = beginToolRequest('fixture-domain');
  const other = beginToolRequest('fixture-keyword');
  const second = beginToolRequest('fixture-domain');
  expect(isLatestToolRequest('fixture-domain', first)).toBe(false);
  expect(isLatestToolRequest('fixture-domain', second)).toBe(true);
  expect(isLatestToolRequest('fixture-keyword', other)).toBe(true);
  expect(errorMessage(new Error('message'), 'fallback')).toBe('message');
  expect(errorMessage('text', 'fallback')).toBe('text');
  expect(errorMessage({}, 'fallback')).toBe('fallback');
});

it('recovers checkpoint ordering and keeps URL normalization deterministic', () => {
  expect(normalizeInterruptedCrawl(null)).toBeNull();
  const checkpoint = normalizeInterruptedCrawl({ url: 'https://example.com', limit: 25,
    config: DEFAULT_CRAWL_CONFIG, environment: 'default', startedAt: '2026-10-01T00:00:00Z' });
  expect(checkpoint).not.toBeNull();
  expect(newestInterruptedCrawl(null, checkpoint)).toEqual(checkpoint);
  expect(normalizeCrawlLinkUrl('https://example.com/page#section')).toBe('https://example.com/page');
  expect(normalizeCrawlLinkUrl(' invalid ')).toBe('invalid');
});
