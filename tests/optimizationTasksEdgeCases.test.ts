import { beforeEach, describe, expect, it } from 'vitest';
import type { CrawlRunRecord } from '@/types';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { editTask } from '@/services/optimizationTasks/edit';
import { appendDeltas } from '@/services/optimizationTasks/metricHistory';
import { deriveCrawlStartedAt, runTaskVerification, toIso } from '@/services/optimizationTasks/runVerification';
import { writeTasks } from '@/services/optimizationTasks/storage';
import { verifyTask } from '@/services/optimizationTasks/verify';
import { createCrawlPageFixture as page } from './fixtures/crawl';

const P = 'proj-edge';
const U = 'https://site.test/p1';
const U2 = 'https://site.test/p2';

const makeTask = (patch: Partial<OptimizationTask> = {}): OptimizationTask => ({
  id: 't-test', kind: 'remove-noindex', module: 'sfs', status: 'implemented', url: U,
  baselineScore: 50, priority: 'high', createdAt: '2026-10-24T09:00:00Z',
  implementedAt: '2026-10-24T10:00:00Z', ...patch,
});

describe('remove-noindex evidence certainty, contradictions and gates', () => {
  it('returns null on http 0/4xx/5xx, transport errors and non-indexable strings', () => {
    const t = makeTask();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 0 })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 404 })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 500 })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, request_error_kind: 'connection_refused' })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, indexability_status: 'Not indexable' })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, indexability_status: 'Non-indexable: canonical' })], null)).toBeNull();
  });

  it('negative structured verdict and canonical contradictions override robots index', () => {
    const t = makeTask();
    const badVerdict = { status: 'uncertain', reasons: ['canonical_robots_conflict'] };
    const pRobots = page({ url: U, final_url: U, http_status: 200, robots_decision: { indexability: 'index', link_following: 'follow', response_headers_available: true }, indexability_verdict: badVerdict });
    expect(verifyTask(t, [pRobots], null)).toBeNull();

    const pBlocked = page({ url: U, final_url: U, http_status: 200, indexability_verdict: { status: 'blocked', reasons: [] } });
    expect(verifyTask(t, [pBlocked], null)).toBeNull();

    const pConflict = page({ url: U, final_url: U, http_status: 200, canonical_robots_conflict: true, indexability_status: 'Eligible' });
    expect(verifyTask(t, [pConflict], null)).toBeNull();

    const pTarget = page({ url: U, final_url: U, http_status: 200, canonical: 'https://site.test/other', indexability_status: 'Eligible' });
    expect(verifyTask(t, [pTarget], null)).toBeNull();
  });

  it('fails with still-noindex on negative directive evidence', () => {
    const t = makeTask();
    expect(verifyTask(t, [page({ url: U, final_url: U, meta_robots: 'noindex' })], null)).toMatchObject({ status: 'failed', code: 'still-noindex' });
    expect(verifyTask(t, [page({ url: U, final_url: U, x_robots_tag: 'noindex' })], null)).toMatchObject({ status: 'failed', code: 'still-noindex' });
    expect(verifyTask(t, [page({ url: U, final_url: U, indexability_status: 'Blocked: noindex' })], null)).toMatchObject({ status: 'failed', code: 'still-noindex' });
    expect(verifyTask(t, [page({ url: U, final_url: U, meta_robots: null, x_robots_tag: null, robots_decision: null, indexability_status: 'noindex' })], null)).toMatchObject({ status: 'failed', code: 'still-noindex' });
  });

  it('verifies index-ok on clean affirmative evidence from various sources', () => {
    const t = makeTask();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, indexability_status: 'Eligible from this response only' })], null)).toMatchObject({ status: 'verified', code: 'index-ok' });
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, indexability_status: undefined, indexability_verdict: { status: 'indexable', reasons: [] } })], null)).toMatchObject({ status: 'verified', code: 'index-ok' });
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, robots_decision: { indexability: 'index', link_following: 'follow', response_headers_available: true } })], null)).toMatchObject({ status: 'verified', code: 'index-ok' });
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, indexability_status: 'Eligible', robots_decision: null, indexability_verdict: null })], null)).toMatchObject({ status: 'verified', code: 'index-ok' });
  });
});

describe('deriveCrawlStartedAt and toIso edge cases', () => {
  it('derives from startedAt, completedAt-duration, and handles RangeError', () => {
    expect(deriveCrawlStartedAt({ startedAt: '2026-10-24T10:00:00Z' } as CrawlRunRecord)).toBe('2026-10-24T10:00:00.000Z');
    expect(deriveCrawlStartedAt({ completedAt: '2026-10-24T10:05:00.000Z', result: { duration_ms: 300000 } } as CrawlRunRecord)).toBe('2026-10-24T10:00:00.000Z');
    expect(deriveCrawlStartedAt({ startedAt: 'invalid-time' } as CrawlRunRecord)).toBeUndefined();
    expect(deriveCrawlStartedAt({ completedAt: 'invalid-time', result: { duration_ms: 1000 } } as CrawlRunRecord)).toBeUndefined();
    expect(deriveCrawlStartedAt({ completedAt: '2026-10-24T10:00:00Z' } as CrawlRunRecord)).toBeUndefined();
    expect(deriveCrawlStartedAt({ completedAt: '2026-10-24T10:00:00Z', result: { duration_ms: -5 } } as CrawlRunRecord)).toBeUndefined();
    expect(deriveCrawlStartedAt({} as CrawlRunRecord)).toBeUndefined();
    expect(toIso(8.64e15 + 1)).toBeUndefined();
    expect(toIso(NaN)).toBeUndefined();
  });
});

describe('runTaskVerification-level freshness and caching', () => {
  beforeEach(() => localStorage.clear());

  it('defers verification when crawl started before implementation or start is unknown', () => {
    writeTasks(P, [makeTask({ id: 't-defer', implementedAt: '2026-10-24T10:05:00Z' })]);
    const inFlightRun = { startedAt: '2026-10-24T10:00:00Z', result: { start_url: U, pages: [page({ url: U, final_url: U, http_status: 200, indexability_status: 'Eligible' })] } } as CrawlRunRecord;
    expect(runTaskVerification(P, inFlightRun)[0].status).toBe('implemented');

    const unknownStartRun = { result: { start_url: U, pages: [page({ url: U, final_url: U, http_status: 200, indexability_status: 'Eligible' })] } } as CrawlRunRecord;
    expect(runTaskVerification(P, unknownStartRun)[0].status).toBe('implemented');

    const nextCrawlRun = { startedAt: '2026-10-24T10:15:00Z', completedAt: '2026-10-24T10:16:00Z', result: { start_url: U, pages: [page({ url: U, final_url: U, http_status: 200, indexability_status: 'Eligible' })] } } as CrawlRunRecord;
    expect(runTaskVerification(P, nextCrawlRun)[0].status).toBe('verified');
  });

  it('covers tas caching and empty run fallback in runTaskVerification', () => {
    writeTasks(P, [makeTask({ id: 'tas1', module: 'tas', kind: 'remove-noindex', baselineScore: 30 }), makeTask({ id: 'tas2', module: 'tas', kind: 'remove-noindex', baselineScore: 30 })]);
    const run = { startedAt: '2026-10-24T10:15:00Z', completedAt: '2026-10-24T10:16:00Z', result: { start_url: U, pages: [page({ url: U, final_url: U, http_status: 200, indexability_status: 'Eligible' })] } } as CrawlRunRecord;
    const verified = runTaskVerification(P, run);
    expect(verified[0].status).toBe('verified');
    expect(verified[1].status).toBe('verified');

    writeTasks('empty-run', [makeTask({ id: 'te', implementedAt: undefined })]);
    expect(runTaskVerification('empty-run', {} as CrawlRunRecord)).toHaveLength(1);
  });
});

describe('SPRS, EETV, editTask and appendDeltas branch coverage', () => {
  beforeEach(() => localStorage.clear());

  it('computes real SPRS score delta for page and honest null when missing', () => {
    const p1 = page({ url: U, final_url: U, http_status: 200, semantic_terms: ['seo', 'audit'], links: [{ target_url: U2, anchor_text: 'p2', is_internal: true }] });
    const p2 = page({ url: U2, final_url: U2, http_status: 200, semantic_terms: ['audit', 'tools'], links: [{ target_url: U, anchor_text: 'p1', is_internal: true }] });
    const run = { startedAt: '2026-10-24T11:00:00Z', completedAt: '2026-10-24T11:01:00Z', result: { start_url: U, duration_ms: 1000, pages: [p1, p2] } } as CrawlRunRecord;

    writeTasks(P, [makeTask({ id: 'tsprs', module: 'sprs', kind: 'add-link', targetUrl: U2, baselineScore: 10 }), makeTask({ id: 'tsprs2', module: 'sprs', kind: 'add-link', targetUrl: U2, baselineScore: 10 }), makeTask({ id: 'tsprs-missing', module: 'sprs', url: 'https://site.test/absent', baselineScore: 10 })]);
    const verified = runTaskVerification(P, run);
    expect(verified[0].status).toBe('verified');
    expect(verified[1].status).toBe('verified');
    expect(typeof verified[0].verdict?.delta).toBe('number');
    expect(verified[2].status).toBe('implemented');

    writeTasks('empty-sprs', [makeTask({ id: 'tsprs-empty', module: 'sprs', baselineScore: 10 })]);
    const emptyRun = { startedAt: '2026-10-24T11:00:00Z', completedAt: '2026-10-24T11:01:00Z', result: { start_url: U, pages: [] } } as unknown as CrawlRunRecord;
    expect(runTaskVerification('empty-sprs', emptyRun)[0].status).toBe('implemented');
    expect(runTaskVerification('empty-sprs', emptyRun)[0].verdict).toBeUndefined();
  });

  it('computes EETV trust score delta when live pages exist and null when absent', () => {
    const p1 = page({ url: U, final_url: U, http_status: 200 });
    const run = { startedAt: '2026-10-24T11:00:00Z', completedAt: '2026-10-24T11:01:00Z', result: { start_url: U, duration_ms: 1000, pages: [p1] } } as CrawlRunRecord;
    writeTasks(P, [makeTask({ id: 'teetv', module: 'eetv', kind: 'remove-noindex', baselineScore: 20 })]);
    const verified = runTaskVerification(P, run);
    expect(verified[0].status).toBe('verified');
    expect(typeof verified[0].verdict?.delta).toBe('number');

    const errorRun = { startedAt: '2026-10-24T12:00:00Z', completedAt: '2026-10-24T12:01:00Z', result: { start_url: U, duration_ms: 1000, pages: [page({ url: U, final_url: U, http_status: 500 })] } } as CrawlRunRecord;
    writeTasks(P, [makeTask({ id: 'teetv2', module: 'eetv', kind: 'remove-410', baselineScore: 20 })]);
    const errorVerified = runTaskVerification(P, errorRun);
    expect(errorVerified[0].verdict?.delta).toBeNull();
  });

  it('covers editTask invalid priority and appendDeltas empty verifiedAt branches', () => {
    const t = makeTask({ id: 't-edit', priority: 'medium' });
    const edited = editTask([t], 't-edit', { priority: 'bogus' as never });
    expect(edited[0].priority).toBe('medium');

    const verifiedWithoutDate = makeTask({ id: 't-nodate', status: 'verified', verifiedAt: undefined, verdict: { status: 'verified', code: 'index-ok', params: {}, delta: 5, regression: false } });
    const rows = appendDeltas('p-nodate', [makeTask({ id: 't-nodate', status: 'implemented' })], [verifiedWithoutDate]);
    expect(rows[0].at).toBe('');
  });
});
