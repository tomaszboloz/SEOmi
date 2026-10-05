import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { frameQueue, setupRouting, setEvidenceHash, dispatchHash, urlRow, linkRow, source, target } from './fixtures/crawlEvidenceRouting';
import { selectProject } from './fixtures/crawlEvidenceProjectStore';

vi.mock('@/stores/projectStore', async () => ({ useProjectStore: (await import('./fixtures/crawlEvidenceProjectStore')).projectStore }));
beforeEach(() => { history.replaceState(null, '', '/'); selectProject.mockReset(); });
afterEach(() => { document.body.replaceChildren(); history.replaceState(null, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('routes an encoded URL to the exact run and resets URL filters before scrolling', () => {
  const queue = frameQueue(); const row = urlRow(); setEvidenceHash(); const { props } = setupRouting();
  expect(props.tabNav.setActiveTab).toHaveBeenCalledExactlyOnceWith('urls');
  expect(props.onSelectRun).toHaveBeenCalledExactlyOnceWith('run');
  expect(props.filterState.setQuery).toHaveBeenCalledExactlyOnceWith(source);
  expect(props.filterState.setEvidenceUrl).toHaveBeenCalledExactlyOnceWith(source);
  for (const setter of [props.filterState.setSeverity, props.filterState.setErrorKind, props.filterState.setSegment]) expect(setter).toHaveBeenCalledExactlyOnceWith('all');
  expect(props.filterState.setOnlyProblems).toHaveBeenCalledExactlyOnceWith(false);
  expect(props.filterState.setLinkEvidence).not.toHaveBeenCalled(); expect(selectProject).not.toHaveBeenCalled();
  expect(row.scrollIntoView).not.toHaveBeenCalled(); queue.flush(0);
  expect(row.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center' });
});

it('routes a link pair with exact decoded source/target and resets only link filters', () => {
  const queue = frameQueue(); setEvidenceHash({ tab: 'links', source, target }); const { props } = setupRouting();
  expect(props.tabNav.setActiveTab).toHaveBeenCalledExactlyOnceWith('links');
  expect(props.filterState.setLinkQuery).toHaveBeenCalledExactlyOnceWith('');
  expect(props.filterState.setLinkKind).toHaveBeenCalledExactlyOnceWith('all');
  expect(props.filterState.setLinkStatus).toHaveBeenCalledExactlyOnceWith('all');
  expect(props.filterState.setLinkEvidence).toHaveBeenCalledExactlyOnceWith({ source, target });
  expect(props.onSelectRun).toHaveBeenCalledExactlyOnceWith('run'); expect(props.filterState.setQuery).not.toHaveBeenCalled();
  expect(queue.callbacks).toHaveLength(0);
});

it.each(['project', 'run', 'url'])('ignores a missing %s hash parameter', missing => {
  frameQueue(); setEvidenceHash({ [missing]: '' }); const { props } = setupRouting();
  expect(props.onSelectRun).not.toHaveBeenCalled(); expect(props.tabNav.setActiveTab).not.toHaveBeenCalled(); expect(selectProject).not.toHaveBeenCalled();
});

it.each(['unknown-project', 'unknown-run', 'ordinary-hash'])('ignores unavailable routing context %s', context => {
  frameQueue();
  if (context === 'ordinary-hash') history.replaceState(null, '', '#workspace');
  else setEvidenceHash(context === 'unknown-project' ? { project: 'missing' } : { run: 'missing' });
  const { props } = setupRouting(); expect(props.onSelectRun).not.toHaveBeenCalled(); expect(selectProject).not.toHaveBeenCalled();
});

it('selects a known other project before routing its run after hydration', () => {
  frameQueue(); setEvidenceHash({ project: 'two' }); const { props, rerender } = setupRouting();
  expect(selectProject).toHaveBeenCalledExactlyOnceWith('two'); expect(props.onSelectRun).not.toHaveBeenCalled();
  rerender({ ...props, activeProjectId: 'two' }); expect(props.onSelectRun).toHaveBeenCalledExactlyOnceWith('run');
});

it.each(['source', 'target'])('falls back to URL evidence when link %s is missing', missing => {
  frameQueue(); setEvidenceHash({ tab: 'links', source, target, [missing]: '' }); const { props } = setupRouting();
  expect(props.tabNav.setActiveTab).toHaveBeenCalledExactlyOnceWith('urls');
  expect(props.filterState.setLinkEvidence).not.toHaveBeenCalled(); expect(props.filterState.setQuery).toHaveBeenCalledWith(source);
});

it('finds only the exact link pair after both frames and does not scroll partial matches', () => {
  const queue = frameQueue(); const wrongSource = linkRow(target, target); const wrongTarget = linkRow(source, source);
  const correct = linkRow(); setupRouting(true); queue.flush(0);
  expect(correct.scrollIntoView).not.toHaveBeenCalled(); queue.flush(1);
  expect(correct.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center' });
  expect(wrongSource.scrollIntoView).not.toHaveBeenCalled(); expect(wrongTarget.scrollIntoView).not.toHaveBeenCalled();
});

it('supports unavailable RAF and missing URL/link rows without throwing', () => {
  vi.stubGlobal('requestAnimationFrame', undefined); setEvidenceHash();
  expect(() => setupRouting()).not.toThrow(); expect(() => setupRouting(true)).not.toThrow();
});

it('scrolls immediately without RAF and safely supports a target lacking scrollIntoView', () => {
  vi.stubGlobal('requestAnimationFrame', undefined); const row = urlRow(); setEvidenceHash(); setupRouting();
  expect(row.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center' });
  const link = linkRow(); setupRouting(true); expect(link.scrollIntoView).toHaveBeenCalledOnce();
  const plain = document.createElement('div'); plain.id = row.id; row.replaceWith(plain); expect(dispatchHash).not.toThrow();
});

it('ignores hash events after unmount', () => {
  frameQueue(); const { unmount, props } = setupRouting(); unmount(); setEvidenceHash(); dispatchHash();
  expect(props.onSelectRun).not.toHaveBeenCalled(); expect(props.tabNav.setActiveTab).not.toHaveBeenCalled();
});

it('does not replay an old hash route when the user manually selects another run', () => {
  frameQueue(); setEvidenceHash(); const { props, rerender } = setupRouting();
  expect(props.onSelectRun).toHaveBeenCalledExactlyOnceWith('run');
  rerender({ ...props, navigationRunId: 'manually-selected' });
  expect(props.onSelectRun).toHaveBeenCalledExactlyOnceWith('run');
});

it('permits the route-owned run transition before its queued URL scroll', () => {
  const queue = frameQueue(); const row = urlRow();
  const { props, rerender } = setupRouting();
  rerender({ ...props, navigationRunId: 'previous' }); setEvidenceHash(); dispatchHash();
  rerender(props); queue.flush(0);
  expect(row.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center' });
});

it('guards late URL and link frames without cancellation support', () => {
  const queue = frameQueue(); vi.stubGlobal('cancelAnimationFrame', undefined);
  const row = urlRow(); setEvidenceHash(); const first = setupRouting(); first.unmount(); queue.flush(0);
  expect(row.scrollIntoView).not.toHaveBeenCalled(); history.replaceState(null, '', '/');
  const link = linkRow(); const second = setupRouting(true); queue.flush(1); second.unmount(); queue.flush(2);
  expect(link.scrollIntoView).not.toHaveBeenCalled();
});

it('does not schedule a second link frame after the first frame loses ownership', () => {
  const queue = frameQueue(); const { unmount } = setupRouting(true); unmount(); queue.flush(0);
  expect(queue.callbacks).toHaveLength(1); expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
});

it('does not scroll links when evidence is absent or the active tab is not links', () => {
  const queue = frameQueue(); const row = linkRow(); const { props, rerender } = setupRouting();
  rerender({ ...props, filterState: { ...props.filterState, linkEvidence: { source, target } } });
  expect(queue.callbacks).toHaveLength(0); expect(row.scrollIntoView).not.toHaveBeenCalled();
});
