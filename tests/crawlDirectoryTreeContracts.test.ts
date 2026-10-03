import { expect, it } from 'vitest';
import { emptyMetrics, addPageMetrics, finalize } from '@/services/crawlDirectoryTree/metrics';
import { decodeSegment, makeNode } from '@/services/crawlDirectoryTree/nodes';
import { buildCrawlDirectoryTree, filterCrawlPagesForDirectoryTree } from '@/services/crawlDirectoryTree';
import { createCrawlPageFixture } from './fixtures/crawl';
it('builds independent nodes, decodes readable names and retains malformed escapes literally', () => {
  expect(decodeSegment('caf%C3%A9')).toBe('café'); expect(decodeSegment('%ZZ')).toBe('%ZZ');
  const one = makeNode('one', 'One', 0), two = makeNode('two', 'Two', 1);
  expect(one).toMatchObject({ id: 'one', name: 'One', depth: 0, ownPages: [], childDirectories: [] });
  one.metrics.pageCount = 1; expect(two.metrics.pageCount).toBe(0); expect(emptyMetrics().averageResponseMs).toBeNull();
});
it('classifies HTTP ranges, errors, issue severities and indexability using observed values', () => {
  const metrics = emptyMetrics();
  const statuses = [0, 100, 200, 300, 400, 500, 600];
  statuses.forEach((http_status, index) => addPageMetrics(metrics, createCrawlPageFixture({ http_status, word_count: index === 0 ? NaN : index === 1 ? -1 : 1,
    indexability_status: index === 2 ? 'Eligible from response' : index === 3 ? 'Excluded by directive' : '', issues: [{ severity: 'Critical', message: 'Critical' }, { severity: 'Warning', message: 'Warning' }, { severity: 'Info', message: 'Info' }],
  })));
  addPageMetrics(metrics, createCrawlPageFixture({ http_status: 200, request_error_kind: 'timeout', issues: undefined, word_count: 0, indexability_status: undefined } as never));
  expect(metrics).toMatchObject({ pageCount: 8, status2xx: 1, status3xx: 1, status4xx: 1, status5xx: 1, requestErrors: 2, criticalIssues: 7, warningIssues: 7, indexable: 1, excluded: 1, unknownIndexability: 6, words: 5 });
});
it('aggregates and sorts child metrics while excluding unavailable timing from the average', () => {
  const root = makeNode('root', 'Root', 0), z = makeNode('z', 'Z', 1), a = makeNode('a', 'A', 1);
  root.childDirectories = [z, a]; root.ownPages = [createCrawlPageFixture({ url: 'https://site.test/z', response_time_ms: NaN }), createCrawlPageFixture({ url: 'https://site.test/a', response_time_ms: -1 })];
  z.ownPages = [createCrawlPageFixture({ response_time_ms: 0 })]; a.ownPages = [createCrawlPageFixture({ response_time_ms: 100 })];
  const summary = finalize(root);
  expect(summary.responseTimeCount).toBe(2); expect(summary.responseTimeTotal).toBe(100); expect(summary.metrics.averageResponseMs).toBe(50);
  expect(root.childDirectories.map(node => node.name)).toEqual(['A', 'Z']); expect(root.ownPages.map(page => page.url)).toEqual(['https://site.test/a', 'https://site.test/z']);
  expect(finalize(makeNode('empty', 'Empty', 0)).metrics.averageResponseMs).toBeNull();
});
it('keeps duplicate paths distinct as page snapshots and filters absent metadata safely', () => {
  const pages = [createCrawlPageFixture({ url: 'https://site.test/%ZZ', title: undefined, indexability_status: undefined } as never), createCrawlPageFixture({ url: 'http://other.test/a' }), createCrawlPageFixture({ url: 'https://site.test/%ZZ?second' })];
  const tree = buildCrawlDirectoryTree(pages); expect(tree.pageCount).toBe(3); expect(tree.roots.map(root => root.name)).toEqual(['http://other.test', 'https://site.test']);
  expect(tree.roots[1].childDirectories[0].name).toBe('%ZZ'); expect(tree.roots[1].childDirectories[0].ownPages).toHaveLength(2);
  expect(filterCrawlPagesForDirectoryTree(pages, ' %zz ')).toHaveLength(2); expect(filterCrawlPagesForDirectoryTree(pages, 'absent')).toEqual([]);
  expect(buildCrawlDirectoryTree([]).metrics.averageResponseMs).toBeNull();
});
