import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_TASKS, markImplemented, planTask, readTasks, tasksKey, writeTasks } from '@/services/optimizationTasks/storage';
import { verifyTask, verifyTasks } from '@/services/optimizationTasks/verify';
import type { OptimizationTask, TaskKind } from '@/services/optimizationTasks/types';
import { createCrawlPageFixture as page } from './fixtures/crawl';

const task = (kind: TaskKind, patch: Partial<OptimizationTask> = {}): OptimizationTask => ({
  id: kind, kind, module: 'sfs', status: 'implemented', url: 'https://s.test/a', baselineScore: 50, priority: 'high', createdAt: 'now', ...patch,
});
const A = 'https://s.test/a';
const p = (patch = {}) => page({ url: A, final_url: A, ...patch });

describe('verifyTask per kind', () => {
  it('add-link: found with zone, found without zone, missing', () => {
    const link = { target_url: 'https://s.test/t#frag', anchor_text: 'x', is_internal: true };
    const t = task('add-link', { targetUrl: 'https://s.test/t' });
    expect(verifyTask(t, [p({ links: [{ ...link, zone: 'above_fold' }] })], 68)).toMatchObject({ status: 'verified', code: 'link-found', params: { zone: 'above_fold' }, delta: 18, regression: false });
    expect(verifyTask(t, [p({ semantic_links: [link] })], 50)?.params).toEqual({ zone: 'unknown' });
    expect(verifyTask(t, [p()], 50)).toMatchObject({ status: 'failed', code: 'link-missing' });
    expect(verifyTask({ ...t, targetUrl: undefined }, [p()], 50)?.code).toBe('link-missing');
    expect(verifyTask(t, [p({ semantic_links: undefined })], 50)?.code).toBe('link-missing');
  });

  it('redirect-301: ok, wrong target, still 200', () => {
    const t = task('redirect-301', { targetUrl: 'https://s.test/new' });
    const hop = [{ from_url: A, http_status: 301, to_url: 'https://s.test/new' }];
    expect(verifyTask(t, [p({ redirect_chain: hop, final_url: 'https://s.test/new' })], null)).toMatchObject({ status: 'verified', code: 'redirect-ok', delta: null });
    expect(verifyTask(t, [p({ redirect_chain: hop, final_url: 'https://s.test/other' })], null)?.code).toBe('redirect-wrong-target');
    expect(verifyTask(t, [p({ http_status: 200 })], null)).toMatchObject({ status: 'failed', code: 'still-200', params: { status: 200 } });
    expect(verifyTask({ ...t, targetUrl: undefined }, [p({ redirect_chain: [{ ...hop[0], http_status: 302 }] })], null)?.status).toBe('failed');
    expect(verifyTask({ ...t, targetUrl: undefined }, [p({ redirect_chain: hop })], null)?.code).toBe('redirect-wrong-target');
  });

  it('remove-410: gone, still 200, other status', () => {
    const t = task('remove-410');
    expect(verifyTask(t, [p({ http_status: 410 })], null)?.code).toBe('gone-ok');
    expect(verifyTask(t, [p({ http_status: 200 })], null)?.code).toBe('still-200');
    expect(verifyTask(t, [p({ http_status: 404 })], null)?.code).toBe('wrong-status');
  });

  it('add-entities: threshold at 60%', () => {
    const t = task('add-entities', { requiredEntities: ['a', 'b', 'c', 'd', 'e'] });
    expect(verifyTask(t, [p({ semantic_terms: ['A', 'b', 'C'] })], null)).toMatchObject({ status: 'verified', code: 'entities-ok', params: { found: 3, total: 5 } });
    expect(verifyTask(t, [p({ semantic_terms: ['a', 'b'] })], null)?.code).toBe('entities-missing');
    expect(verifyTask(task('add-entities'), [p()], null)?.code).toBe('entities-missing');
  });

  it('remove-noindex: meta, header, status, clean', () => {
    const t = task('remove-noindex');
    expect(verifyTask(t, [p({ meta_robots: 'noindex, follow' })], null)?.code).toBe('still-noindex');
    expect(verifyTask(t, [p({ x_robots_tag: 'NOINDEX' })], null)?.code).toBe('still-noindex');
    expect(verifyTask(t, [p({ indexability_status: 'Blocked: noindex' })], null)?.code).toBe('still-noindex');
    expect(verifyTask(t, [p({ indexability_status: 'Eligible' })], null)?.status).toBe('verified');
  });

  it('flags regression and returns null for uncrawled pages', () => {
    expect(verifyTask(task('remove-410'), [p({ http_status: 410 })], 41.26)).toMatchObject({ delta: -8.7, regression: true });
    expect(verifyTask(task('remove-410'), [], 10)).toBeNull();
    expect(verifyTask(task('remove-410', { baselineScore: null }), [p({ http_status: 410 })], 10)?.delta).toBeNull();
  });
});

describe('verifyTasks and storage', () => {
  beforeEach(() => localStorage.clear());

  it('verifies only implemented tasks with crawl evidence', () => {
    const tasks = [task('remove-410', { id: '1' }), task('remove-410', { id: '2', status: 'planned' }), task('remove-410', { id: '3', url: 'https://s.test/missing' })];
    const out = verifyTasks(tasks, [p({ http_status: 410 })], () => 55, '2026-01-01');
    expect(out[0]).toMatchObject({ status: 'verified', verifiedAt: '2026-01-01' });
    expect(out[1]).toBe(tasks[1]);
    expect(out[2]).toBe(tasks[2]);
  });

  it('plans without duplicates, marks implemented, persists and validates', () => {
    let tasks = planTask([], { kind: 'remove-410', module: 'sfs', url: A, baselineScore: 40 }, '2026-01-01');
    expect(tasks[0]).toMatchObject({ status: 'planned', priority: 'medium', createdAt: '2026-01-01' });
    expect(planTask(tasks, { kind: 'remove-410', module: 'sfs', url: A, baselineScore: 40 })).toBe(tasks);
    expect(planTask(tasks, { kind: 'remove-410', module: 'sfs', url: A, baselineScore: 40, targetUrl: 'https://s.test/x' })).toHaveLength(2);
    expect(planTask(tasks, { kind: 'add-link', module: 'sfs', url: A, baselineScore: 40 })).toHaveLength(2);
    expect(planTask([{ ...tasks[0], status: 'verified' }], { kind: 'remove-410', module: 'sfs', url: A, baselineScore: 40 })).toHaveLength(2);
    expect(planTask(tasks, { kind: 'remove-410', module: 'sfs', url: 'https://s.test/other', baselineScore: 40 })).toHaveLength(2);
    tasks = markImplemented(tasks, tasks[0].id, '2026-01-02');
    expect(tasks[0]).toMatchObject({ status: 'implemented', implementedAt: '2026-01-02' });
    expect(markImplemented(tasks, tasks[0].id)).toEqual(tasks);
    expect(writeTasks('p', tasks)).toBe(true);
    expect(readTasks('p')).toEqual(tasks);
    localStorage.setItem(tasksKey('bad'), JSON.stringify([{ id: 1 }, null, 'x']));
    expect(readTasks('bad')).toEqual([]);
    localStorage.setItem(tasksKey('obj'), '{}');
    expect(readTasks('obj')).toEqual([]);
  });

  it('caps stored tasks', () => {
    let tasks: OptimizationTask[] = [];
    for (let i = 0; i <= MAX_TASKS; i++) tasks = planTask(tasks, { kind: 'add-link', module: 'tas', url: `https://s.test/${i}`, baselineScore: null });
    expect(tasks).toHaveLength(MAX_TASKS);
  });
});
