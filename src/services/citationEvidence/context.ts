import type { CrawledPageSummary } from '@/types';
import type { AiCitationContextMatch } from './types';
import { contextTokens, normalizeContextPhrase } from './text';
import { bestSentenceMatch } from './sentences';
import { locateText, termEvidence } from './spans';

export const buildContextMatch = (page: CrawledPageSummary, responseText: string | undefined): AiCitationContextMatch | undefined => {
  if (!responseText?.trim()) return undefined;
  const responseTerms = new Set(contextTokens(responseText));
  if (!responseTerms.size) return { scope: 'no-content-signal', matchedTerms: [], responseTermCount: 0, sourceTermCount: 0, coveragePercent: null, meetsMinimum: false, excerptMatch: false, sentenceMatch: false, sentenceOverlapPercent: null, matchedTermEvidence: [] };
  const contentTerms = [...new Set((page.semantic_terms ?? []).flatMap(contextTokens))];
  const titleTerms = contextTokens(page.title ?? '');
  const sourceTerms = contentTerms.length ? contentTerms : titleTerms;
  const allMatchedTerms = sourceTerms.filter((term) => responseTerms.has(term));
  const matchedTerms = allMatchedTerms.slice(0, 12);
  const normalizedResponse = normalizeContextPhrase(responseText);
  const matchedExcerpt = (page.semantic_excerpts ?? []).find((excerpt) => {
    const normalizedExcerpt = normalizeContextPhrase(excerpt);
    return normalizedExcerpt.length >= 40 && normalizedResponse.includes(normalizedExcerpt);
  });
  const sentenceMatch = bestSentenceMatch(responseText, page.semantic_excerpts ?? []);
  const scope = sentenceMatch ? 'sentence-match' : matchedExcerpt ? 'excerpt' : contentTerms.length ? 'semantic-terms' : titleTerms.length ? 'title' : 'no-content-signal';
  const sourceEvidenceText = sentenceMatch?.excerpt || matchedExcerpt || (contentTerms.length ? page.semantic_excerpts?.[0] : page.title ?? undefined);
  const matchedTermEvidence = termEvidence(
    sentenceMatch?.matchedTerms || matchedTerms,
    responseText,
    sourceEvidenceText,
  );
  const responseSpan = sentenceMatch
    ? { text: sentenceMatch.text, start: sentenceMatch.start, end: sentenceMatch.end, source: 'response' as const }
    : matchedExcerpt
      ? (() => {
        const range = locateText(responseText, matchedExcerpt);
        return range ? { text: responseText.slice(range.start, range.end), ...range, source: 'response' as const } : undefined;
      })()
      : undefined;
  const sourceSpan = sentenceMatch
    ? { text: sentenceMatch.excerpt, start: sentenceMatch.sourceStart, end: sentenceMatch.sourceEnd, source: 'semantic-excerpt' as const }
    : matchedExcerpt
      ? { text: matchedExcerpt, start: 0, end: matchedExcerpt.length, source: 'semantic-excerpt' as const }
      : !contentTerms.length && titleTerms.length
        ? { text: page.title!, start: 0, end: page.title!.length, source: 'title' as const }
        : undefined;
  return {
    scope,
    matchedTerms,
    responseTermCount: responseTerms.size,
    sourceTermCount: sourceTerms.length,
    coveragePercent: sourceTerms.length ? Math.round(allMatchedTerms.length / sourceTerms.length * 100) : null,
    // Two matching source terms is a deliberately weak observability signal,
    // not evidence that the answer cited or faithfully represented the page.
    meetsMinimum: matchedTerms.length >= 2 || Boolean(sentenceMatch),
    excerptMatch: Boolean(matchedExcerpt),
    ...(matchedExcerpt ? { matchedExcerpt } : {}),
    sentenceMatch: Boolean(sentenceMatch),
    ...(sentenceMatch ? { matchedResponseSentence: sentenceMatch.text, matchedExcerpt: sentenceMatch.excerpt } : {}),
    sentenceOverlapPercent: sentenceMatch ? Math.round(sentenceMatch.overlap * 100) : null,
    ...(responseSpan ? { responseSpan } : {}),
    ...(sourceSpan ? { sourceSpan } : {}),
    matchedTermEvidence,
  };
};
