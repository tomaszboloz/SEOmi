import { describe, expect, it } from 'vitest';
import { assessContentBrief, matchParagraphToCrawlSource } from '@/services/contentBrief';
import { createEmptyContentBrief, createTopicalNode } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';

const pages = (values: Array<Partial<CrawledPageSummary>>) => values as CrawledPageSummary[];
const terms = ['espresso', 'grinder', 'brewing'];

describe('brief snapshot source identity regressions', () => {
  it('assesses legacy snapshots without a final URL and ignores absent schema identities', () => {
    const node = { ...createTopicalNode('Guide'), sourceUrls: [''] };
    const brief = { ...createEmptyContentBrief(), internalLinkTargets: ['https://site.test/guide#section'] };
    const result = assessContentBrief(node, brief, [], pages([
      { url: 'https://site.test/guide', schema_types: ['Article'] },
    ]));
    expect(result.unavailableInternalLinks).toEqual([]);
    expect(result.aeoReadiness.schemaTypesObserved).toEqual([]);
  });

  it('prefers an exact requested URL over an earlier redirect alias in either order', () => {
    const requested = { url: 'https://site.test/source', semantic_terms: terms };
    const redirected = { url: 'https://site.test/redirect', final_url: requested.url, semantic_terms: ['unrelated'] };
    for (const snapshot of [[redirected, requested], [requested, redirected]]) {
      expect(matchParagraphToCrawlSource(terms.join(' '), `${requested.url}#part`, pages(snapshot)))
        .toMatchObject({ matched: true, scope: 'semantic-terms', overlapPercent: 100 });
    }
  });

  it('does not assign an ambiguous final URL or duplicate request to an arbitrary page', () => {
    const snapshot = pages([
      { url: 'https://site.test/a', final_url: 'https://site.test/shared', semantic_terms: terms },
      { url: 'https://site.test/b', final_url: 'https://site.test/shared', semantic_terms: terms },
    ]);
    expect(matchParagraphToCrawlSource(terms.join(' '), 'https://site.test/shared', snapshot))
      .toEqual({ matched: false, scope: 'not-in-snapshot', matchedTerms: [], overlapPercent: null });
    expect(matchParagraphToCrawlSource(terms.join(' '), 'https://site.test/a', [snapshot[0], snapshot[0]]))
      .toEqual({ matched: false, scope: 'not-in-snapshot', matchedTerms: [], overlapPercent: null });
  });

  it('calculates coverage from every matched term while limiting visible evidence to twelve', () => {
    const vocabulary = Array.from({ length: 40 }, (_, index) => `concept${index}`);
    const result = matchParagraphToCrawlSource(vocabulary.join(' '), 'https://site.test/source', pages([
      { url: 'https://site.test/source', semantic_terms: vocabulary },
    ]));
    expect(result.overlapPercent).toBe(100);
    expect(result.matchedTerms).toEqual(vocabulary.slice(0, 12));
    expect(result).toMatchObject({ matched: true, scope: 'semantic-terms' });
  });

  it('does not turn the display cap into a false negative for a larger vocabulary', () => {
    const vocabulary = Array.from({ length: 80 }, (_, index) => `concept${index}`);
    const result = matchParagraphToCrawlSource(vocabulary.slice(0, 20).join(' '), 'https://site.test/source', pages([
      { url: 'https://site.test/source', semantic_terms: vocabulary },
    ]));
    expect(result).toMatchObject({ matched: true, overlapPercent: 25 });
    expect(result.matchedTerms).toHaveLength(12);
  });
});
