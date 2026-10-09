import { beforeEach, expect, it, vi } from 'vitest';
import { createGscSlice } from '@/stores/tools/gscSlice';
import { gscPropertyKey } from '@/stores/tools/projectPreferences';
import { useProjectStore } from '@/stores/projectStore';
import type { ToolsServices } from '@/stores/tools/contracts';

const account = [
  { siteUrl: 'sc-domain:blocked.test', permissionLevel: 'siteUnverifiedUser' },
  { siteUrl: 'sc-domain:unrelated.test', permissionLevel: 'siteOwner' },
  { siteUrl: 'sc-domain:site.test', permissionLevel: 'siteOwner' },
];
const setup = (initial: Record<string, unknown> = {}) => {
  const state: Record<string, any> = { gscClientId: 'client', gscClientSecret: '', gscProperty: '', gscFilters: {}, isGscConnected: false, ...initial };
  const invoke = vi.fn().mockResolvedValue(account);
  const slice = createGscSlice((patch: any) => Object.assign(state, typeof patch === 'function' ? patch(state) : patch), (() => state) as never, { invoke } as unknown as ToolsServices);
  return { state, slice };
};
const project = (rootUrl?: string) => useProjectStore.setState({
  projects: [{ id: 'p1', name: 'Site', rootUrl, createdAt: '2026-10-09T00:00:00.000Z', lastOpenedAt: '2026-10-09T00:00:00.000Z' }],
});

beforeEach(() => { localStorage.clear(); localStorage.setItem('seomi_active_project_v1', 'p1'); });

it('connects to the property of the project site instead of the first one in the account', async () => {
  project('https://www.site.test');
  const { state, slice } = setup();
  await slice.connectGsc('client');
  expect(state.gscProperty).toBe('sc-domain:site.test');
  expect(localStorage.getItem(gscPropertyKey('p1'))).toBe('sc-domain:site.test');
});

it('replaces stale properties, clears unmatched roots, and uses a verified property without a root', async () => {
  project('https://www.site.test');
  const kept = setup({ gscProperty: 'sc-domain:unrelated.test' });
  await kept.slice.resumeGsc();
  expect(kept.state.gscProperty).toBe('sc-domain:site.test');
  expect(localStorage.getItem(gscPropertyKey('p1'))).toBe('sc-domain:site.test');

  project('https://absent.test');
  const none = setup();
  await none.slice.resumeGsc();
  expect(none.state).toMatchObject({ isGscConnected: true, gscProperty: '' });
  expect(localStorage.getItem(gscPropertyKey('p1'))).toBeNull();

  project();
  const withoutRoot = setup();
  await withoutRoot.slice.resumeGsc();
  expect(withoutRoot.state.gscProperty).toBe('sc-domain:unrelated.test');
  expect(localStorage.getItem(gscPropertyKey('p1'))).toBe('sc-domain:unrelated.test');
});
