import { expect, it } from 'vitest';
import { comparableCrawlScore, CRAWL_SCORE_VERSION } from '@/services/crawlHealthScore';
import { mergeCrawlResults } from '@/stores/tools/checkpoints/results';
import { applyExternalLinkEvidence } from '@/stores/tools/externalLinks/evidence';
import { createCrawlPageFixture as page, createCrawlResultFixture as result } from './fixtures/crawl';

it('uses stored scores only when the formula versions match', () => {
  for (const version of [CRAWL_SCORE_VERSION, 99]) {
    expect(comparableCrawlScore(result({ score_version: version }), result({ score_version: version, health_score: 83 }))).toBe(83);
  }
});

it('does not compare absent or invalid current formula versions', () => {
  const previous = result({ score_version: 2, health_score: 99 });
  for (const version of [undefined, 0, -1, 0.5, NaN, Infinity, 65536]) {
    expect(comparableCrawlScore(result({ score_version: version }), previous)).toBeUndefined();
  }
  expect(comparableCrawlScore(result({ score_version: 2 }))).toBeUndefined();
});

it('rejects corrupt scores and unknown future formula conversions', () => {
  for (const health_score of [-1, 101, NaN, Infinity]) {
    expect(comparableCrawlScore(result({ score_version: 2 }), result({ score_version: 2, health_score }))).toBeUndefined();
  }
  expect(comparableCrawlScore(result({ score_version: 3 }), result({ score_version: 2 }))).toBeUndefined();
});

it.each([
  { name: 'healthy', pages: [page()], expected: 100 },
  { name: 'warning', pages: [page({ issues_count: 1, issues: [{ severity: 'Warning', message: 'Missing heading' }] })], expected: 90 },
  { name: 'critical', pages: [page({ issues_count: 1, issues: [{ severity: 'Critical', message: 'HTTP error status 500' }] })], expected: 80 },
])('recomputes complete legacy $name snapshots without mutating saved evidence', ({ pages, expected }) => {
  for (const version of [undefined, 0, 1]) {
    const previous = result({ score_version: version, health_score: 20, pages, pages_crawled: pages.length });
    const before = JSON.stringify(previous);
    expect(comparableCrawlScore(result({ score_version: 2 }), previous)).toBe(expected);
    expect(JSON.stringify(previous)).toBe(before);
  }
});

it('does not reconstruct scores from compacted or incomplete legacy page arrays', () => {
  const current = result({ score_version: 2 });
  expect(comparableCrawlScore(current, result({ storage_pages_truncated: true }))).toBeUndefined();
  expect(comparableCrawlScore(current, result({ pages: [page()], pages_crawled: 2 }))).toBeUndefined();
  expect(comparableCrawlScore(current, result({ pages: [page({ issues_count: 2 })], pages_crawled: 1 }))).toBeUndefined();
});

it('versions every recalculation after resume and link evidence refresh', () => {
  const legacy = result({ pages: [page()], pages_crawled: 1 });
  expect(mergeCrawlResults(legacy, result())).toMatchObject({ score_version: 2, health_score: 100 });
  expect(applyExternalLinkEvidence(legacy, { results: [], requested: 0, checked: 0, omitted: 0 }, false))
    .toMatchObject({ score_version: 2, health_score: 100 });
});
