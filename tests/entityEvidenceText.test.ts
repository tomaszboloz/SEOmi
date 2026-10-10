import { describe, expect, it } from 'vitest';
import { normalize, tokens, pageUrl, schemaTypeLabel, assertionLabel, coverageFor } from '@/services/entityEvidence/text';
import type { CrawledPageSummary } from '@/types';
import type { TopicalEntityFact } from '@/services/topicalMap';

const page = (terms?: string[]) => ({ url: 'https://example.com', semantic_terms: terms }) as CrawledPageSummary;

describe('entity evidence lexical contracts', () => {
  it('normalizes compatibility characters and punctuation without losing Polish letters', () => {
    expect(normalize('  ＳＥＯ — ŁÓDŹ! 42 ')).toBe('seo łódź 42');
    expect(normalize('\u0000!!!')).toBe('');
  });

  it('filters stop words and single characters, deduplicates and bounds assertion terms', () => {
    expect(tokens('The SEO seo oraz Łódź a x')).toEqual(['seo', 'łódź']);
    expect(tokens(Array.from({ length: 20 }, (_, index) => `term${index}`).join(' ')))
      .toEqual(Array.from({ length: 16 }, (_, index) => `term${index}`));
  });

  it('uses the final crawl URL when available and the request URL otherwise', () => {
    expect(pageUrl(page())).toBe('https://example.com');
    expect(pageUrl({ ...page(), final_url: '' })).toBe('https://example.com');
    expect(pageUrl({ ...page(), final_url: 'https://example.com/final' })).toBe('https://example.com/final');
  });

  it('normalizes schema namespaces but retains the observed type label', () => {
    expect(schemaTypeLabel(' HTTPS://schema.org/Organization ')).toBe('Organization');
    expect(schemaTypeLabel(' schema:Person ')).toBe('Person');
    expect(schemaTypeLabel(' Thing ')).toBe('Thing');
    expect(schemaTypeLabel('  ')).toBe('');
    expect(assertionLabel({ attribute: 'City', value: 'Łódź' } as TopicalEntityFact)).toBe('City: Łódź');
  });

  it('distinguishes unavailable term evidence from measured zero and partial overlap', () => {
    expect(coverageFor([], page(['seo']))).toBeNull();
    expect(coverageFor(['seo'], page())).toBeNull();
    expect(coverageFor(['seo'], page(['!!!']))).toBeNull();
    expect(coverageFor(['seo'], page(['ale', '2026']))).toBeNull();
    expect(coverageFor(['seo'], page(['unrelated']))).toEqual({ matched: [], coverage: 0 });
    expect(coverageFor(['seo', 'łódź'], page(['SEO!', 'seo']))).toEqual({ matched: ['seo'], coverage: 0.5 });
  });
});
