import { invokeTauriCommand } from '../tauri';
import { normalizeFreeRequest, type PublicFeedRequest, type PublicFeedResponse } from '../freeSerp/contracts';
import { googleSuggestionsFeedUrl } from '../freeSerp/urls';
import { fetchPublicFeed, type PublicFeedInvoker } from '../publicFeedTransport';
import { parseGoogleSuggestionsResponse } from './parser';
import type { GoogleSuggestionsResult } from './contracts';

export type FreeSuggestionsFetchOutcome =
  | { status: 'ok'; response: PublicFeedResponse; result: GoogleSuggestionsResult }
  | { status: 'blocked' | 'error'; response: PublicFeedResponse; result: null };

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
const errorResponse = (sourceUrl: string, error: unknown): PublicFeedResponse => ({
  status: 'error', sourceUrl, fetchedAt: new Date().toISOString(), body: null, httpStatus: null, error: messageOf(error),
});

export async function fetchFreeSuggestions(
  request: PublicFeedRequest,
  invoke: PublicFeedInvoker = invokeTauriCommand,
): Promise<FreeSuggestionsFetchOutcome> {
  if (request.feed !== 'google-suggestions') throw new Error('Free suggestions transport supports Google Suggestions only');
  const normalized = normalizeFreeRequest(request);
  const sourceUrl = googleSuggestionsFeedUrl(normalized.keyword, normalized.geo, normalized.language);
  try {
    const response = await fetchPublicFeed(normalized, invoke);
    if (response.status !== 'ok') return { status: response.status, response, result: null };
    try {
      return { status: 'ok', response, result: parseGoogleSuggestionsResponse(response, normalized) };
    } catch (error) {
      return { status: 'error', response: { ...response, status: 'error', body: null, error: messageOf(error) }, result: null };
    }
  } catch (error) {
    return { status: 'error', response: errorResponse(sourceUrl, error), result: null };
  }
}
