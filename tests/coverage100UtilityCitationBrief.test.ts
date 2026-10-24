import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { citationAliases } from '@/services/citationEvidence/aliases';
import { buildContextMatch } from '@/services/citationEvidence/context';
import { bestSentenceMatch, responseSentences } from '@/services/citationEvidence/sentences';
import { locateTerm, locateText, termEvidence } from '@/services/citationEvidence/spans';
import { contextTokens, normalizeContextPhrase } from '@/services/citationEvidence/text';
import { citationCandidates, normalizeHttpUrl } from '@/services/citationEvidence/urls';
import { assessContentBrief, updateParagraphReview, verifiedFactsForReuse } from '@/services/briefDocument/assessment';
import { compareDrafts } from '@/services/briefDocument/diff';
import { evidenceTokens, extractDraftParagraphs, isHttpSourceUrl, normalize, normalizeHttpUrl as normalizeBriefUrl } from '@/services/briefDocument/primitives';

const page = (patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  url: 'https://example.test/request', final_url: 'https://example.test/final', http_status: 200,
  title: 'SEO audit evidence', semantic_terms: ['SEO audit', 'crawl evidence', 'technical report'],
  semantic_excerpts: ['SEO audit evidence explains crawl evidence for technical report readers.'],
  redirect_chain: [], ...patch,
} as CrawledPageSummary);

describe('citation evidence boundaries', () => {
  it('normalizes URLs, punctuation and token spans without inventing matches', () => {
    expect(normalizeHttpUrl('https://example.test/a#fragment')).toBe('https://example.test/a');
    expect(normalizeHttpUrl('ftp://example.test/a')).toBeNull();
    expect(citationCandidates('https://example.test/a).')).toEqual(['https://example.test/a).', 'https://example.test/a)', 'https://example.test/a']);
    expect(contextTokens('The SEO, audit! 2026')).toEqual(['seo', 'audit', '2026']);
    expect(normalizeContextPhrase('SEO\n audit')).toBe('seo audit');
    expect(locateText('A quoted phrase appears.', 'quoted phrase')).toEqual({ start: 2, end: 15 });
    expect(locateTerm('Technical audits help', 'audits')).toEqual({ start: 10, end: 16 });
    expect(termEvidence(['audit'], 'An audit helps', 'The audit source')).toHaveLength(1);
  });

  it('keeps only unambiguous citation aliases and reports sentence or no-content scope', () => {
    const first = page({ redirect_chain: [{ from_url: 'https://old.test', to_url: 'https://example.test/request', http_status: 301 }] });
    const second = page({ url: 'https://other.test', final_url: 'https://example.test/final' });
    const aliases = citationAliases([first, second]);
    expect(aliases.get('https://example.test/request')?.matchKind).toBe('request_url');
    expect(aliases.has('https://example.test/final')).toBe(false);
    const matched = buildContextMatch(first, 'SEO audit evidence explains crawl evidence for technical report readers.');
    expect(matched?.meetsMinimum).toBe(true);
    expect(matched?.sentenceMatch).toBe(true);
    expect(buildContextMatch(page({ http_status: 404 }), 'SEO audit evidence')).toMatchObject({ scope: 'no-content-signal', meetsMinimum: false });
    expect(responseSentences('Short. A longer sentence has enough topical words here.')).toHaveLength(1);
    expect(bestSentenceMatch('SEO audit evidence for technical report readers.', first.semantic_excerpts!)).not.toBeNull();
  });
});

describe('content brief primitives and diff', () => {
  it('normalizes draft text and bounds repeated line evidence', () => {
    expect(normalize('  Żółć\n  AUDIT ')).toBe('żółć audit');
    expect(evidenceTokens('The SEO audit oraz crawl')).toEqual(['seo', 'audit', 'crawl']);
    expect(extractDraftParagraphs('one\n\ntwo')).toEqual(['one', 'two']);
    expect(isHttpSourceUrl('https://source.test')).toBe(true);
    expect(isHttpSourceUrl('file:///tmp/x')).toBe(false);
    expect(normalizeBriefUrl('https://example.test/a#x')).toBe('https://example.test/a');
    const diff = compareDrafts('a\na\nb', 'a\nc', 1);
    expect(diff).toMatchObject({ changed: true, removedLineCount: 2, addedLineCount: 1, removedLines: ['a'] });
    expect(compareDrafts('same', 'same', Number.NaN).changed).toBe(false);
  });

  it('updates paragraph review records and assesses locked facts and links', () => {
    const review = updateParagraphReview([], 'A paragraph', { treatment: 'source-backed', sourceUrl: 'https://source.test', sourceChecked: true });
    expect(updateParagraphReview(review, 'A paragraph', { treatment: 'editorial' })).toEqual([{ paragraph: 'A paragraph', treatment: 'editorial', sourceUrl: 'https://source.test', sourceChecked: true }]);
    expect(verifiedFactsForReuse([{ reuseStatus: 'verified', sourceUrl: 'https://source.test' }, { reuseStatus: 'verified', sourceUrl: '' }] as never)).toHaveLength(1);
    const result = assessContentBrief(
      { queries: [{ id: 'q', text: 'target query' }], sourceUrls: ['https://example.test/final'] } as never,
      { targetQueryId: 'q', draftMarkdown: 'Locked fact.\n\nMissing section.', snippetTarget: 'definition', requiredEntities: ['entity'], internalLinkTargets: ['https://missing.test'], paragraphReviews: [] } as never,
      [{ reuseStatus: 'locked', value: 'Locked fact' }] as never,
      [page()],
    );
    expect(result).toMatchObject({ targetQuery: 'target query', lockedFactsInDraft: [{ value: 'Locked fact' }], missingRequiredEntities: ['entity'], unavailableInternalLinks: ['https://missing.test'], readyToAdvance: false });
  });
});
