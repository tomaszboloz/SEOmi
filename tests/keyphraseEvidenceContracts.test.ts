import { describe, expect, it } from 'vitest';
import { analyzeKeyphrase, flattenHeadings } from '@/services/keyphraseAnalysis';
import type { PageAuditData } from '@/types';

const fixture = (body: string, title: string | null = null): PageAuditData => ({
  meta_tags: { title, description: null },
  headings: { hierarchy: [] },
  links: { links: [] },
  content_stats: { body_text: body },
} as unknown as PageAuditData);

const bodyEvidence = (body: string) => analyzeKeyphrase(fixture(body), 'SEO').find((item) => item.field === 'body');

describe('direct keyphrase evidence contracts', () => {
  it('returns no evidence for whitespace and preserves an empty heading tree', () => {
    expect(analyzeKeyphrase(fixture('SEO'), '   ')).toEqual([]);
    expect(flattenHeadings([])).toEqual([]);
  });
  it('reports zero observations for absent fields and unmatched text', () => {
    const evidence = analyzeKeyphrase(fixture('unrelated'), 'SEO');
    expect(evidence.map(({ field, occurrences, evidence: excerpts }) => ({ field, occurrences, excerpts }))).toEqual(
      ['title', 'meta_description', 'headings', 'anchors', 'body'].map((field) => ({ field, occurrences: 0, excerpts: [] })),
    );
    expect(analyzeKeyphrase(fixture(''), 'SEO').every((item) => item.evidence.length === 0)).toBe(true);
  });
  it('preserves short actual text and counts literal case-insensitive occurrences', () => {
    expect(bodyEvidence('SEO seo SeO')).toMatchObject({ occurrences: 3, evidence: ['SEO seo SeO'] });
    expect(analyzeKeyphrase(fixture('', 'C++ C++'), ' C++ ')[0]).toMatchObject({ occurrences: 2, evidence: ['C++ C++'] });
  });
  it('clips a central occurrence with both omission markers', () => {
    expect(bodyEvidence('a'.repeat(100) + 'SEO' + 'b'.repeat(200))?.evidence).toEqual([
      '…' + 'a'.repeat(70) + 'SEO' + 'b'.repeat(90) + '…',
    ]);
  });
  it('clips leading and trailing occurrences with only the applicable marker', () => {
    expect(bodyEvidence('SEO' + 'b'.repeat(200))?.evidence).toEqual(['SEO' + 'b'.repeat(90) + '…']);
    expect(bodyEvidence('a'.repeat(200) + 'SEO')?.evidence).toEqual(['…' + 'a'.repeat(70) + 'SEO']);
  });
});
