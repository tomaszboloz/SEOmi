import { assertSerpPayload } from '../serpImport/normalize';
import { GOOGLE_SUGGESTIONS_REASON, normalizeFreeRequest, type PublicFeedRequest, type PublicFeedResponse } from '../freeSerp/contracts';
import { assertPublicFeedUrl, googleSuggestionsFeedUrl } from '../freeSerp/urls';
import { MAX_GOOGLE_SUGGESTIONS, MAX_GOOGLE_SUGGESTION_LENGTH, type GoogleSuggestionsResult } from './contracts';

const comparable = (value: string): string => value.trim().replace(/\s+/gu, ' ').toLowerCase();

export const parseGoogleSuggestions = (
  payload: string,
  request: PublicFeedRequest,
  sourceUrl = googleSuggestionsFeedUrl(request.keyword, request.geo, request.language),
  fetchedAt = new Date().toISOString(),
): GoogleSuggestionsResult => {
  const normalized = normalizeFreeRequest({ ...request, feed: 'google-suggestions' });
  assertPublicFeedUrl(sourceUrl, normalized);
  assertSerpPayload(payload);
  if (!Number.isFinite(Date.parse(fetchedAt))) throw new Error('Google Suggestions timestamp is invalid');
  let parsed: unknown;
  try { parsed = JSON.parse(payload); } catch { throw new Error('Invalid Google Suggestions JSON'); }
  if (!Array.isArray(parsed) || typeof parsed[0] !== 'string' || !Array.isArray(parsed[1])) throw new Error('Invalid Google Suggestions envelope');
  if (comparable(parsed[0]) !== comparable(normalized.keyword)) throw new Error('Google Suggestions query echo does not match request');
  const unique = new Map<string, string>();
  for (const value of parsed[1]) {
    if (typeof value !== 'string') throw new Error('Invalid Google Suggestions item');
    const suggestion = value.trim().replace(/\s+/gu, ' ');
    if (suggestion.length > MAX_GOOGLE_SUGGESTION_LENGTH) throw new Error('Google Suggestions item is too long');
    if (suggestion) unique.set(suggestion.toLowerCase(), suggestion);
  }
  const suggestions = [...unique.values()].slice(0, MAX_GOOGLE_SUGGESTIONS);
  const source = {
    kind: 'google-suggest-unofficial' as const, provider: 'Google Suggest' as const, sourceUrl,
    requestedGeo: normalized.geo, requestedLanguage: normalized.language,
    availability: 'best-effort' as const, reason: GOOGLE_SUGGESTIONS_REASON,
  };
  return { feed: 'google-suggestions', query: normalized.keyword, suggestions, fetchedAt, sourceUrl, source };
};

export const parseGoogleSuggestionsResponse = (response: PublicFeedResponse, request: PublicFeedRequest): GoogleSuggestionsResult => {
  if (response.status !== 'ok' || response.body === null) throw new Error(response.error || 'Google Suggestions response is unavailable');
  return parseGoogleSuggestions(response.body, request, response.sourceUrl, response.fetchedAt);
};
