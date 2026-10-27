import { expect, it } from 'vitest';
import { SiteCrawlResultSchema } from '@/services/contracts/crawl/crawlResult';
import { compactCrawlRunsToPageIndex } from '@/services/crawlPersistence/pageIndex';
import { compactCrawlRunsForStorage } from '@/services/crawlPersistence/compaction';
import { crawlReportPayload } from '@/services/export/crawlReport';
import { DEFAULT_CRAWL_REPORT_TEMPLATE } from '@/services/reportTemplates';
import { createCrawlResultFixture as result, createCrawlRunFixture as run } from './fixtures/crawl';

it('validates native formula versions while accepting unversioned legacy results', () => {
  for (const score_version of [undefined, null, 0, 2, 65535]) {
    const parsed = SiteCrawlResultSchema.parse({ ...result(), score_version });
    expect(parsed.score_version).toBe(score_version ?? undefined);
  }
  for (const score_version of [-1, 0.5, 65536, NaN, Infinity, '2']) {
    expect(SiteCrawlResultSchema.safeParse({ ...result(), score_version }).success).toBe(false);
  }
});

it('retains the score formula version through each durable compaction level', () => {
  const source = run({ result: result({ score_version: 2, health_score: 91 }) });
  for (const level of [1, 2, 3] as const) {
    expect(compactCrawlRunsForStorage([source], level)[0].result).toMatchObject({ score_version: 2, health_score: 91 });
  }
  expect(compactCrawlRunsToPageIndex([source])[0].result).toMatchObject({ score_version: 2, health_score: 91 });
  expect(source.result).toMatchObject({ score_version: 2, health_score: 91 });
});

it('keeps formula metadata in full and section-filtered report exports', () => {
  const source = run({ result: result({ score_version: 2 }) });
  expect(crawlReportPayload(source).result).toMatchObject({ score_version: 2 });
  expect(crawlReportPayload(source, { ...DEFAULT_CRAWL_REPORT_TEMPLATE, sections: ['summary'] }).result)
    .toMatchObject({ score_version: 2 });
});

it('retains structured robots outcome evidence through compaction and export', () => {
  const source = run({ result: result({
    robots_txt_evaluation_status: 'unknown',
    robots_txt_warning: 'Rules unavailable',
    robots_txt_status_code: 503,
    robots_txt_final_url: 'https://example.test/robots.txt',
    robots_txt_redirect_chain: [{ from_url: 'https://example.test/robots.txt', http_status: 302, to_url: 'https://www.example.test/robots.txt' }],
  }) });
  expect(compactCrawlRunsToPageIndex([source])[0].result).toMatchObject({
    robots_txt_evaluation_status: 'unknown', robots_txt_status_code: 503,
  });
  expect(crawlReportPayload(source).result).toMatchObject({
    robots_txt_warning: 'Rules unavailable', robots_txt_redirect_chain: expect.any(Array),
  });
});
