import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SignalsWorkspace } from '@/components/Charts/semanticTopical/signals/SignalsWorkspace';
import { SemanticWorkspacePanels } from '@/components/Charts/semanticTopical/SemanticWorkspacePanels';
import { appendSerpSnapshot, decayStorageKey, loadSerpHistory } from '@/services/semanticDecay/snapshotStore';
import type { SemanticMap } from '@/services/semanticGraph/types';
import { historySnapshot } from './fixtures/decayHistory';

const graph: SemanticMap = {
  nodes: [], edges: [], topicEdges: [], clusters: [], totalEdges: 0, totalTopicEdges: 0,
  totalInternalLinks: 0, hasSemanticTerms: false, truncated: false,
};
const workspace = (projectId: string | null = 'p1') => <SignalsWorkspace projectId={projectId} pages={[]} graph={graph} />;
const panel = () => within(screen.getByRole('region', { name: 'Semantic Decay Radar' }));
const seed = (projectId = 'p1', drift = true) => {
  appendSerpSnapshot(projectId, historySnapshot());
  for (const index of [1, 2]) appendSerpSnapshot(projectId, historySnapshot(index, { centroid: new Float64Array(drift ? [0, 1] : [1, 0]) }));
};
beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('SignalsWorkspace stored SERP history', () => {
  it('keeps an honest empty state with zero backing snapshots', () => {
    render(workspace());
    expect(panel().getByRole('status').textContent).toMatch(/Not enough comparable SERP snapshots/);
    expect(panel().getByText('Snapshots supporting this verdict: 0')).toBeTruthy();
    expect(panel().queryByRole('list')).toBeNull();
  });

  it('loads the real history and persists an alert once, honoring cooldown across remounts', () => {
    seed();
    const mounted = render(workspace());
    expect(panel().getByRole('status').textContent).toMatch(/Persistent drift against/);
    expect(panel().getByText('Snapshots supporting this verdict: 3')).toBeTruthy();
    expect(loadSerpHistory('p1').lastAlertAt).toBe('2026-10-24T12:00:00.000Z');
    mounted.unmount();
    const again = render(workspace());
    expect(panel().getByRole('status').textContent).toMatch(/already raised recently/);
    again.unmount();
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    render(workspace());
    expect(panel().getByRole('status').textContent).toMatch(/Persistent drift against/);
    expect(loadSerpHistory('p1').lastAlertAt).toBe('2026-11-01T12:00:00.000Z');
  });

  it('reacts to new observations without leaking another project or query', () => {
    const mounted = render(workspace());
    act(() => { seed('p2'); });
    expect(panel().getByText('Snapshots supporting this verdict: 0')).toBeTruthy();
    act(() => { seed('p1', false); appendSerpSnapshot('p1', historySnapshot(5, { query: 'new-singleton' })); });
    expect(panel().getByRole('status').textContent).toMatch(/No material change/);
    expect(panel().getByText('Snapshots supporting this verdict: 3')).toBeTruthy();
    expect(loadSerpHistory('p1').lastAlertAt).toBeNull();
    mounted.rerender(workspace('p2'));
    expect(panel().getByRole('status').textContent).toMatch(/Persistent drift against/);
    mounted.rerender(workspace(null));
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: null })); });
    expect(panel().getByText('Snapshots supporting this verdict: 0')).toBeTruthy();
  });

  it('reloads matching external storage changes and ignores unrelated keys', () => {
    seed();
    render(workspace());
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })); });
    expect(panel().getByRole('status').textContent).toMatch(/Persistent drift against/);
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: decayStorageKey('p1') })); });
    expect(panel().getByRole('status').textContent).toMatch(/already raised recently/);
    act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key: null })); });
    expect(panel().getByText('Snapshots supporting this verdict: 0')).toBeTruthy();
  });

  it('reports unavailable semantic evidence honestly despite three stored runs', () => {
    for (const index of [0, 1, 2]) appendSerpSnapshot('p1', historySnapshot(index, { centroid: null }));
    render(workspace());
    expect(panel().getByText('Snapshots supporting this verdict: 3')).toBeTruthy();
    expect(panel().getByRole('status').textContent).toMatch(/Not enough comparable SERP snapshots/);
    expect(loadSerpHistory('p1').lastAlertAt).toBeNull();
  });

  it('receives the project owned by the semantic workspace session', () => {
    seed('session-project', false);
    const session = {
      projectId: 'session-project', pages: [], graph, workspacePreferences: { view: 'signals' },
      setSelectedId: vi.fn(), updateWorkspacePreferences: vi.fn(),
    } as unknown as Parameters<typeof SemanticWorkspacePanels>[0]['session'];
    render(<SemanticWorkspacePanels session={session} />);
    expect(panel().getByText('Snapshots supporting this verdict: 3')).toBeTruthy();
    expect(panel().getByRole('status').textContent).toMatch(/No material change/);
  });
});
