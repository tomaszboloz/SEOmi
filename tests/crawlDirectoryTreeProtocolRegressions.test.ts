import { expect, it } from 'vitest';
import { buildCrawlDirectoryTree } from '@/services/crawlDirectoryTree';
import { createCrawlPageFixture } from './fixtures/crawl';
it('excludes non-HTTP declarations from fetched-page directory metrics', () => {
  const input = ['https://site.test/page', 'file:///tmp/page', 'mailto:owner@site.test', 'ftp://site.test/page']
    .map(url => createCrawlPageFixture({ url }));
  const tree = buildCrawlDirectoryTree(input);
  expect(tree.pageCount).toBe(1); expect(tree.ignoredPageCount).toBe(3);
  expect(tree.roots.map(root => root.name)).toEqual(['https://site.test']);
});
