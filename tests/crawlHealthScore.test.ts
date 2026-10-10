import { expect, it } from 'vitest';
import { crawlHealthScore } from '@/services/crawlHealthScore';
import { applyExternalLinkEvidence } from '@/stores/tools/externalLinks/evidence';
import { mergeCrawlResults } from '@/stores/tools/checkpoints/results';
import { createCrawlPageFixture as page, createCrawlResultFixture as result } from './fixtures/crawl';

it('keeps identical affected shares comparable at every crawl size', () => {
  for (const size of [10, 100, 1000]) {
    const pages = Array.from({ length: size }, (_, index) => page({
      url: `https://example.test/${index}`,
      issues: index < size / 10 ? [{ severity: 'Warning', message: 'Duplicate title' }] : [],
    }));
    expect(crawlHealthScore(pages)).toBe(99);
    expect(crawlHealthScore(pages.map((entry) => ({ ...entry, issues: [{ severity: 'Warning', message: 'Duplicate title' }] })))).toBe(90);
  }
});

it('deduplicates per page, groups dynamic messages and caps distinct finding contributions', () => {
  const warning = { severity: 'Warning' as const, message: 'HTTP ERROR 404: /one' };
  expect(crawlHealthScore([page({ issues: [warning, { ...warning, message: 'http error 500: /two' }, warning] })])).toBe(90);
  expect(crawlHealthScore([page({ issues: ['a', 'b', 'c', 'd'].map((message) => ({ severity: 'Warning', message })) })])).toBe(70);
  expect(crawlHealthScore([page({ issues: [{ severity: 'Warning', message: ' : /empty' }] })])).toBe(90);
});

it('weights the three largest shares and remains stable when page order changes', () => {
  const pages = Array.from({ length: 10 }, (_, index) => page({ issues: [
    ...(index < 5 ? [{ severity: 'Warning' as const, message: 'a' }] : []),
    ...(index < 3 ? [{ severity: 'Warning' as const, message: 'b' }] : []),
    ...(index < 2 ? [{ severity: 'Warning' as const, message: 'c' }] : []),
    ...(index < 1 ? [{ severity: 'Warning' as const, message: 'd' }] : []),
    { severity: 'Info', message: 'notice' },
  ] }));
  expect(crawlHealthScore(pages)).toBe(90);
  expect(crawlHealthScore([...pages].reverse())).toBe(90);
});

it('caps severe multi-type findings at twenty and leaves healthy observations at one hundred', () => {
  const issues = (['Critical', 'Warning'] as const).flatMap((severity) => ['a', 'b', 'c'].map((message) => ({ severity, message })));
  expect(crawlHealthScore([page({ issues })])).toBe(20);
  expect(crawlHealthScore([page({ issues: [{ severity: 'Info', message: 'notice' }] })])).toBe(100);
});

it('limits missing and partial HTML evidence without confusing non-HTML truncation with HTML', () => {
  expect(crawlHealthScore([])).toBe(50);
  for (const patch of [{ content_type: 'application/zip' }, { content_type: '' }, { request_error_kind: 'timeout' }, { request_error_kind: '' }]) {
    expect(crawlHealthScore([page(patch)])).toBe(50);
  }
  expect(crawlHealthScore([page({ content_type: 'Text/HTML; charset=utf-8', body_truncated: true })])).toBe(90);
  expect(crawlHealthScore([page({ content_type: 'application/xhtml+xml', semantic_content_partial: true })])).toBe(90);
  expect(crawlHealthScore([page({ content_type: 'image/png', body_truncated: true }), page()])).toBe(100);
});

it('retains the same score after resume and external-link refresh instead of reverting to issue-count penalties', () => {
  const pages = Array.from({ length: 100 }, (_, index) => page({ url: `https://example.test/${index}`, final_url: `https://example.test/${index}`,
    issues: [{ severity: 'Warning', message: 'Duplicate id' }], issues_count: 1 }));
  const source = result({ pages, pages_crawled: 100, health_score: 90 });
  const before = JSON.stringify(source);
  expect(mergeCrawlResults(source, result()).health_score).toBe(90);
  expect(applyExternalLinkEvidence(source, { results: [], requested: 0, checked: 0, omitted: 0 }, false))
    .toMatchObject({ health_score: 90, warning_count: 100 });
  expect(JSON.stringify(source)).toBe(before);
});
