import type { CrawledPageSummary } from '@/types';
import type { ParagraphSourceEvidence } from './types';
import { normalize, evidenceTokens } from './primitives';
import { bestBriefSentenceMatch } from './sentences';
import { citationAliases } from '@/services/citationEvidence/aliases';
import { normalizeHttpUrl as normalizeCitationUrl } from '@/services/citationEvidence/urls';

/**
 * Compare a reviewed paragraph with bounded content evidence from the selected
 * crawl. This is observability only: it never flips sourceChecked and does
 * not prove entailment, freshness, or truth.
 */
export const matchParagraphToCrawlSource = (
  paragraph: string,
  sourceUrl: string,
  pages: CrawledPageSummary[],
): ParagraphSourceEvidence => {
  const sourceIdentity = normalizeCitationUrl(sourceUrl);
  const page = sourceIdentity ? citationAliases(pages).get(sourceIdentity)?.page : undefined;
  if (!page) return { matched: false, scope: 'not-in-snapshot', matchedTerms: [], overlapPercent: null };
  const paragraphPhrase = normalize(paragraph);
  const paragraphTermSet = new Set(evidenceTokens(paragraph));
  const excerpts = page.semantic_excerpts ?? [];
  const exactExcerpt = excerpts.find((excerpt) => {
    const normalizedExcerpt = normalize(excerpt);
    return normalizedExcerpt.length >= 40 && paragraphPhrase.includes(normalizedExcerpt);
  });
  if (exactExcerpt) return { matched: true, scope: 'excerpt', matchedTerms: evidenceTokens(exactExcerpt).filter((term) => paragraphTermSet.has(term)).slice(0, 12), overlapPercent: 100, matchedExcerpt: exactExcerpt, pageUrl: page.final_url || page.url };
  const sentenceMatch = bestBriefSentenceMatch(paragraph, excerpts);
  if (sentenceMatch) return {
    matched: true,
    scope: 'sentence-match',
    matchedTerms: sentenceMatch.matchedTerms,
    overlapPercent: Math.round(sentenceMatch.overlap * 100),
    matchedExcerpt: sentenceMatch.excerpt,
    matchedSentence: sentenceMatch.text,
    sentenceOverlapPercent: Math.round(sentenceMatch.overlap * 100),
    responseSpan: { start: sentenceMatch.start, end: sentenceMatch.end },
    sourceSpan: { start: 0, end: sentenceMatch.excerpt.length },
    pageUrl: page.final_url || page.url,
  };
  const sourceTerms = evidenceTokens([page.title ?? '', ...(page.semantic_terms ?? [])].join(' '));
  const allMatchedTerms = sourceTerms.filter((term) => paragraphTermSet.has(term));
  const matchedTerms = allMatchedTerms.slice(0, 12);
  const overlapPercent = sourceTerms.length ? Math.round(allMatchedTerms.length / sourceTerms.length * 100) : null;
  if (matchedTerms.length >= 3 && overlapPercent !== null && overlapPercent >= 20) return { matched: true, scope: page.semantic_terms?.length ? 'semantic-terms' : 'title', matchedTerms, overlapPercent, pageUrl: page.final_url || page.url };
  return { matched: false, scope: page.semantic_terms?.length ? 'no-signal' : 'title', matchedTerms, overlapPercent, pageUrl: page.final_url || page.url };
};
