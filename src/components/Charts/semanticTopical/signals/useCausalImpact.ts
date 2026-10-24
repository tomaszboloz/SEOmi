import { useEffect, useMemo, useReducer, useState } from 'react';
import { fetchGoogleSearchUpdateWindows, fetchSerpVolatility, type MarketSourceResult } from '@/services/causalMarket/source';
import { gscSnapshotStorageKey } from '@/services/gscTracker/limits';
import { experimentsKey, listInterventions } from '@/services/experiments/registry';
import { readGscSnapshots } from '@/services/gscTracker/read';
import { readStoredCausalImpact } from '@/services/causalMarket/adapter';

const emptyMarket = (): MarketSourceResult => ({ status: 'unknown', source: 'dataforseo-serp-volatility', observations: [] });

export const useCausalImpact = (projectId: string | null, testSiteUrl?: string) => {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  const [market, setMarket] = useState<MarketSourceResult | null>(null);
  const [updateWindows, setUpdateWindows] = useState<Awaited<ReturnType<typeof fetchGoogleSearchUpdateWindows>> | null>(null);

  useEffect(() => {
    if (!projectId) return undefined;
    const update = (event: StorageEvent) => {
      if (event.key === null || event.key === gscSnapshotStorageKey(projectId) || event.key === experimentsKey(projectId)) refresh();
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [projectId]);

  useEffect(() => {
    let active = true;
    if (!projectId) {
      setMarket(null);
      setUpdateWindows(null);
      return () => { active = false; };
    }
    if (!readGscSnapshots(projectId).length || !listInterventions(projectId).length) {
      setMarket(null);
      setUpdateWindows(null);
      return () => { active = false; };
    }
    void Promise.all([fetchSerpVolatility(), fetchGoogleSearchUpdateWindows()]).then(([nextMarket, nextWindows]) => {
      if (!active) return;
      setMarket(nextMarket);
      setUpdateWindows(nextWindows);
    });
    return () => { active = false; };
  }, [projectId, revision]);

  const evidence = market ?? emptyMarket();
  return useMemo(() => readStoredCausalImpact(projectId, evidence, updateWindows?.windows ?? [], testSiteUrl), [projectId, evidence, updateWindows, testSiteUrl]);
};
