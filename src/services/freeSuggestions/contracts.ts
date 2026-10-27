export const MAX_GOOGLE_SUGGESTIONS = 100;
export const MAX_GOOGLE_SUGGESTION_LENGTH = 500;
export const GOOGLE_SUGGESTIONS_TAG = 'Google Suggest';

export interface GoogleSuggestionsSource {
  kind: 'google-suggest-unofficial';
  provider: 'Google Suggest';
  sourceUrl: string;
  requestedGeo: string;
  requestedLanguage: string;
  availability: 'best-effort';
  reason: string;
}

export interface GoogleSuggestionsResult {
  feed: 'google-suggestions';
  query: string;
  suggestions: string[];
  fetchedAt: string;
  sourceUrl: string;
  source: GoogleSuggestionsSource;
}
