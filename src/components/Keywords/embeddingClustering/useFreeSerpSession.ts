import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { fetchFreeSerp } from '@/services/freeSerp';
import type { FreeSerpResult } from '@/services/freeSerp';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';

export interface FreeSerpSessionError { status: 'blocked' | 'error'; message: string }
interface Options {
  projectId: string | null; keyword: string; country: string; language: string; importedAt: string | null;
  onImport: (payload: string) => void;
}

const serialize = (result: FreeSerpResult): string => JSON.stringify({
  metadata: { ...result.source, kind: result.source.kind }, records: result.records,
});

export const useFreeSerpSession = ({ projectId, keyword, country, language, importedAt, onImport }: Options) => {
  const ownerKey = JSON.stringify([projectId, keyword, country, language, importedAt]);
  const beginOperation = useAsyncOperationScope(ownerKey);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<FreeSerpSessionError | null>(null);
  const importRef = useRef(onImport);
  importRef.current = onImport;
  useLayoutEffect(() => { setFetching(false); setError(null); }, [ownerKey]);

  const cancel = useCallback(() => {
    beginOperation('bing-serp'); setFetching(false); setError(null);
  }, [beginOperation]);
  const fetchBing = useCallback(async () => {
    if (!projectId || !keyword.trim()) return;
    const current = beginOperation('bing-serp');
    setFetching(true); setError(null);
    try {
      const outcome = await fetchFreeSerp({ feed: 'bing-serp', geo: country, keyword, language });
      if (!current()) return;
      if (outcome.status !== 'ok' || !outcome.result) setError({ status: outcome.status, message: outcome.response.error || 'Public feed unavailable' });
      else importRef.current(serialize(outcome.result));
    } catch (caught) {
      if (current()) setError({ status: 'error', message: caught instanceof Error ? caught.message : String(caught) });
    } finally { if (current()) setFetching(false); }
  }, [beginOperation, country, keyword, language, projectId]);
  return { fetching, error, fetchBing, cancel };
};
