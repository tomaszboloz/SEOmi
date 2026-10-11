import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { isPaginationPage, paginationBase } from '@/services/topicalDiagnosis/pagination';

const link = (target_url: string) => ({ target_url, anchor_text: 'x', is_internal: true });
const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url, final_url: url, semantic_language: 'pl', word_count: 800, hreflangs: [], ...patch,
});
const posts = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => `https://ex.test/blog/${slug}/`);
const terms = [
  ['navigator', 'alerty', 'crm'], ['navigator', 'alerty', 'teams'], ['psychiatria', 'dzieci', 'szpital'],
  ['psychiatria', 'dzieci', 'oddział'], ['wordpress', 'kraków', 'bilety'], ['kurs', 'online', 'wstyd'],
];

/** A blog whose posts carry the post navigation of WordPress: `rel=prev|next` to the neighbouring post. */
const blogWithPostNavigation = () => [
  page('https://ex.test/blog/', { semantic_links: posts.map(link), word_count: 150, title: 'Blog' }),
  ...posts.map((url, index) => page(url, {
    semantic_terms: terms[index], title: `Wpis ${index}`, semantic_links: [link('https://ex.test/blog/')],
    pagination_prev: posts[index - 1] ?? null, pagination_next: posts[index + 1] ?? null,
  })),
];

describe('rel=prev|next between neighbouring posts', () => {
  const report = buildTopicalDiagnosis(blogWithPostNavigation(), 'https://ex.test/blog/');

  it('keeps every post a document of its own', () => {
    expect(report.stats.documents).toBe(7);
    expect(report.documents.every((document) => document.pages.length === 1)).toBe(true);
  });

  it('keeps the listing the only hub and the posts its content', () => {
    expect(report.documents.filter((document) => document.role === 'hub').map((document) => document.primaryPage.url)).toEqual(['https://ex.test/blog/']);
    expect(report.areas.find((area) => area.hubId)?.documentIds).toHaveLength(6);
    expect(report.stats.topics).toBe(2);
  });
});

describe('listing pagination declared with rel=prev|next', () => {
  it('folds pages numbered in the query string into their listing', () => {
    const first = page('https://ex.test/blog/', { pagination_next: 'https://ex.test/blog/?page=2' });
    const second = page('https://ex.test/blog/?page=2', { pagination_prev: '/blog/', pagination_next: 'https://ex.test/blog/?page=3' });
    const third = page('https://ex.test/blog/?page=3', { pagination_prev: 'https://ex.test/blog/?page=2' });
    const { documents } = buildDiagnosisDocuments([third, second, first], 'https://ex.test/');

    expect(documents).toHaveLength(1);
    expect(documents[0].primaryPage.url).toBe('https://ex.test/blog/');
  });

  it('reads the listing of a URL from its path or its page parameter', () => {
    expect(paginationBase('https://ex.test/blog/page/3/')).toBe('https://ex.test/blog');
    expect(paginationBase('https://ex.test/blog/?paged=4&sort=new')).toBe('https://ex.test/blog?sort=new');
    expect(paginationBase('?page=2', 'https://ex.test/sklep/')).toBe('https://ex.test/sklep');
    // `?p=123` is a WordPress post id and a non-numeric value is not a page number.
    expect(paginationBase('https://ex.test/?p=123')).toBe('https://ex.test/?p=123');
    expect(paginationBase('https://ex.test/blog/?page=last')).toBe('https://ex.test/blog?page=last');
    expect(paginationBase('http://[bad')).toBe('');
  });

  it('calls a page paginated only when it is one page of a listing', () => {
    expect(isPaginationPage(page('https://ex.test/blog/', { pagination_next: 'https://ex.test/blog/page/2/' }))).toBe(true);
    expect(isPaginationPage(page('https://ex.test/blog/strona/2/'))).toBe(true);
    expect(isPaginationPage(page(posts[1], { pagination_prev: posts[0], pagination_next: posts[2] }))).toBe(false);
    expect(isPaginationPage(page('https://ex.test/blog/', { pagination_next: 'http://[bad' }))).toBe(false);
    expect(isPaginationPage(page('not a url'))).toBe(false);
    expect(isPaginationPage(page('not a url', { pagination_next: 'https://ex.test/blog/page/2/' }))).toBe(false);
  });
});
