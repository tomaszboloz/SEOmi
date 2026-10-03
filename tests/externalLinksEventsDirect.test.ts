import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ExternalLinkCheckProgress } from '@/types';
import { createExternalLinksSlice } from '@/stores/tools/externalLinksSlice';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { externalRun, checkedBatch } from './fixtures/externalLinksSlice';
const native = vi.hoisted(() => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: native.listen }));
beforeEach(() => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: 'external-events' });
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  native.listen.mockReset();
});
afterEach(() => { delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__; });

it('accepts only current native progress and releases its listener after completion', async () => {
  let listener!: (event: { payload: ExternalLinkCheckProgress }) => void;
  const unlisten = vi.fn();
  native.listen.mockImplementation((_event, callback) => { listener = callback; return Promise.resolve(unlisten); });
  let complete!: (value: unknown) => void;
  const invoke = vi.fn().mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services),
    { invoke, saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }) });
  const run = externalRun();
  store.setState({ crawlRuns: [run] });
  const checking = actions.checkCrawlExternalLinks(run.id, 10);
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledOnce());
  const progress = store.getState().crawlExternalLinkCheckProgress!;
  listener({ payload: { ...progress, requestId: 'unrelated', completed: 1 } });
  expect(store.getState().crawlExternalLinkCheckProgress?.completed).toBe(0);
  listener({ payload: { ...progress, completed: 1, currentUrl: 'https://outside.example/path' } });
  expect(store.getState().crawlExternalLinkCheckProgress?.completed).toBe(1);
  useProjectStore.setState({ activeProjectId: 'other-project' });
  listener({ payload: { ...progress, completed: 2 } });
  expect(store.getState().crawlExternalLinkCheckProgress?.completed).toBe(1);
  useProjectStore.setState({ activeProjectId: 'external-events' });
  complete(checkedBatch);
  await checking;
  expect(unlisten).toHaveBeenCalledOnce();
  expect(store.getState()).toMatchObject({ isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null });
});

it('contains a listener registration failure before any native batch request', async () => {
  native.listen.mockRejectedValue(new Error('listener failed'));
  const invoke = vi.fn();
  const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services), { invoke });
  const run = externalRun();
  store.setState({ crawlRuns: [run] });
  await actions.checkCrawlExternalLinks(run.id, 10);
  expect(invoke).not.toHaveBeenCalled();
  expect(store.getState()).toMatchObject({ isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckError: 'listener failed' });
});
