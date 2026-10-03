import { describe, expect, it } from 'vitest';
import { assessContentBrief, updateParagraphReview, verifiedFactsForReuse } from '@/services/briefDocument/assessment';
import { createEmptyContentBrief, createTopicalNode } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';
import { fact } from './fixtures/contentBriefContracts';

describe('brief readiness contracts', () => {
  it('reports each missing prerequisite without treating advisory scores as factual evidence', () => {
    const node = createTopicalNode('Guide');
    const brief = { ...createEmptyContentBrief(), requiredEntities: ['Grinder'], internalLinkTargets: ['https://site.test/missing'], draftMarkdown: 'coffee beans are roasted' };
    const result = assessContentBrief(node, brief, [fact('coffee beans', 'locked'), fact('co', 'locked'), fact('absent claim', 'locked')], []);
    expect(result.targetQuery).toBeNull();
    expect(result.missingRequiredEntities).toEqual(['Grinder']);
    expect(result.unavailableInternalLinks).toEqual(brief.internalLinkTargets);
    expect(result.unreviewedParagraphs).toEqual([brief.draftMarkdown]);
    expect(result.unsupportedParagraphs).toEqual([]);
    expect(result.lockedFactsInDraft.map((item) => item.value)).toEqual(['coffee beans']);
    expect(result).toMatchObject({ readyForBrief: false, readyToAdvance: false, paragraphCount: 1, wordCount: 4 });
  });

  it('requires source confirmation and a HTTP source for every source-backed paragraph', () => {
    const node = { ...createTopicalNode('Guide'), queries: [{ id: 'q', text: 'coffee', provenance: 'asserted' as const }] };
    const draftMarkdown = 'coffee beans roasted';
    const brief = { ...createEmptyContentBrief(), targetQueryId: 'q', snippetTarget: 'definition' as const, draftMarkdown };
    for (const [sourceUrl, sourceChecked, unsupported] of [
      ['https://site.test/evidence', false, true], ['bad URL', true, true],
      ['ftp://site.test/evidence', true, true], ['https://site.test/evidence', true, false],
    ] as const) {
      const reviewed = { ...brief, paragraphReviews: updateParagraphReview([], draftMarkdown, { treatment: 'source-backed', sourceUrl, sourceChecked }) };
      const result = assessContentBrief(node, reviewed, [], []);
      expect(result.unsupportedParagraphs).toEqual(unsupported ? [draftMarkdown] : []);
      expect(result.readyToAdvance).toBe(!unsupported);
    }
    expect(assessContentBrief(node, { ...brief, draftMarkdown: '' }, [], []).readyToAdvance).toBe(false);
    expect(assessContentBrief(node, { ...brief, snippetTarget: 'none' }, [], []).readyForBrief).toBe(false);
  });

  it('uses only assigned request/final identities for schema signals and deduplicates types', () => {
    const node = { ...createTopicalNode('Guide'), sourceUrls: ['https://site.test/request#part', 'https://site.test/final'] };
    const pages = [
      { url: 'https://site.test/request', schema_types: ['Article', 'Article'] },
      { url: 'https://site.test/redirect', final_url: 'https://site.test/final', schema_types: ['FAQPage'] },
      { url: 'https://site.test/unrelated', schema_types: ['Product'] },
      { url: 'https://site.test/final' },
    ] as CrawledPageSummary[];
    expect(assessContentBrief(node, createEmptyContentBrief(), [], pages).aeoReadiness.schemaTypesObserved)
      .toEqual(['Article', 'FAQPage']);
  });

  it('updates exactly one paragraph review, preserves other entries and bounds the newest five hundred', () => {
    let reviews = updateParagraphReview([], 'first', {});
    expect(reviews[0]).toEqual({ paragraph: 'first', treatment: 'unreviewed', sourceUrl: '', sourceChecked: false });
    reviews = updateParagraphReview(reviews, 'second', { treatment: 'editorial' });
    reviews = updateParagraphReview(reviews, 'first', { sourceUrl: 'https://site.test/source' });
    expect(reviews.map((item) => item.paragraph)).toEqual(['second', 'first']);
    expect(reviews[1]).toMatchObject({ treatment: 'unreviewed', sourceUrl: 'https://site.test/source' });
    for (let index = 0; index < 500; index += 1) reviews = updateParagraphReview(reviews, `paragraph ${index}`, { treatment: 'editorial' });
    expect(reviews).toHaveLength(500);
    expect(reviews[0].paragraph).toBe('paragraph 0');
    expect(reviews.at(-1)?.paragraph).toBe('paragraph 499');
  });

  it('exposes only explicitly verified facts with a recorded source', () => {
    const verified = fact('approved', 'verified', 'https://site.test/fact');
    expect(verifiedFactsForReuse([verified, fact('unsourced', 'verified'), fact('locked', 'locked', verified.sourceUrl)]))
      .toEqual([verified]);
    expect(verifiedFactsForReuse([])).toEqual([]);
  });
});
