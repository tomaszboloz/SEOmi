import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useOffPageSources } from '@/components/Domain/backlinkChecker/useOffPageSources';
import { analyzeSources } from '@/services/offPage/analyzeSources';
import { loadOffPageHistory } from '@/services/offPage/history';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import type { SourceAnalysis } from '@/services/offPage/sources';
import { completedAnalysis } from './fixtures/offPageHistory';
import { deferredSource, sourceProfile } from './fixtures/offPageSources';

vi.mock('@/services/offPage/analyzeSources', () => ({ analyzeSources: vi.fn() }));
const project = { id: 'p', name: 'Acme', rootUrl: 'https://acme.test', createdAt: '', lastOpenedAt: '' };
const profile = sourceProfile();
beforeEach(async () => {
  localStorage.clear(); vi.mocked(analyzeSources).mockReset();
  useProjectStore.setState({ projects: [project, { ...project, id: 'q' }], activeProjectId: 'p' });
  useToolsStore.setState({ crawlRuns: [] }); await i18n.changeLanguage('en');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('saves exactly once on completion and survives remount without re-running the analysis', async () => {
  vi.mocked(analyzeSources).mockResolvedValue(completedAnalysis());
  const view = renderHook(() => useOffPageSources(profile));
  expect(loadOffPageHistory('p')).toEqual([]);
  await act(async () => { await view.result.current.run(); });
  expect(view.result.current).toMatchObject({ status: 'done', historySaved: true });
  expect(loadOffPageHistory('p')).toEqual([view.result.current.record]);
  view.unmount(); renderHook(() => useOffPageSources(profile));
  expect(loadOffPageHistory('p')).toHaveLength(1);
  expect(analyzeSources).toHaveBeenCalledOnce();
});

it('keeps current export evidence when history storage fails', async () => {
  vi.mocked(analyzeSources).mockResolvedValue(completedAnalysis());
  const view = renderHook(() => useOffPageSources(profile));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await act(async () => { await view.result.current.run(); });
  expect(view.result.current).toMatchObject({ status: 'done', historySaved: false, record: { sourcesScored: 1 } });
  expect(loadOffPageHistory('p')).toEqual([]);
});

it.each(['cancel', 'project'])('never stores a late successful response after %s', async (change) => {
  const pending = deferredSource<SourceAnalysis>(); vi.mocked(analyzeSources).mockReturnValue(pending.promise);
  const view = renderHook(() => useOffPageSources(profile));
  let operation!: Promise<void>; act(() => { operation = view.result.current.run(); });
  act(() => { if (change === 'cancel') view.result.current.cancel(); else useProjectStore.setState({ activeProjectId: 'q' }); });
  await act(async () => { pending.resolve(completedAnalysis()); await operation; });
  expect(loadOffPageHistory('p')).toEqual([]); expect(loadOffPageHistory('q')).toEqual([]);
  expect(view.result.current.record).toBeNull();
});

it('does not save failures and allows a later valid completion', async () => {
  vi.mocked(analyzeSources).mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(completedAnalysis());
  const view = renderHook(() => useOffPageSources(profile));
  await act(async () => { await view.result.current.run(); });
  expect(view.result.current.status).toBe('unavailable'); expect(loadOffPageHistory('p')).toEqual([]);
  await act(async () => { await view.result.current.run(); });
  expect(loadOffPageHistory('p')).toHaveLength(1);
});
