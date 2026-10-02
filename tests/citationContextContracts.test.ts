import { describe, expect, it } from 'vitest';
import { buildContextMatch } from '@/services/citationEvidence/context';
import type { CrawledPageSummary } from '@/types';

const page = (extra: Partial<CrawledPageSummary> = {}) => ({ url: 'https://site.test/a', ...extra }) as CrawledPageSummary;

describe('citation context scope and coverage', () => {
  it('distinguishes absent answers from answers with no lexical content', () => {
    expect(buildContextMatch(page(), undefined)).toBeUndefined();
    expect(buildContextMatch(page(), ' ')).toBeUndefined();
    expect(buildContextMatch(page(), 'a !')).toMatchObject({ scope: 'no-content-signal', responseTermCount: 0,
      coveragePercent: null, meetsMinimum: false, matchedTermEvidence: [] });
    expect(buildContextMatch(page(), 'coffee beans')).toMatchObject({ scope: 'no-content-signal', sourceTermCount: 0, coveragePercent: null });
  });

  it('uses semantic terms in preference to title-only signals and retains measured zero', () => {
    const result = buildContextMatch(page({ title: 'coffee beans', semantic_terms: ['grinder'], semantic_excerpts: ['grinder source'] }), 'coffee beans');
    expect(result).toMatchObject({ scope: 'semantic-terms', matchedTerms: [], coveragePercent: 0, meetsMinimum: false });
    expect(result?.sourceSpan).toBeUndefined();
    expect(buildContextMatch(page({ title: 'Coffee beans' }), 'coffee beans')).toMatchObject({ scope: 'title',
      coveragePercent: 100, sourceSpan: { text: 'Coffee beans', start: 0, end: 12, source: 'title' } });
  });

  it('qualifies a long two-token excerpt without inventing a sentence match', () => {
    const excerpt = 'extraordinarycharactersequence anotherextraordinarysequence';
    const result = buildContextMatch(page({ semantic_excerpts: [excerpt] }), `Intro ${excerpt} end.`);
    expect(result).toMatchObject({ scope: 'excerpt', excerptMatch: true, sentenceMatch: false,
      responseSpan: { text: excerpt, start: 6, end: 6 + excerpt.length, source: 'response' },
      sourceSpan: { text: excerpt, start: 0, end: excerpt.length, source: 'semantic-excerpt' } });
  });

  it('keeps normalized excerpt evidence but does not invent raw phrase offsets', () => {
    const excerpt = 'extraordinarycharactersequence anotherextraordinarysequence';
    const result = buildContextMatch(page({ semantic_excerpts: [excerpt] }), excerpt.replace(' ', ' — '));
    expect(result).toMatchObject({ scope: 'excerpt', excerptMatch: true, sentenceMatch: false });
    expect(result?.responseSpan).toBeUndefined();
    expect(result?.sourceSpan?.text).toBe(excerpt);
  });
});
