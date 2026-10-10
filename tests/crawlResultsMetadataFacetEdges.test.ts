import { describe, expect, it } from 'vitest';
import {
  metadataFacetOptions,
  metadataFacetIds,
  issueMessageIncludes,
  metadataFacetsForPage,
} from '@/components/Domain/crawlResults/helpers/crawlResultsMetadata';
import type { CrawledPageIssue, CrawledPageSummary } from '@/types';

const makePage = (overrides: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  url: 'https://example.com/p',
  final_url: 'https://example.com/p',
  redirect_chain: [],
  http_status: 200,
  depth: 1,
  issues: [],
  issues_count: 0,
  content_type: 'text/html',
  response_time_ms: 50,
  indexability_status: 'indexable',
  body_truncated: false,
  word_count: 100,
  schema_types: [],
  schema_syntax_errors: 0,
  hreflangs: [],
  h1_count: 1,
  internal_link_count: 1,
  external_link_count: 0,
  links: [],
  images: [],
  ...overrides,
});

describe('crawlResultsMetadata edge coverage', () => {
  it('exposes options, set ids, and issue message search', () => {
    expect(metadataFacetOptions.length).toBe(9);
    expect(metadataFacetIds.has('missing-description')).toBe(true);
    const issue: CrawledPageIssue = { message: 'Title length is too short', severity: 'Warning' };
    const page = makePage({ issues: [issue] });
    expect(issueMessageIncludes(page, 'title length is')).toBe(true);
    expect(issueMessageIncludes(page, 'nonexistent')).toBe(false);
  });

  it('bypasses non-html content types', () => {
    expect(metadataFacetsForPage(makePage({ content_type: 'application/pdf' }))).toEqual([]);
    expect(metadataFacetsForPage(makePage({ content_type: undefined, title: undefined, meta_description: undefined }))).toEqual([
      'missing-title',
      'missing-description',
    ]);
  });

  it('handles title empty, short, long, valid, and issue fallback', () => {
    expect(metadataFacetsForPage(makePage({ title: '   ', meta_description: 'Valid description that is fine' }))).toContain('empty-title');
    const shortTitlePage = makePage({ title: 'Short', title_length: 10, meta_description: 'Valid description' });
    expect(metadataFacetsForPage(shortTitlePage)).toContain('title-length');
    const longTitlePage = makePage({ title: 'A'.repeat(80), title_length: 80, meta_description: 'Valid description' });
    expect(metadataFacetsForPage(longTitlePage)).toContain('title-length');
    const normalTitlePage = makePage({ title: 'Normal Length Title OK', title_length: 45, meta_description: 'Valid description' });
    expect(metadataFacetsForPage(normalTitlePage)).not.toContain('title-length');
    const issueTitlePage = makePage({
      title: 'Some Title',
      title_length: null as unknown as number,
      issues: [{ message: 'Page title length is abnormal', severity: 'Warning' }],
      meta_description: 'Valid description',
    });
    expect(metadataFacetsForPage(issueTitlePage)).toContain('title-length');
  });

  it('handles duplicate title and duplicate meta description', () => {
    const page = makePage({
      title: 'Valid Title Between Thirty And Sixty Chars',
      title_length: 40,
      meta_description: 'A'.repeat(90),
      meta_description_length: 90,
      issues: [
        { message: 'Found duplicate title across pages', severity: 'Warning' },
        { message: 'Found duplicate meta description here', severity: 'Warning' },
      ],
    });
    const facets = metadataFacetsForPage(page);
    expect(facets).toContain('duplicate-title');
    expect(facets).toContain('duplicate-description');
  });

  it('handles missing and empty meta description issues and bounds', () => {
    const missingDescIssue = makePage({
      title: 'Valid Title Between Thirty And Sixty Chars',
      meta_description: 'Present text',
      issues: [{ message: 'Warning: missing meta description', severity: 'Warning' }],
    });
    expect(metadataFacetsForPage(missingDescIssue)).toContain('missing-description');

    const emptyDescIssue = makePage({
      title: 'Valid Title Between Thirty And Sixty Chars',
      meta_description: 'Present text',
      issues: [{ message: 'Notice: meta description is empty', severity: 'Warning' }],
    });
    expect(metadataFacetsForPage(emptyDescIssue)).toContain('empty-description');

    const shortDesc = makePage({
      title: 'Valid Title Between Thirty And Sixty Chars',
      meta_description: 'Too short',
      meta_description_length: 20,
    });
    expect(metadataFacetsForPage(shortDesc)).toContain('description-length');

    const longDesc = makePage({
      title: 'Valid Title Between Thirty And Sixty Chars',
      meta_description: 'A'.repeat(200),
      meta_description_length: 200,
    });
    expect(metadataFacetsForPage(longDesc)).toContain('description-length');

    const normalDesc = makePage({
      title: 'Valid Title Between Thirty And Sixty Chars',
      title_length: 40,
      meta_description: 'A'.repeat(100),
      meta_description_length: 100,
    });
    expect(metadataFacetsForPage(normalDesc)).not.toContain('description-length');

    const issueDesc = makePage({
      title: 'Valid Title Between Thirty And Sixty Chars',
      meta_description: 'Some text',
      meta_description_length: null as unknown as number,
      issues: [{ message: 'Notice: meta description length is not standard', severity: 'Warning' }],
    });
    expect(metadataFacetsForPage(issueDesc)).toContain('description-length');

    const emptyMetaDesc = makePage({
      title: 'Valid Title Between Thirty And Sixty Chars',
      title_length: 40,
      meta_description: '   ',
    });
    expect(metadataFacetsForPage(emptyMetaDesc)).not.toContain('description-length');
  });
});
