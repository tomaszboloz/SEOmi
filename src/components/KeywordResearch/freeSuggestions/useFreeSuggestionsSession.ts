import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchFreeSuggestions, type GoogleSuggestionsResult } from '@/services/freeSuggestions';
import { MAX_FREE_KEYWORD_LENGTH } from '@/services/freeSerp';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';
import type { SavedKeywordProvenance } from '@/types';

export interface FreeSuggestionsSessionError { status: 'blocked' | 'error'; message: string }
interface SavedKeyword { keyword: string }
interface Options {
  projectId: string | null;
  query: string;
  geo: string;
  language: string;
  savedKeywords: SavedKeyword[];
  onSave: (keyword: string, provenance?: SavedKeywordProvenance) => void;
}

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
const sameKeyword = (left: string, right: string): boolean => left.trim().toLowerCase() === right.trim().toLowerCase();

export const useFreeSuggestionsSession = ({ projectId, query, geo, language, savedKeywords, onSave }: Options) => {
  const [inputQuery, setInputQuery] = useState(query);
  const [result, setResult] = useState<GoogleSuggestionsResult | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<FreeSuggestionsSessionError | null>(null);
  const ownerKey = JSON.stringify([projectId, inputQuery, geo, language]);
  const beginOperation = useAsyncOperationScope(ownerKey);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => setInputQuery(query), [query]);
  useLayoutEffect(() => { setFetching(false); setError(null); setResult(null); }, [ownerKey]);

  const cancel = useCallback(() => {
    beginOperation('google-suggestions'); setFetching(false); setError(null);
  }, [beginOperation]);

  const fetchSuggestions = useCallback(async () => {
    const normalized = inputQuery.trim();
    if (!projectId || !normalized) return;
    if (new TextEncoder().encode(normalized).byteLength > MAX_FREE_KEYWORD_LENGTH) {
      setError({ status: 'error', message: 'Google Suggestions keyword is too long' });
      return;
    }
    const current = beginOperation('google-suggestions');
    setFetching(true); setError(null); setResult(null);
    try {
      const outcome = await fetchFreeSuggestions({ feed: 'google-suggestions', geo, keyword: normalized, language });
      if (!current()) return;
      if (outcome.status !== 'ok' || !outcome.result) setError({ status: outcome.status, message: outcome.response.error || 'Google Suggestions unavailable' });
      else setResult(outcome.result);
    } catch (caught) {
      if (current()) setError({ status: 'error', message: messageOf(caught) });
    } finally { if (current()) setFetching(false); }
  }, [beginOperation, geo, inputQuery, language, projectId]);

  const saveSuggestion = useCallback((keyword: string) => {
    if (!projectId || savedKeywords.some((item) => sameKeyword(item.keyword, keyword))) return;
    const source = result?.source;
    saveRef.current(keyword, source ? { ...source, retrievedAt: result.fetchedAt } : undefined);
  }, [projectId, result, savedKeywords]);

  const isSaved = useCallback((keyword: string) => savedKeywords.some((item) => sameKeyword(item.keyword, keyword)), [savedKeywords]);
  return { inputQuery, setInputQuery, result, fetching, error, fetchSuggestions, cancel, saveSuggestion, isSaved };
};
