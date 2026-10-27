import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import PrePublishWorkspace from '@/components/Charts/prePublish/PrePublishWorkspace';
import { usePrePublish } from '@/components/Charts/prePublish/usePrePublish';
import { createProvider } from '@/services/embeddings/registry';
import { deferredVectors, draftText, mockProvider, mountRun, vectorsFor } from './fixtures/prePublishMount';

vi.mock('@/services/embeddings/registry', async (original) => ({
  ...await original<typeof import('@/services/embeddings/registry')>(), createProvider: vi.fn(),
}));
beforeEach(async () => { localStorage.clear(); vi.clearAllMocks(); mockProvider(); await i18n.changeLanguage('en'); });
afterEach(cleanup);
it.each(['success', 'failure'])('cancels running embeddings and ignores late %s', async (outcome) => {
  const task = deferredVectors();
  const provider = mockProvider(vi.fn(() => task.promise));
  render(<PrePublishWorkspace projectId="mount-project" runs={[mountRun()]} />);
  fireEvent.change(screen.getByLabelText('Unpublished draft text'), { target: { value: draftText } });
  fireEvent.click(screen.getByRole('button', { name: 'Check draft' }));
  expect(screen.getByText('Embedding the draft and crawl evidence…')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Check draft' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Check cancelled. No result was applied.')).toBeTruthy();
  await act(async () => {
    if (outcome === 'success') task.resolve(vectorsFor(provider.embed.mock.calls[0][0]));
    else task.reject(new Error('late offline'));
  });
  expect(screen.getByText('Check cancelled. No result was applied.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Copy report' })).toBeNull();
});
it.each(['text', 'url'])('invalidates work immediately when draft %s changes', async (field) => {
  const task = deferredVectors();
  const provider = mockProvider(vi.fn(() => task.promise));
  const runs = [mountRun()];
  const hook = renderHook(() => usePrePublish('mount-project', runs));
  act(() => hook.result.current.changeText(draftText));
  let running!: Promise<void>;
  act(() => { running = hook.result.current.run(); });
  act(() => {
    if (field === 'text') hook.result.current.changeText('Updated draft');
    else hook.result.current.changeUrl('https://example.test/page-0');
  });
  expect(hook.result.current.status).toBe('stale');
  await act(async () => { task.resolve(vectorsFor(provider.embed.mock.calls[0][0])); await running; });
  expect(hook.result.current.report).toBeNull();
  expect(hook.result.current.status).toBe('stale');
});
it.each(['success', 'failure'])('never lets older %s overwrite a newer report', async (outcome) => {
  const task = deferredVectors();
  const provider = mockProvider();
  provider.embed.mockImplementationOnce(() => task.promise);
  const runs = [mountRun()];
  const hook = renderHook(() => usePrePublish('mount-project', runs));
  act(() => hook.result.current.changeText(draftText));
  let old!: Promise<void>;
  act(() => { old = hook.result.current.run(); });
  act(() => hook.result.current.changeUrl('https://example.test/page-0'));
  await act(async () => hook.result.current.run());
  const fresh = hook.result.current.report;
  expect(fresh?.conflicts).toHaveLength(2);
  await act(async () => {
    if (outcome === 'success') task.resolve(vectorsFor(provider.embed.mock.calls[0][0]));
    else task.reject(new Error('stale failure'));
    await old;
  });
  expect(hook.result.current.report).toBe(fresh);
  expect(hook.result.current.status).toBe('done');
});
it.each(['project', 'crawl', 'unmount'])('invalidates embedding work on %s change', async (change) => {
  const task = deferredVectors();
  const provider = mockProvider(vi.fn(() => task.promise));
  const hook = renderHook(({ projectId, runs }) => usePrePublish(projectId, runs), {
    initialProps: { projectId: 'mount-project', runs: [mountRun()] },
  });
  act(() => hook.result.current.changeText(draftText));
  const oldRun = hook.result.current.run;
  let running!: Promise<void>;
  act(() => { running = oldRun(); });
  if (change === 'unmount') hook.unmount();
  else hook.rerender({ projectId: change === 'project' ? 'other' : 'mount-project',
    runs: [mountRun(change === 'project' ? 'other' : 'mount-project', 'new-crawl')] });
  await act(async () => { task.resolve(vectorsFor(provider.embed.mock.calls[0][0])); await running; await oldRun(); });
  expect(createProvider).toHaveBeenCalledOnce();
  expect(hook.result.current.report).toBeNull();
  if (change !== 'unmount') expect(hook.result.current.status).toBe('stale');
});
it('guards retained callbacks and invalid inputs before starting embeddings', async () => {
  const runs = [mountRun()];
  const hook = renderHook(() => usePrePublish('mount-project', runs));
  await act(async () => hook.result.current.run());
  act(() => { hook.result.current.changeText(draftText); hook.result.current.changeUrl('bad'); });
  await act(async () => hook.result.current.run());
  expect(createProvider).not.toHaveBeenCalled();
  hook.unmount();
  const missing = renderHook(() => usePrePublish(null, runs));
  act(() => missing.result.current.changeText(draftText));
  await act(async () => missing.result.current.run());
  expect(createProvider).not.toHaveBeenCalled();
});
