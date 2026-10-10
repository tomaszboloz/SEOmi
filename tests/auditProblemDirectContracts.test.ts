import { describe, expect, it } from 'vitest';
import { getAmpProblems, getMetadataProblems, getStructuredDataProblems } from '@/services/auditProblems';
import type { PageAuditData } from '@/types';
import i18n from '@/i18n';

const audit = (overrides: Partial<PageAuditData> = {}): PageAuditData => ({
  url: 'https://example.test', final_url: 'https://example.test', timestamp: '2026-10-05T00:00:00.000Z', http_status: 200,
  response_time_ms: 10, redirect_chain: [],
  meta_tags: { title: 'A'.repeat(55), title_length: 55, description: 'D'.repeat(140), description_length: 140, canonical: 'https://example.test', viewport: 'width=device-width', other_tags: [] },
  open_graph: { all_tags: [] }, twitter_card: { all_tags: [] },
  headings: { h1_count: 1, h1_texts: ['Topic'], hierarchy: [], has_valid_hierarchy: true, issues: [] }, images: [],
  links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] }, security_headers: { score: 90 },
  structured_data: [], technical: { hreflang_tags: [] }, health_score: 100, issues: [],
  content_stats: { word_count: 10, reading_time_minutes: 1, text_ratio_percent: 10, top_keywords: [] }, ...overrides,
});

describe('audit problem public contracts', () => {
  it('reports both sides of metadata length boundaries and recorded indexability evidence', () => {
    const short = getMetadataProblems(audit({ meta_tags: { title: 'short', title_length: 39, description: 'short', description_length: 119, other_tags: [] } }));
    expect(short.map(({ id }) => id)).toEqual(expect.arrayContaining(['metadata-title-length', 'metadata-description-length']));

    const long = getMetadataProblems(audit({
      meta_tags: { title: 'long', title_length: 66, description: 'long', description_length: 166, canonical: '', viewport: '', robots: 'X-Robots-Tag: none', other_tags: [] },
      indexability: { status: 'blocked', reasons: ['X-Robots-Tag: none'], canonical_target_checked: true, canonical_target_status: 0, canonical_target_check_error: 'timeout' },
    }));
    expect(long.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'metadata-title-length', 'metadata-description-length', 'metadata-canonical-missing', 'metadata-viewport-missing',
      'metadata-canonical-target', 'metadata-canonical-unverified', 'metadata-indexing-blocked',
    ]));
    expect(long.find(({ id }) => id === 'metadata-canonical-target')?.detail).toContain('unknown');
  });

  it('keeps only recorded structured findings and preserves path and raw evidence', () => {
    const problems = getStructuredDataProblems(audit({ structured_data: [{ data_type: 'Product', format: 'JSON-LD', content: {}, validation_issues: [
      { code: 'product-name-missing', severity: 'warning', message: 'Provider says name is missing.', path: 'name', recommendation: 'Add a name.' },
      { code: 'provider-info', severity: 'info', message: 'Informational provider note.' },
    ] }] }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ id: 'structured-data-0-0-product-name-missing', severity: 'warning' });
    expect(problems[0].detail).toContain('name');
    expect(problems[0].evidence).toContain('Provider says name is missing.');
    expect(problems[0].evidence).toContain('Add a name.');
  });

  it('uses the source review detail when an AMP finding has no recommendation', () => {
    const [problem] = getAmpProblems(audit({ amp: {
      detected: true, is_amp_document: true, amphtml_urls: [], coverage: 'local', findings: [
        { code: 'amp-runtime-missing', severity: 'error', message: 'Runtime absent.', evidence: '', recommendation: '' },
      ], unchecked: [],
    } }));
    expect(problem).toMatchObject({ id: 'amp-amp-runtime-missing', severity: 'error' });
    expect(problem.detail).toBe(i18n.t('ampFindings.reviewSource'));
    expect(problem.evidence).toBe('Runtime absent.');
  });
});
