import type { CrawledPageSummary } from '@/types';
import type { ParagraphSourceEvidence } from './types';
import { normalize, evidenceTokens } from './primitives';
import { bestBriefSentenceMatch } from './sentences';
import { citationAliases } from '@/services/citationEvidence/aliases';
import { normalizeHttpUrl as normalizeCitationUrl } from '@/services/citationEvidence/urls';
import { isSemanticNoiseTerm, isSemanticTopicalStatus, semanticPageTermEntries, semanticPageLanguage, semanticTermIdentity, uniqueSemanticTerms } from '@/services/semanticText';

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
  if (!isSemanticTopicalStatus(page.http_status)) return { matched: false, scope: 'no-signal', matchedTerms: [], overlapPercent: null, pageUrl: page.final_url || page.url };
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
  const language = semanticPageLanguage(page);
  const paragraphKeys = new Set([...paragraphTermSet].filter((term) => !isSemanticNoiseTerm(term)).map((term) => semanticTermIdentity(term, language)));
  // Legacy snapshots may contain more terms than the current crawler display cap.
  // Keep the bounded extractor as the default everywhere else, but retain the
  // full stored vocabulary here so the coverage denominator cannot be inflated
  // by truncating only the source side of a paragraph comparison.
  const semanticTerms = semanticPageTermEntries(page, page.semantic_terms?.length ?? 0).map(({ surface }) => surface);
  const sourceTerms = uniqueSemanticTerms(evidenceTokens([page.title ?? '', ...semanticTerms].join(' ')), language);
  const allMatchedTerms = sourceTerms.filter((term) => paragraphKeys.has(semanticTermIdentity(term, language)));
  const matchedTerms = allMatchedTerms.slice(0, 12);
  const overlapPercent = sourceTerms.length ? Math.round(allMatchedTerms.length / sourceTerms.length * 100) : null;
  const scope = semanticTerms.length ? 'semantic-terms' : sourceTerms.length ? 'title' : 'no-signal';
  if (matchedTerms.length >= 3 && overlapPercent !== null && overlapPercent >= 20) return { matched: true, scope, matchedTerms, overlapPercent, pageUrl: page.final_url || page.url };
  return { matched: false, scope, matchedTerms, overlapPercent, pageUrl: page.final_url || page.url };
};
