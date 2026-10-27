import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { LinksWorkspace } from '@/components/Charts/semanticTopical/LinksWorkspace';
import { readTasks, writeTasks } from '@/services/optimizationTasks/storage';
import { readMetricHistory } from '@/services/optimizationTasks/metricHistory';
import { runTaskVerification } from '@/services/optimizationTasks/runVerification';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const URL = 'https://audit130.test/removed';
const IMPL = '2026-10-26T10:00:00Z';
const verify = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.tasks.verify') as string }));
const seed = (project = 'audit130', patch: Partial<OptimizationTask> = {}) => {
  const task: OptimizationTask = { id: 'task', kind: 'remove-410', module: 'sfs', status: 'implemented',
    url: URL, baselineScore: null, priority: 'medium', createdAt: '2026-10-26T08:00:00Z', implementedAt: IMPL, ...patch };
  expect(writeTasks(project, [task])).toBe(true);
};
const run = (startedAt: string, completedAt: string) => createCrawlRunFixture({
  id: startedAt, startedAt, completedAt, startUrl: URL,
  result: createCrawlResultFixture({ start_url: URL, pages: [createCrawlPageFixture({ url: URL, final_url: URL, http_status: 410 })], duration_ms: 60_000 }),
});
const linkPages = [
  createCrawlPageFixture({ url: 'https://audit130.test/source', final_url: 'https://audit130.test/source', title: 'Solar source', word_count: 900, semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
  createCrawlPageFixture({ url: 'https://audit130.test/target', final_url: 'https://audit130.test/target', title: 'Solar target', word_count: 900, semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
];

beforeEach(async () => {
  await i18n.changeLanguage('en'); localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(IMPL));
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected network in mounted task verification'); }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('auditor task130 mounted freshness regressions', () => {
  it('keeps an old crawl unverified then accepts the later completed snapshot', () => {
    seed();
    const old = run('2026-10-26T09:00:00Z', '2026-10-26T09:01:00Z');
    const view = render(<LinksWorkspace projectId="audit130" pages={old.result.pages} run={old} />);
    verify(); expect(readTasks('audit130')[0].status).toBe('implemented');
    vi.setSystemTime(new Date('2026-10-26T10:02:00Z'));
    const fresh = run('2026-10-26T10:01:00Z', '2026-10-26T10:02:00Z');
    view.rerender(<LinksWorkspace projectId="audit130" pages={fresh.result.pages} run={fresh} />);
    verify();
    expect(readTasks('audit130')[0]).toMatchObject({ status: 'verified', verifiedAt: '2026-10-26T10:02:00.000Z', verdict: { code: 'gone-ok', delta: null, regression: false } });
  });

  it('does not borrow the timestamp of another page snapshot', () => {
    seed();
    const old = run('2026-10-26T09:00:00Z', '2026-10-26T09:01:00Z');
    const fresh = run('2026-10-26T10:01:00Z', '2026-10-26T10:02:00Z');
    render(<LinksWorkspace projectId="audit130" pages={old.result.pages} run={fresh} />);
    verify(); expect(readTasks('audit130')[0].status).toBe('implemented');
  });

  it.each(['', 'invalid'])('does not accept incomplete/invalid completion: %s', completedAt => {
    seed(); const next = run('2026-10-26T10:01:00Z', completedAt);
    render(<LinksWorkspace projectId="audit130" pages={next.result.pages} run={next} />);
    verify(); expect(readTasks('audit130')[0].status).toBe('implemented');
  });

  it('does not verify a legacy task without implementation time', () => {
    seed('audit130', { implementedAt: undefined }); const next = run('2026-10-26T10:01:00Z', '2026-10-26T10:02:00Z');
    render(<LinksWorkspace projectId="audit130" pages={next.result.pages} run={next} />);
    verify(); expect(readTasks('audit130')[0].status).toBe('implemented');
  });

  it('verifies only the currently displayed project after switching', () => {
    seed('project-a'); seed('project-b');
    const next = run('2026-10-26T10:01:00Z', '2026-10-26T10:02:00Z');
    const view = render(<LinksWorkspace projectId="project-a" pages={next.result.pages} run={next} />);
    view.rerender(<LinksWorkspace projectId="project-b" pages={next.result.pages} run={next} />);
    verify();
    expect(readTasks('project-a')[0].status).toBe('implemented');
    expect(readTasks('project-b')[0].status).toBe('verified');
  });

  it.each([
    ['timed out', { timed_out: true, cancelled: false }, '2026-10-26T10:02:00Z'],
    ['cancelled', { timed_out: false, cancelled: true }, '2026-10-26T10:02:00Z'],
    ['invalid completion', { timed_out: false, cancelled: false }, 'invalid'],
  ] as const)('fails closed for a %s selected crawl in the mounted workspace', (_label, resultPatch, completedAt) => {
    seed('audit130', { url: URL });
    const pages = [...linkPages, createCrawlPageFixture({ url: URL, final_url: URL, http_status: 410 })];
    const selected = createCrawlRunFixture({
      id: `incomplete-${_label}`,
      startedAt: '2026-10-26T10:01:00Z',
      completedAt,
      startUrl: URL,
      result: createCrawlResultFixture({ start_url: URL, pages, pages_crawled: pages.length, duration_ms: 60_000, ...resultPatch }),
    });
    render(<LinksWorkspace projectId="audit130" pages={pages} run={selected} />);

    const add = screen.getAllByRole('button', { name: i18n.t('executionCard.tasks.add') as string })[0];
    fireEvent.click(add);
    expect(readTasks('audit130')).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'add-link', baselineScore: null })]));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.tasks.verify') as string }));
    expect(readTasks('audit130').find((task) => task.id === 'task')?.status).toBe('implemented');
    expect(readMetricHistory('audit130')).toEqual([]);
  });

  it('verifies and records a real metric delta for a completed automatic crawl', () => {
    seed('audit130-positive', { module: 'eetv', kind: 'remove-noindex', baselineScore: 0 });
    const page = createCrawlPageFixture({ url: URL, final_url: URL, http_status: 200, indexability_status: 'Eligible' });
    const complete = createCrawlRunFixture({
      id: 'complete-automatic', startedAt: '2026-10-26T10:01:00Z', completedAt: '2026-10-26T10:02:00Z', startUrl: URL,
      result: createCrawlResultFixture({ start_url: URL, pages: [page], pages_crawled: 1, duration_ms: 60_000 }),
    });
    const verified = runTaskVerification('audit130-positive', complete);
    expect(verified[0]).toMatchObject({ status: 'verified', verdict: { code: 'index-ok' } });
    expect(typeof verified[0].verdict?.delta).toBe('number');
    expect(readMetricHistory('audit130-positive')).toHaveLength(1);
  });
});
