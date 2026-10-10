import type { CrawledPageSummary } from '@/types';
import type { AiCitationContextMatch } from './types';
import { contextTokens, normalizeContextPhrase } from './text';
import { bestSentenceMatch } from './sentences';
import { locateText, termEvidence } from './spans';
import { isSemanticNoiseTerm, isSemanticTopicalStatus, semanticPageTermEntries, semanticPageLanguage, semanticTermIdentity } from '@/services/semanticText';

export const buildContextMatch = (page: CrawledPageSummary, responseText: string | undefined): AiCitationContextMatch | undefined => {
  if (!responseText?.trim()) return undefined;
  if (!isSemanticTopicalStatus(page.http_status)) return { scope: 'no-content-signal', matchedTerms: [], responseTermCount: 0, sourceTermCount: 0, coveragePercent: null, meetsMinimum: false, excerptMatch: false, sentenceMatch: false, sentenceOverlapPercent: null, matchedTermEvidence: [] };
  const responseTerms = new Set(contextTokens(responseText).filter((term) => !isSemanticNoiseTerm(term)));
  if (!responseTerms.size) return { scope: 'no-content-signal', matchedTerms: [], responseTermCount: 0, sourceTermCount: 0, coveragePercent: null, meetsMinimum: false, excerptMatch: false, sentenceMatch: false, sentenceOverlapPercent: null, matchedTermEvidence: [] };
  const contentTerms = [...new Set(semanticPageTermEntries(page).flatMap(({ surface }) => contextTokens(surface)))];
  const titleTerms = contextTokens(page.title ?? '').filter((term) => !isSemanticNoiseTerm(term));
  const sourceTerms = contentTerms.length ? contentTerms : titleTerms;
  // Match by inflection key; evidence keeps the page's form and locates the response's form.
  const language = semanticPageLanguage(page);
  // Reverse insertion keeps the first response form of each inflection key.
  const responseForms = new Map([...responseTerms].reverse().map((term) => [semanticTermIdentity(term, language), term]));
  // Evidence terms are matched source terms or tokens of a response sentence, so the key exists.
  const responseForm = (term: string) => responseForms.get(semanticTermIdentity(term, language))!;
  const allMatchedTerms = sourceTerms.filter((term) => responseForms.has(semanticTermIdentity(term, language)));
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
    responseForm,
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
