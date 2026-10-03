import { describe, expect, it } from 'vitest';
import { matchParagraphToCrawlSource } from '@/services/briefDocument/evidence';
import type { CrawledPageSummary } from '@/types';

const source = (data: Partial<CrawledPageSummary>) => ({ url: 'https://site.test/source', ...data }) as CrawledPageSummary;

describe('brief source evidence contracts', () => {
  it('uses final/request/redirect identities and rejects unsupported URLs', () => {
    const page = source({ final_url: 'https://site.test/final', semantic_terms: ['coffee', 'beans', 'roasted'], redirect_chain: [{ from_url: 'https://site.test/old', to_url: 'https://site.test/source', http_status: 301 }] });
    for (const url of [page.url, page.final_url, 'https://site.test/old']) {
      expect(matchParagraphToCrawlSource('coffee beans roasted', url, [page]))
        .toMatchObject({ matched: true, overlapPercent: 100, pageUrl: page.final_url });
    }
    for (const url of ['', 'ftp://site.test/source', 'not a URL']) {
      expect(matchParagraphToCrawlSource('coffee beans roasted', url, [page]))
        .toMatchObject({ matched: false, scope: 'not-in-snapshot', overlapPercent: null });
    }
  });

  it('requires enough exact excerpt content and otherwise uses bounded sentence evidence', () => {
    const excerpt = 'Coffee beans are roasted before brewing for a deeper flavour profile.';
    const page = source({ semantic_excerpts: ['short', excerpt] });
    expect(matchParagraphToCrawlSource(`Intro. ${excerpt} Closing.`, page.url, [page]))
      .toMatchObject({ matched: true, scope: 'excerpt', matchedExcerpt: excerpt, pageUrl: page.url });
    const paragraph = 'Intro. Coffee beans are roasted before brewing and help a deeper flavour profile. Closing.';
    const result = matchParagraphToCrawlSource(paragraph, page.url, [page]);
    expect(result).toMatchObject({ matched: true, scope: 'sentence-match', sourceSpan: { start: 0, end: excerpt.length } });
    expect(paragraph.slice(result.responseSpan!.start, result.responseSpan!.end)).toBe(result.matchedSentence);
    expect(result.sentenceOverlapPercent).toBe(result.overlapPercent);
    expect(result.overlapPercent).toBeGreaterThanOrEqual(35);
  });

  it('distinguishes title-only evidence, missing evidence, insufficient terms and low overlap', () => {
    const title = source({ title: 'Coffee beans roasted' });
    expect(matchParagraphToCrawlSource('coffee beans roasted', title.url, [title]))
      .toMatchObject({ matched: true, scope: 'title', overlapPercent: 100 });
    expect(matchParagraphToCrawlSource('coffee beans', title.url, [title]))
      .toMatchObject({ matched: false, scope: 'title', matchedTerms: ['coffee', 'beans'], overlapPercent: 67 });
    expect(matchParagraphToCrawlSource('unrelated', title.url, [title]))
      .toMatchObject({ matched: false, matchedTerms: [], overlapPercent: 0 });
    expect(matchParagraphToCrawlSource('coffee beans roasted', title.url, [source({})]))
      .toMatchObject({ matched: false, scope: 'title', overlapPercent: null });
    const page = source({ semantic_terms: Array.from({ length: 20 }, (_, i) => `concept${i}`) });
    expect(matchParagraphToCrawlSource('concept0 concept1 concept2', page.url, [page]))
      .toMatchObject({ matched: false, scope: 'no-signal', overlapPercent: 15 });
  });
});
