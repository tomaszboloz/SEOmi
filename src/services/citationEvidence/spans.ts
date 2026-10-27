import type { AiCitationTermEvidence } from './types';
import { contextTokens } from './text';

export const locateText = (haystack: string, needle: string): { start: number; end: number } | undefined => {
  const trimmed = needle.trim();
  if (!trimmed) return undefined;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(escaped, 'iu').exec(haystack);
  return match ? { start: match.index, end: match.index + match[0].length } : undefined;
};

/** Match whole source tokens while keeping offsets in the original UTF-16 text. */
export const locateTerm = (text: string, term: string): { start: number; end: number } | undefined => {
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (contextTokens(match[0]).includes(term)) return { start: match.index, end: match.index + match[0].length };
  }
  return undefined;
};

/** `responseForm` maps a page term to the inflected form the response actually used. */
export const termEvidence = (
  terms: string[], responseText: string, sourceText: string | undefined,
  responseForm: (term: string) => string = (term) => term,
): AiCitationTermEvidence[] =>
  terms.slice(0, 12).map((term) => {
    const response = locateTerm(responseText, responseForm(term));
    const source = sourceText ? locateTerm(sourceText, term) : undefined;
    return { term, ...(response ? { response } : {}), ...(source ? { source } : {}) };
  });
