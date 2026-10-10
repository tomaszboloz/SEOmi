import { describe, expect, it } from 'vitest';
import { isSocialPage } from '@/components/Domain/crawlResults/socialTab/socialTabTypes';
import type { CrawledPageSummary } from '@/types';

describe('isSocialPage direct assertions', () => {
  const basePage: CrawledPageSummary = {
    url: 'https://example.com/',
    final_url: 'https://example.com/',
    depth: 0,
    http_status: 200,
    response_time_ms: 50,
    word_count: 100,
    title: 'Home',
    title_length: 4,
    indexability_status: 'Eligible from this response only',
    issues_count: 0,
    issues: [],
    redirect_chain: [],
    h1_count: 1,
    internal_link_count: 0,
    external_link_count: 0,
    links: [],
    images: [],
    schema_types: [],
    schema_syntax_errors: 0,
    hreflangs: [],
    body_truncated: false,
  };

  it('returns false when no social tags or favicons are present', () => {
    expect(isSocialPage(basePage)).toBe(false);
  });

  it('returns true when favicons are declared', () => {
    const pageWithFavicon: CrawledPageSummary = {
      ...basePage,
      favicons: ['https://example.com/favicon.ico'],
    };
    expect(isSocialPage(pageWithFavicon)).toBe(true);
  });

  it('returns true when favicon_metadata is present', () => {
    const pageWithFaviconMeta: CrawledPageSummary = {
      ...basePage,
      favicon_metadata: [{ href: 'https://example.com/icon.png', rel: 'icon' }],
    };
    expect(isSocialPage(pageWithFaviconMeta)).toBe(true);
  });

  it('returns true when social_meta_tags are present', () => {
    const pageWithSocial: CrawledPageSummary = {
      ...basePage,
      social_meta_tags: [{ key: 'og:title', content: 'Example' }],
    };
    expect(isSocialPage(pageWithSocial)).toBe(true);
  });
});
