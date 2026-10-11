import { describe, expect, it, vi } from 'vitest';
import { buildTopTenContentGap, collectTopTenContentGap } from '@/services/targetPhraseAudit/contentGap';

describe('contentGap deep branches', () => {
  it('handles excerpt formatting, final_url fallback matching, and HTTP >= 400 status', () => {
    const longText = 'prefix '.repeat(20) + 'specialkeyword ' + 'suffix '.repeat(30);
    const report = buildTopTenContentGap({
      phrase: 'seo optimization',
      rows: [
        { type: 'organic', rank: 1, url: 'https://site.test/p1', title: null, description: null },
        { type: 'organic', rank: 2, url: 'https://site.test/p2' },
      ],
      evidence: [
        {
          url: 'https://site.test/p1',
          fetchedAt: '2026-01-01',
          audit: {
            final_url: 'https://site.test/p1',
            http_status: 200,
            content_stats: { body_text: longText },
            meta_tags: { title: 'Test Title' },
            headings: { h1_texts: ['Header One'] },
          } as any,
        },
        {
          url: 'https://site.test/p2',
          fetchedAt: '2026-01-01',
          audit: {
            url: 'https://site.test/p2',
            http_status: 404,
            content_stats: { body_text: '' },
          } as any,
        },
      ],
      targetEvidence: {
        url: 'https://mysite.test/',
        fetchedAt: '2026-01-01',
        audit: {
          url: 'https://mysite.test/',
          content_stats: { body_text: 'mysite content without the term' },
        } as any,
      },
    });

    expect(report.status).toBe('partial');
    expect(report.rows[0].providerTitle).toBe('');
    expect(report.rows[0].providerDescription).toBe('');
    expect(report.rows[1].error).toBe('http-404');
    expect(report.topics.length).toBeGreaterThan(0);
    expect(report.topics[0].evidence[0].excerpt).toContain('…');
  });

  it('handles collectTopTenContentGap with invalid concurrency and mismatched URL exception', async () => {
    const inspectUrl = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('p1')) {
        return { url: 'https://mismatched.test/wrong', content_stats: { body_text: 'content' } };
      }
      return { url, http_status: 200, content_stats: { body_text: 'valid content' } };
    });

    const report = await collectTopTenContentGap({
      phrase: 'test',
      rows: [
        { type: 'organic', rank: 1, url: 'https://site.test/p1' },
        { type: 'organic', rank: 2, url: 'https://site.test/p2' },
      ],
      inspectUrl,
      concurrency: NaN, // exercises finiteConcurrency fallback
    });

    expect(report.rows[0].availability).toBe('error');
    expect(report.rows[0].error).toContain('does not match');
    expect(report.rows[1].availability).toBe('available');
  });
});
