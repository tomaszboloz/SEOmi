import { act, renderHook } from '@testing-library/react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCrawlEvidenceRouting } from '@/hooks/app/useCrawlEvidenceRouting';

const fixture = vi.hoisted(() => ({ selectProject: vi.fn(), setActiveTab: vi.fn() }));
vi.mock('@/stores/projectStore', async () => {
  const { create } = await import('zustand');
  return { useProjectStore: create(() => ({ activeProjectId: 'one', projects: [{ id: 'one' }, { id: 'two' }], selectProject: fixture.selectProject })) };
});
vi.mock('@/stores/auditStore', async () => {
  const { create } = await import('zustand');
  return { useAuditStore: create(() => ({ setActiveTab: fixture.setActiveTab })) };
});
import { useProjectStore } from '@/stores/projectStore';

type FixtureProjectState = {
  activeProjectId: string | null;
  projects: { id: string }[];
  selectProject: (id: string) => void;
};
const projectStore = useProjectStore as unknown as UseBoundStore<StoreApi<FixtureProjectState>>;
function hash(values: Record<string, string> = {}) {
  history.replaceState(null, '', `#crawl-evidence?${new URLSearchParams({ project: 'one', run: 'run', url: 'https://example.test/a?x=1&y=2#part', ...values })}`);
}
function changedHash() { act(() => window.dispatchEvent(new Event('hashchange'))); }
beforeEach(() => {
  history.replaceState(null, '', '/'); fixture.selectProject.mockReset(); fixture.setActiveTab.mockReset();
  projectStore.setState({ activeProjectId: 'one', projects: [{ id: 'one' }, { id: 'two' }], selectProject: fixture.selectProject });
});
afterEach(() => { history.replaceState(null, '', '/'); vi.restoreAllMocks(); });

it('opens site audit for valid current-project evidence without reselecting the project', () => {
  hash(); renderHook(useCrawlEvidenceRouting);
  expect(fixture.selectProject).not.toHaveBeenCalled();
  expect(fixture.setActiveTab).toHaveBeenCalledExactlyOnceWith('site-audit');
});

it('selects the exact other project before opening the audit tab', () => {
  hash({ project: 'two' }); renderHook(useCrawlEvidenceRouting);
  expect(fixture.selectProject).toHaveBeenCalledExactlyOnceWith('two');
  expect(fixture.setActiveTab).toHaveBeenCalledExactlyOnceWith('site-audit');
  expect(fixture.selectProject.mock.invocationCallOrder[0]).toBeLessThan(fixture.setActiveTab.mock.invocationCallOrder[0]);
});

it.each(['project', 'run', 'url'])('ignores evidence with empty %s', missing => {
  hash({ [missing]: '' }); renderHook(useCrawlEvidenceRouting);
  expect(fixture.selectProject).not.toHaveBeenCalled(); expect(fixture.setActiveTab).not.toHaveBeenCalled();
});

it.each(['#workspace', '#crawl-evidence', '#other?project=one&run=run&url=https://example.test'])('ignores unrelated or incomplete hash %s', value => {
  history.replaceState(null, '', value); renderHook(useCrawlEvidenceRouting);
  expect(fixture.selectProject).not.toHaveBeenCalled(); expect(fixture.setActiveTab).not.toHaveBeenCalled();
});

it('ignores unknown projects and responds when the catalog later includes that project', () => {
  hash({ project: 'three' }); renderHook(useCrawlEvidenceRouting);
  expect(fixture.setActiveTab).not.toHaveBeenCalled();
  act(() => projectStore.setState({ projects: [{ id: 'three' }] }));
  expect(fixture.selectProject).toHaveBeenCalledExactlyOnceWith('three');
  expect(fixture.setActiveTab).toHaveBeenCalledExactlyOnceWith('site-audit');
});

it('routes new hashes through the current selected project and updated callbacks', () => {
  renderHook(useCrawlEvidenceRouting); hash({ project: 'two' }); changedHash();
  expect(fixture.selectProject).toHaveBeenCalledExactlyOnceWith('two');
  act(() => projectStore.setState({ activeProjectId: 'two' }));
  fixture.selectProject.mockClear(); fixture.setActiveTab.mockClear();
  changedHash(); expect(fixture.selectProject).not.toHaveBeenCalled(); expect(fixture.setActiveTab).toHaveBeenCalledExactlyOnceWith('site-audit');
  const replacement = vi.fn(); act(() => projectStore.setState({ selectProject: replacement }));
  hash(); changedHash(); expect(replacement).toHaveBeenCalledExactlyOnceWith('one');
});

it('supports a projectless workspace and decoded project IDs', () => {
  const id = 'project with Unicode ż & spaces';
  projectStore.setState({ activeProjectId: null, projects: [{ id }] }); hash({ project: id });
  renderHook(useCrawlEvidenceRouting); expect(fixture.selectProject).toHaveBeenCalledExactlyOnceWith(id);
});

it('removes the hash listener after unmount', () => {
  const { unmount } = renderHook(useCrawlEvidenceRouting); unmount(); hash(); changedHash();
  expect(fixture.selectProject).not.toHaveBeenCalled(); expect(fixture.setActiveTab).not.toHaveBeenCalled();
});
