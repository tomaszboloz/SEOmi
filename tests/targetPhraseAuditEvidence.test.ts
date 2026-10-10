import { describe, expect, it } from 'vitest';
import type { PageAuditData } from '@/types';
import { buildTargetPhraseAudit, normalizeProviderIntent } from '@/services/targetPhraseAudit';

const audit = (body = 'SEO guide. SEO details.', truncated = false): PageAuditData => ({
  url: 'https://example.test/source', final_url: 'https://example.test/final', timestamp: '2026-10-06T10:00:00.000Z',
  meta_tags: { title: 'SEO guide', description: null },
  headings: { h1_count: 1, h1_texts: ['SEO overview'], hierarchy: [{ level: 1, text: 'SEO overview', children: [] }], has_valid_hierarchy: true, issues: [] },
  links: { total_links: 1, internal_links: 1, external_links: 0, nofollow_links: 0, links: [{ text: 'SEO details', href: '/seo', is_internal: true }] },
  content_stats: { body_text: body, body_text_truncated: truncated },
} as unknown as PageAuditData);

describe('target phrase audit evidence', () => {
  it('keeps literal evidence tied to the audited URL and timestamp', () => {
    const report = buildTargetPhraseAudit(audit(), ' seo ', 'Informational');
    expect(report).toMatchObject({
      phrase: 'seo', url: 'https://example.test/final', timestamp: '2026-10-06T10:00:00.000Z',
      intent: 'informational', intentSource: 'provider', completeness: 'complete',
    });
    expect(report?.evidence.map((item) => [item.field, item.occurrences])).toEqual([
      ['title', 1], ['h1', 1], ['body', 2], ['anchors', 1],
    ]);
  });

  it('marks missing or truncated body as partial and never infers intent', () => {
    const report = buildTargetPhraseAudit(audit('', true), 'commercial SEO');
    expect(report).toMatchObject({ intent: null, intentSource: 'unavailable', completeness: 'partial' });
    expect(report?.completenessReasons).toEqual(['body-unavailable', 'body-truncated']);
    expect(normalizeProviderIntent('commercial investigation')).toBeNull();
    expect(normalizeProviderIntent('unknown')).toBeNull();
  });

  it('returns an empty report for whitespace and bounds long excerpts', () => {
    expect(buildTargetPhraseAudit(audit(), '   ')).toBeNull();
    const report = buildTargetPhraseAudit(audit('a'.repeat(100) + 'SEO' + 'b'.repeat(200)), 'SEO');
    const body = report?.evidence.find((item) => item.field === 'body');
    expect(body?.evidence[0]).toHaveLength(165);
    expect(body?.evidence[0]).toMatch(/^…a{70}SEOb{90}…$/);
    expect(buildTargetPhraseAudit(audit('SEO' + 'b'.repeat(200)), 'SEO')?.evidence[2].evidence[0]).toMatch(/^SEOb{90}…$/);
    expect(buildTargetPhraseAudit(audit('a'.repeat(200) + 'SEO'), 'SEO')?.evidence[2].evidence[0]).toMatch(/^…a{70}SEO$/);
  });

  it('handles legacy audits with missing optional sections and fallback H1 metadata', () => {
    const legacy = { url: 'https://legacy.test/', final_url: '', timestamp: '', headings: { h1_texts: ['Legacy SEO'] }, content_stats: {}, links: {} } as unknown as PageAuditData;
    const report = buildTargetPhraseAudit(legacy, 'SEO');
    expect(report).toMatchObject({ url: 'https://legacy.test/', timestamp: '', completeness: 'partial' });
    expect(report?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'h1', occurrences: 1 }),
      expect.objectContaining({ field: 'body', occurrences: 0 }),
      expect.objectContaining({ field: 'anchors', occurrences: 0 }),
    ]));
    expect(normalizeProviderIntent(undefined)).toBeNull();
    const missingH1 = { url: '', final_url: '', headings: { hierarchy: [] }, content_stats: { body_text: 'SEO' }, links: {}, meta_tags: {} } as unknown as PageAuditData;
    expect(buildTargetPhraseAudit(missingH1, 'SEO')).toMatchObject({ url: '', completeness: 'complete' });
    const missingHeadings = { url: 'https://missing.test/', final_url: '', headings: { hierarchy: [] }, content_stats: { body_text: 'SEO' }, links: {}, meta_tags: {} } as unknown as PageAuditData;
    expect(buildTargetPhraseAudit(missingHeadings, 'SEO')?.evidence[1]).toMatchObject({ field: 'h1', occurrences: 0 });
  });
});
