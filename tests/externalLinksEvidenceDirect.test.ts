import { expect, it } from 'vitest';
import { applyExternalLinkEvidence, collectExternalLinkTargets } from '@/stores/tools/externalLinks/evidence';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import { externalRun, checkedBatch } from './fixtures/externalLinksSlice';

it('collects normalized unique external targets and distinguishes forced checks', () => {
  const run = externalRun();
  run.result.pages[0].links.push(
    { target_url: 'https://outside.example/path#duplicate', is_internal: false, anchor_text: 'Duplicate' },
    { target_url: 'https://internal.example/', is_internal: true, anchor_text: 'Internal' },
    { target_url: 'https://checked.example/', is_internal: false, anchor_text: 'Checked', target_checked_at: 'previous' },
  );
  expect(collectExternalLinkTargets(run, false)).toEqual(['https://outside.example/path']);
  expect(collectExternalLinkTargets(run, true)).toEqual(['https://outside.example/path', 'https://checked.example/']);
});

it('updates only eligible links, preserves other findings and does not mutate source evidence', () => {
  const source = externalRun().result;
  const link = source.pages[0].links[0];
  source.pages[0].links.push({ ...link, is_internal: true }, { ...link, target_checked_at: 'previous', target_http_status: 200 },
    { ...link, target_url: 'https://unreturned.example/' });
  source.pages[0].issues = [{ severity: 'Critical', message: 'Existing critical' },
    { severity: 'Info', message: 'Existing info' },
    { severity: 'Warning', message: 'Old external', code: 'external-link-check' }];
  const original = JSON.stringify(source);
  const result = applyExternalLinkEvidence(source, checkedBatch, false);
  expect(result.pages[0].links[0]).toMatchObject({ target_http_status: 404, target_checked_at: '2026-10-02T10:00:00Z' });
  expect(result.pages[0].links[1]).toBe(source.pages[0].links[1]);
  expect(result.pages[0].links[2].target_http_status).toBe(200);
  expect(result.pages[0].links[3].target_checked_at).toBeUndefined();
  expect(result).toMatchObject({ critical_count: 1, warning_count: 1, notice_count: 1, health_score: 70 });
  expect(result.pages[0].issues).toHaveLength(3);
  expect(JSON.stringify(source)).toBe(original);
});

it('allows a forced healthy response to clear previous broken-link evidence', () => {
  const source = externalRun().result;
  source.pages[0].links[0].target_http_status = 404;
  source.pages[0].links[0].target_checked_at = 'previous';
  source.pages[0].issues = [{ severity: 'Warning', code: 'external-link-check', message: 'Old' }];
  const result = applyExternalLinkEvidence(source, { ...checkedBatch,
    results: [{ url: 'https://outside.example/path', httpStatus: 200, checkedAt: '' }] }, true);
  expect(result).toMatchObject({ warning_count: 0, health_score: 100 });
  expect(result.pages[0].links[0].target_checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(result.pages[0].issues).toEqual([]);
});

it.each(['dns', 'broken'])('records %s failure as a source-page warning', kind => {
  const result = applyExternalLinkEvidence(externalRun().result, { ...checkedBatch,
    results: [{ url: 'https://outside.example/path', requestErrorKind: kind, checkedAt: 'now' }] }, false);
  expect(result.warning_count).toBe(1);
  expect(result.pages[0].links[0].target_request_error_kind).toBe(kind);
});

it.each(['timeout', 'tls', 'connect', 'network', 'blocked'])('keeps %s failures unverifiable without a broken-link warning', kind => {
  const result = applyExternalLinkEvidence(externalRun().result, { ...checkedBatch,
    results: [{ url: 'https://outside.example/path', requestErrorKind: kind, checkedAt: 'now' }] }, false);
  expect(result.warning_count).toBe(0);
});

it.each([404, 410])('records HTTP %i as a broken-link warning', httpStatus => {
  const result = applyExternalLinkEvidence(externalRun().result, { ...checkedBatch,
    results: [{ url: 'https://outside.example/path', httpStatus, checkedAt: 'now' }] }, false);
  expect(result.warning_count).toBe(1);
});

it('keeps safety-blocked diagnostics distinct from broken network targets', () => {
  const result = applyExternalLinkEvidence(externalRun().result, { ...checkedBatch,
    results: [{ url: 'https://outside.example/path', requestErrorKind: 'blocked', checkedAt: 'now' }] }, false);
  expect(result.warning_count).toBe(0);
  expect(result.pages[0].links[0].target_request_error_kind).toBe('blocked');
});

it('counts repeated occurrences of one critical finding as one affected-page share', () => {
  const source = createCrawlResultFixture({ pages: [createCrawlPageFixture({
    issues: Array.from({ length: 10 }, () => ({ severity: 'Critical', message: 'Existing' })),
  })] });
  expect(applyExternalLinkEvidence(source, { ...checkedBatch, results: [] }, false))
    .toMatchObject({ critical_count: 10, health_score: 80 });
});
