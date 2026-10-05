import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { frameQueue, setupRouting, setEvidenceHash, dispatchHash, urlRow, linkRow, source, target } from './fixtures/crawlEvidenceRouting';

vi.mock('@/stores/projectStore', async () => ({ useProjectStore: (await import('./fixtures/crawlEvidenceProjectStore')).projectStore }));
beforeEach(() => history.replaceState(null, '', '/'));
afterEach(() => { document.body.replaceChildren(); history.replaceState(null, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['unmount', 'project', 'run', 'new-hash'])('rejects a queued URL scroll after %s', kind => {
  const queue = frameQueue(); const row = urlRow(); setEvidenceHash();
  const { unmount, rerender, props } = setupRouting();
  if (kind === 'unmount') unmount();
  if (kind === 'project') rerender({ ...props, activeProjectId: 'two' });
  if (kind === 'run') rerender({ ...props, navigationRunId: 'new-run' });
  if (kind === 'new-hash') { history.replaceState(null, '', '#workspace'); dispatchHash(); }
  queue.flush(0); expect(row.scrollIntoView).not.toHaveBeenCalled();
});

it('scrolls only the latest URL when evidence hashes change', () => {
  const queue = frameQueue(); const oldRow = urlRow(); const next = urlRow(target); setEvidenceHash();
  setupRouting(); setEvidenceHash({ url: target }); dispatchHash();
  queue.flush(0); expect(oldRow.scrollIntoView).not.toHaveBeenCalled();
  queue.flush(1); expect(next.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center' });
});

it.each(['unmount', 'project', 'run', 'new-evidence'])('rejects a queued second link frame after %s', kind => {
  const queue = frameQueue(); const row = linkRow();
  const { unmount, rerender, props } = setupRouting(true); queue.flush(0);
  if (kind === 'unmount') unmount();
  if (kind === 'project') rerender({ ...props, activeProjectId: 'two' });
  if (kind === 'run') rerender({ ...props, navigationRunId: 'new-run' });
  if (kind === 'new-evidence') rerender({ ...props, filterState: { ...props.filterState, linkEvidence: { source: target, target: source } } });
  queue.flush(1); expect(row.scrollIntoView).not.toHaveBeenCalled();
});

it('does not regain URL scroll ownership after leaving and returning to the original run', () => {
  const queue = frameQueue(); const row = urlRow(); setEvidenceHash(); const { rerender, props } = setupRouting();
  rerender({ ...props, navigationRunId: 'other' }); rerender(props);
  queue.flush(0); expect(row.scrollIntoView).not.toHaveBeenCalled();
});
