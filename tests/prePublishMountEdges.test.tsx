import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { usePrePublish } from '@/components/Charts/prePublish/usePrePublish';
import { insufficientPrePublish, prePublishContext } from '@/services/prePublish/context';
import { checkPrePublish } from '@/services/prePublish/embeddingCheck';
import { buildRunReport } from '@/services/siteFocusMonitoring';
import type { PrePublishReport } from '@/services/prePublish/check';
import { createCrawlPageFixture } from './fixtures/crawl';
import { draftText, mountContext, mountRun } from './fixtures/prePublishMount';

vi.mock('@/services/siteFocusMonitoring', async (original) => ({
  ...await original<typeof import('@/services/siteFocusMonitoring')>(), buildRunReport: vi.fn(),
}));
vi.mock('@/services/prePublish/embeddingCheck', () => ({ checkPrePublish: vi.fn() }));
beforeEach(async () => {
  const original = await vi.importActual<typeof import('@/services/siteFocusMonitoring')>('@/services/siteFocusMonitoring');
  vi.mocked(buildRunReport).mockImplementation(original.buildRunReport);
  vi.mocked(checkPrePublish).mockReset();
  localStorage.clear(); await i18n.changeLanguage('en');
});
afterEach(cleanup);
it('omits report entries without corresponding crawl text instead of inventing vectors', () => {
  const context = mountContext();
  const score = context.pages[0].score;
  const run = mountRun();
  run.result.pages = [run.result.pages[0], createCrawlPageFixture({ url: 'empty' })];
  vi.mocked(buildRunReport).mockReturnValue({ ...context.focus!, pages: [score,
    { ...score, url: 'missing' }, { ...score, url: 'empty' }] });
  expect(prePublishContext('mount-project', [run]).pages).toHaveLength(1);
});
it('ignores a superseded successful response even when the embedding service ignores cancellation', async () => {
  let finish!: (report: PrePublishReport) => void;
  const oldReport = insufficientPrePublish('no-core');
  const freshReport = insufficientPrePublish('corpus-too-small');
  vi.mocked(checkPrePublish).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }))
    .mockResolvedValueOnce(freshReport);
  const runs = [mountRun()];
  const hook = renderHook(() => usePrePublish('mount-project', runs));
  act(() => hook.result.current.changeText(draftText));
  let old!: Promise<void>;
  act(() => { old = hook.result.current.run(); });
  act(() => hook.result.current.changeText(`${draftText} Updated`));
  await act(async () => hook.result.current.run());
  expect(hook.result.current.report).toBe(freshReport);
  await act(async () => { finish(oldReport); await old; });
  expect(hook.result.current.report).toBe(freshReport);
});
