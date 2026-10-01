import { describe, expect, it } from 'vitest';
import { matchParagraphToCrawlSource } from '@/services/contentBrief';

import type { CrawledPageSummary } from '@/types';

describe('content brief evidence gate', () => {

it('shows bounded source-context evidence without auto-verifying the paragraph', () => {
    const sourcePages = [{
      url: 'https://site.test/source', final_url: 'https://site.test/source', title: 'Coffee source',
      semantic_terms: ['coffee', 'beans', 'roasted'], semantic_excerpts: ['Coffee beans are roasted before brewing for a deeper flavour profile.'],
    }] as unknown as CrawledPageSummary[];
    const excerptMatch = matchParagraphToCrawlSource('Coffee beans are roasted before brewing for a deeper flavour profile.', 'https://site.test/source#section', sourcePages);
    const missing = matchParagraphToCrawlSource('Unrelated claim.', 'https://site.test/missing', sourcePages);

    expect(excerptMatch).toMatchObject({ matched: true, scope: 'excerpt', overlapPercent: 100, pageUrl: 'https://site.test/source' });
    const sentenceMatch = matchParagraphToCrawlSource('Introductory context. Coffee beans are roasted before brewing and help a deeper flavour profile. Closing note.', 'https://site.test/source', sourcePages);
    expect(sentenceMatch).toMatchObject({
      matched: true,
      scope: 'sentence-match',
      matchedSentence: 'Coffee beans are roasted before brewing and help a deeper flavour profile',
      matchedExcerpt: 'Coffee beans are roasted before brewing for a deeper flavour profile.',
      responseSpan: { start: 22 },
      sourceSpan: { start: 0 },
    });
    expect(missing).toMatchObject({ matched: false, scope: 'not-in-snapshot', overlapPercent: null });
  });
});
