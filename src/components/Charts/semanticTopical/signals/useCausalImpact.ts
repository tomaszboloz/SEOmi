import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  fetchGoogleSearchUpdateWindows,
  fetchSerpVolatility,
  type MarketSourceResult,
  type UpdateWindowSourceResult,
} from '@/services/causalMarket/source';
import { gscSnapshotStorageKey } from '@/services/gscTracker/limits';
import { experimentsKey, listInterventions } from '@/services/experiments/registry';
import { readGscSnapshots } from '@/services/gscTracker/read';
import { readStoredCausalImpact } from '@/services/causalMarket/adapter';
import { CAUSAL_STORAGE_EVENT, installCausalStorageInterceptor } from '@/services/causalMarket/storageEvents';
import { normalizedFilters } from '@/services/gscTracker/filters';
import type { GscPerformanceFilters } from '@/types';

const emptyMarket = (): MarketSourceResult => ({ status: 'unknown', source: 'dataforseo-serp-volatility', observations: [] });

interface EvidenceState {
  projectId: string | null;
  scopeKey: string;
  market: MarketSourceResult | null;
  updateWindows: UpdateWindowSourceResult | null;
}

export const useCausalImpact = (projectId: string | null, testSiteUrl?: string, testFilters?: GscPerformanceFilters, gscScopeReady = true, exactProperty = false) => {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  const scopeKey = JSON.stringify([testSiteUrl?.trim() ?? '', normalizedFilters(testFilters)]);
  const [state, setState] = useState<EvidenceState>({ projectId: null, scopeKey: '', market: null, updateWindows: null });

  useEffect(() => {
    installCausalStorageInterceptor();
  }, []);

  useEffect(() => {
    if (!projectId) return undefined;
    const gscKey = gscSnapshotStorageKey(projectId);
    const expKey = experimentsKey(projectId);
    const matches = (key: string | null) => key === null || key === gscKey || key === expKey;

    const onStorage = (event: StorageEvent) => {
      if (event.storageArea && typeof window !== 'undefined' && event.storageArea !== window.localStorage) return;
      if (matches(event.key)) refresh();
    };
    const onLocal = (event: Event) => {
      const key = (event as CustomEvent<{ key: string | null }>).detail?.key ?? null;
      if (matches(key)) refresh();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(CAUSAL_STORAGE_EVENT, onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CAUSAL_STORAGE_EVENT, onLocal);
    };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    if (!gscScopeReady || !projectId || !readGscSnapshots(projectId).length || !listInterventions(projectId).length) {
      setState({ projectId, scopeKey, market: null, updateWindows: null });
      return () => { active = false; };
    }
    void Promise.all([fetchSerpVolatility(), fetchGoogleSearchUpdateWindows()]).then(([nextMarket, nextWindows]) => {
      if (!active) return;
      setState({ projectId, scopeKey, market: nextMarket, updateWindows: nextWindows });
    });
    return () => { active = false; };
  }, [projectId, revision, scopeKey, gscScopeReady]);

  const isCurrent = Boolean(projectId && state.projectId === projectId && state.scopeKey === scopeKey);
  const activeMarket = isCurrent ? state.market : null;
  const activeWindows = isCurrent ? state.updateWindows : null;
  const evidence = activeMarket ?? emptyMarket();

  return useMemo(
    () => gscScopeReady ? readStoredCausalImpact(projectId, evidence, activeWindows, testSiteUrl, testFilters, exactProperty) : null,
    [projectId, evidence, activeWindows, scopeKey, testSiteUrl, testFilters, revision, gscScopeReady, exactProperty],
  );
};
