import { describe, expect, it } from 'vitest';
import { crawlLinkStatus, crawlLinksCsv, filterAndSortCrawlLinks } from '@/services/crawlLinkFilters';

const records = [
  { sourceUrl: 'https://example.com/a', key: 'a', link: { target_url: 'https://outside.example/b', anchor_text: 'Broken', source_excerpt: '<a href="/broken">Broken</a>', is_internal: false, target_http_status: 404 } },
  { sourceUrl: 'https://example.com/b', key: 'b', link: { target_url: 'https://example.com/c', anchor_text: 'Internal', is_internal: true, target_http_status: 200 } },
  { sourceUrl: 'https://example.com/c', key: 'c', link: { target_url: 'https://outside.example/new', anchor_text: '=formula', is_internal: false, target_http_status: 301, target_redirect_url: 'https://outside.example/final' } },
  { sourceUrl: 'https://example.com/d', key: 'd', link: { target_url: 'https://outside.example/unverified', anchor_text: 'Unknown', is_internal: false } },
] as const;

describe('crawl link filters', () => {
  it('classifies factual status without treating unchecked as success', () => {
    expect(crawlLinkStatus(records[0].link)).toBe('broken');
    expect(crawlLinkStatus(records[1].link)).toBe('ok');
    expect(crawlLinkStatus(records[2].link)).toBe('redirect');
    expect(crawlLinkStatus(records[3].link)).toBe('unchecked');
  });

  it('filters by kind/status/query and sorts deterministically', () => {
    const filtered = filterAndSortCrawlLinks([...records], { query: 'outside', kind: 'external', status: 'all', sort: 'target', descending: false });
    expect(filtered.map((item) => item.key)).toEqual(['a', 'c', 'd']);
    expect(filterAndSortCrawlLinks([...records], { query: '', kind: 'all', status: 'broken', sort: 'source', descending: false }).map((item) => item.key)).toEqual(['a']);
    expect(filterAndSortCrawlLinks([...records], { query: '', kind: 'all', status: 'error', sort: 'source', descending: false }).map((item) => item.key)).toEqual(['a']);
    expect(filterAndSortCrawlLinks([...records], { query: 'href="/broken"', kind: 'all', status: 'all', sort: 'source', descending: false }).map((item) => item.key)).toEqual(['a']);
  });

  it('exports filtered records as escaped CSV', () => {
    const csv = crawlLinksCsv([records[2]]);
    expect(csv).toContain("'=formula");
    expect(csv).toContain('301');
    expect(csv).toContain('Source HTML excerpt');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
