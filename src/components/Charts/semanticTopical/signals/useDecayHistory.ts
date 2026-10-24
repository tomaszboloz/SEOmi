import { useEffect, useMemo, useReducer } from 'react';
import { evaluateDecay } from '@/services/semanticDecay/alert';
import { decayStorageKey, loadSerpHistory, markSerpAlert, SERP_HISTORY_EVENT } from '@/services/semanticDecay/snapshotStore';

export const useDecayHistory = (projectId: string | null) => {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    const update = (event: Event) => {
      const key = event instanceof StorageEvent ? event.key : (event as CustomEvent<string>).detail;
      if (projectId && (key === null || key === decayStorageKey(projectId))) refresh();
    };
    window.addEventListener(SERP_HISTORY_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(SERP_HISTORY_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, [projectId]);
  const history = useMemo(() => loadSerpHistory(projectId), [projectId, revision]);
  const now = useMemo(() => new Date().toISOString(), [history]);
  const evaluation = useMemo(() => evaluateDecay(history.snapshots, history.lastAlertAt, now), [history, now]);
  useEffect(() => {
    if (evaluation.verdict === 'alert') markSerpAlert(projectId, history.snapshots[0], now);
  }, [projectId, history, evaluation, now]);
  return { evaluation, snapshotCount: history.snapshots.length };
};
