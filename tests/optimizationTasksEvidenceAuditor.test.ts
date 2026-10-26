import { describe, expect, it } from 'vitest';
import { verifyTask, verifyTasks } from '@/services/optimizationTasks/verify';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { createCrawlPageFixture as page } from './fixtures/crawl';

const U = 'https://site.test/a';
const U2 = 'https://site.test/b';
const task = (patch: Partial<OptimizationTask> = {}): OptimizationTask => ({
  id: 't-aud', kind: 'add-link', module: 'sprs', status: 'implemented', url: U,
  targetUrl: U2, baselineScore: null, priority: 'high', createdAt: '2026-10-24T08:00:00Z',
  implementedAt: '2026-10-24T09:00:00Z', ...patch,
});

describe('optimizationTasks evidence auditor edge cases', () => {
  it('addLink returns null on error status, transport failure and truncated body', () => {
    const t = task({ kind: 'add-link' });
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 500, links: [{ target_url: U2, anchor_text: 'b', is_internal: true }] })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 0, request_error_kind: 'timeout' })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, body_truncated: true, links: [] })], null)).toBeNull();
  });

  it('redirect returns null on transport error or non-200 broken status without redirect chain', () => {
    const t = task({ kind: 'redirect-301' });
    expect(verifyTask(t, [page({ url: U, final_url: U, request_error_kind: 'conn_refused' })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 500, redirect_chain: [] })], null)).toBeNull();
  });

  it('remove410 returns null on transport error or HTTP 0, and verifies on actual 410', () => {
    const t = task({ kind: 'remove-410' });
    expect(verifyTask(t, [page({ url: U, final_url: U, request_error_kind: 'timeout' })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 0 })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 410 })], null)).toMatchObject({ status: 'verified', code: 'gone-ok' });
  });

  it('entities returns null on unavailable semantic source, missing terms, error status or truncated body', () => {
    const t = task({ kind: 'add-entities', requiredEntities: ['diabetes'] });
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 500, semantic_terms: ['diabetes'] })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, semantic_content_source: 'unavailable', semantic_terms: [] })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, semantic_terms: undefined })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 200, body_truncated: true, semantic_terms: [] })], null)).toBeNull();
  });

  it('noindex returns null on error status and transport failure', () => {
    const t = task({ kind: 'remove-noindex' });
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 500, meta_robots: 'noindex' })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, http_status: 0 })], null)).toBeNull();
    expect(verifyTask(t, [page({ url: U, final_url: U, request_error_kind: 'timeout' })], null)).toBeNull();
  });

  it('verifyTasks defers legacy task without implementedAt when freshness timestamp is provided', () => {
    const legacy = task({ id: 't-legacy', implementedAt: undefined });
    const pSuccess = page({ url: U, final_url: U, http_status: 200, links: [{ target_url: U2, anchor_text: 'b', is_internal: true }] });
    const verified = verifyTasks([legacy], [pSuccess], () => null, '2026-10-24T12:00:00Z', '2026-10-24T10:00:00Z');
    expect(verified[0].status).toBe('implemented');
    expect(verified[0].verdict).toBeUndefined();
  });
});
