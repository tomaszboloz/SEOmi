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

const emptyMarket = (): MarketSourceResult => ({ status: 'unknown', source: 'dataforseo-serp-volatility', observations: [] });

interface EvidenceState {
  projectId: string | null;
  market: MarketSourceResult | null;
  updateWindows: UpdateWindowSourceResult | null;
}

export const useCausalImpact = (projectId: string | null, testSiteUrl?: string) => {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  const [state, setState] = useState<EvidenceState>({ projectId: null, market: null, updateWindows: null });

  useEffect(() => {
    installCausalStorageInterceptor();
  }, []);

  useEffect(() => {
    if (!projectId) return undefined;
    const gscKey = gscSnapshotStorageKey(projectId);
    const expKey = experimentsKey(projectId);
    const matches = (key: string | null) => key === null || key === gscKey || key === expKey;

    const onStorage = (event: StorageEvent) => { if (matches(event.key)) refresh(); };
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
    if (!projectId || !readGscSnapshots(projectId).length || !listInterventions(projectId).length) {
      setState({ projectId, market: null, updateWindows: null });
      return () => { active = false; };
    }
    void Promise.all([fetchSerpVolatility(), fetchGoogleSearchUpdateWindows()]).then(([nextMarket, nextWindows]) => {
      if (!active) return;
      setState({ projectId, market: nextMarket, updateWindows: nextWindows });
    });
    return () => { active = false; };
  }, [projectId, revision]);

  const isCurrent = Boolean(projectId && state.projectId === projectId);
  const activeMarket = isCurrent ? state.market : null;
  const activeWindows = isCurrent ? state.updateWindows : null;
  const evidence = activeMarket ?? emptyMarket();

  return useMemo(
    () => readStoredCausalImpact(projectId, evidence, activeWindows, testSiteUrl),
    [projectId, evidence, activeWindows, testSiteUrl, revision],
  );
};
