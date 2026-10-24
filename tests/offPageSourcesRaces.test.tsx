import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useOffPageSources } from '@/components/Domain/backlinkChecker/useOffPageSources';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { analyzeSources } from '@/services/offPage/analyzeSources';
import type { SourceAnalysis } from '@/services/offPage/sources';
import { deferredSource, sourceAnalysis, sourceEvidence, sourceProfile } from './fixtures/offPageSources';
import { mountRun } from './fixtures/prePublishMount';

vi.mock('@/services/offPage/analyzeSources', () => ({ analyzeSources: vi.fn() }));
const project = { id: 'mount-project', name: 'Acme', rootUrl: 'https://acme.test', createdAt: '', lastOpenedAt: '' };
const profile = sourceProfile();
beforeEach(async () => {
  localStorage.clear(); vi.mocked(analyzeSources).mockReset();
  useProjectStore.setState({ projects: [project], activeProjectId: project.id });
  useToolsStore.setState({ crawlRuns: [mountRun()] });
  await i18n.changeLanguage('en');
});
afterEach(cleanup);
it('cancels a run and ignores old progress, completion and errors after a newer request', async () => {
  const old = deferredSource<SourceAnalysis>();
  const fresh = deferredSource<SourceAnalysis>();
  vi.mocked(analyzeSources).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const { result } = renderHook(() => useOffPageSources(profile));
  let older!: Promise<void>;
  act(() => { older = result.current.run(); });
  const oldSignal = vi.mocked(analyzeSources).mock.calls[0][5];
  const oldProgress = vi.mocked(analyzeSources).mock.calls[0][6];
  act(() => result.current.cancel());
  expect(result.current.status).toBe('cancelled');
  expect(oldSignal.aborted).toBe(true);
  let newer!: Promise<void>;
  act(() => { newer = result.current.run(); });
  await act(async () => { fresh.resolve(sourceAnalysis([])); await newer; });
  await act(async () => { oldProgress([sourceEvidence({ text: 'stale' })]); old.reject('old failure'); await older; });
  expect(result.current.status).toBe('done');
  expect(result.current.analysis?.sources).toEqual([]);
});
it.each(['project', 'profile', 'crawl', 'unmount', 'settings'])('discards late evidence when %s changes', async (change) => {
  const pending = deferredSource<SourceAnalysis>();
  vi.mocked(analyzeSources).mockReturnValue(pending.promise);
  const view = renderHook(({ selected }) => useOffPageSources(selected), { initialProps: { selected: profile } });
  const staleRun = view.result.current.run;
  let operation!: Promise<void>;
  act(() => { operation = view.result.current.run(); });
  const signal = vi.mocked(analyzeSources).mock.calls[0][5];
  act(() => {
    if (change === 'project') useProjectStore.setState({ activeProjectId: null });
    if (change === 'crawl') useToolsStore.setState({ crawlRuns: [] });
    if (change === 'settings') view.result.current.setSettings({ provider: 'ollama' });
  });
  if (change === 'profile') view.rerender({ selected: sourceProfile([]) });
  if (change === 'unmount') view.unmount();
  await act(async () => {
    pending.resolve(sourceAnalysis([sourceEvidence({ text: 'stale' })]));
    await operation;
    if (change !== 'settings') await staleRun();
  });
  expect(signal.aborted).toBe(true);
  if (change !== 'unmount') expect(view.result.current.analysis).toBeNull();
});
it('reports a current failure and aborts an earlier run even without explicit cancel', async () => {
  const pending = deferredSource<SourceAnalysis>();
  vi.mocked(analyzeSources).mockReturnValueOnce(pending.promise).mockRejectedValueOnce('failed');
  const { result } = renderHook(() => useOffPageSources(profile));
  let first!: Promise<void>;
  act(() => { first = result.current.run(); });
  const signal = vi.mocked(analyzeSources).mock.calls[0][5];
  await act(async () => { await result.current.run(); });
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(result.current.status).toBe('unavailable'));
  await act(async () => { pending.resolve(sourceAnalysis()); await first; });
  expect(result.current.status).toBe('unavailable');
});
it('restores local Ollama settings but never a remote/hybrid provider', () => {
  localStorage.setItem('seomi_project_mount-project_embedding_clustering_v1', JSON.stringify({ provider: 'ollama', ollamaModel: 'model', result: null }));
  const view = renderHook(() => useOffPageSources(profile));
  expect(view.result.current.settings).toEqual({ provider: 'ollama', ollamaModel: 'model' });
  view.unmount();
  localStorage.setItem('seomi_project_mount-project_embedding_clustering_v1', JSON.stringify({ provider: 'hybrid', result: null }));
  const local = renderHook(() => useOffPageSources(profile));
  expect(local.result.current.settings.provider).toBe('local');
});
