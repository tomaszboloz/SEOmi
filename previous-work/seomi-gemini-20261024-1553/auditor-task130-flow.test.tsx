import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { LinksWorkspace } from '@/components/Charts/semanticTopical/LinksWorkspace';
import { readTasks, writeTasks } from '@/services/optimizationTasks/storage';
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

beforeEach(async () => {
  await i18n.changeLanguage('en'); localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(IMPL));
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected network in mounted task verification'); }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('auditor task130 production flow', () => {
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
});
