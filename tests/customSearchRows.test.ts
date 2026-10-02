import { expect, it } from 'vitest';
import { customSearchRows } from '@/components/Domain/crawlResults/customSearchRows';
import type { CrawledPageSummary, CustomSearchDefinition } from '@/types';

const search = { id: 's1', name: 'Price', selectorType: 'css', query: '.price', resultType: 'text' } as CustomSearchDefinition;
const page = (url: string, results?: unknown[]) => ({ url, custom_search_results: results }) as unknown as CrawledPageSummary;

it('reports old runs, selector errors, empty matches and numbered bounded values per page and search', () => {
  const rows = customSearchRows([
    page('https://a.test/old'),
    page('https://a.test/error', [{ id: 's1', values: [], error: 'bad selector', truncated: false }]),
    page('https://a.test/empty', [{ id: 's1', values: [], truncated: false }]),
    page('https://a.test/hit', [{ id: 's1', values: ['10', '20'], truncated: true }]),
  ], [search], (key) => key);
  expect(rows.map(({ key, value, match, status }) => [key, value, match, status])).toEqual([
    ['https://a.test/old-s1-missing', 'crawl.customSearch.noResult', '', 'crawl.customSearch.oldRun'],
    ['https://a.test/error-s1-error', 'bad selector', '', 'crawl.customSearch.selectorError'],
    ['https://a.test/empty-s1-empty', '—', '', 'crawl.customSearch.noMatch'],
    ['https://a.test/hit-s1-0', '10', '1', 'crawl.customSearch.bounded'],
    ['https://a.test/hit-s1-1', '20', '2', 'crawl.customSearch.bounded'],
  ]);
  expect(rows.every(row => row.search === search)).toBe(true);
  expect(customSearchRows([page('https://a.test/x')], [], (key) => key)).toEqual([]);
});
