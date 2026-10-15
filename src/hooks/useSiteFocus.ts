import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CrawlRunRecord } from '@/types';
import type { FocusPage, HistoryAnnotation, PageFocus, SfsSnapshot, SiteFocusReport } from '@/services/siteFocus';
import {
  annotationsByRun, applyIncremental, buildRunReport, consumeRecompute, isCompletedRun, readFocusHistory, readManualTopic,
  readRecomputeBudget, recordFullAnalysis, validFocusProject, writeManualTopic, type Clock, type ManualTopic, type RecomputeBudget,
} from '@/services/siteFocusMonitoring';

export interface UseSiteFocusOptions { clock?: Clock }
export interface SiteFocusState {
  report: SiteFocusReport | null;
  history: SfsSnapshot[];
  annotations: Record<string, HistoryAnnotation[]>;
  recomputeBudget: RecomputeBudget;
  manualTopic: ManualTopic | undefined;
  recompute: () => { ok: boolean; budget: RecomputeBudget };
  setManualTopic: (topic: ManualTopic | null) => void;
  incrementalUpdate: (newPages: FocusPage[]) => PageFocus[];
}

/** Site Focus Score for a crawl run: report (manual topic applied), snapshot history, recompute budget. */
export const useSiteFocus = (run: CrawlRunRecord | null | undefined, projectId: string | null | undefined, options: UseSiteFocusOptions = {}): SiteFocusState => {
  const clock = options.clock ?? Date.now;
  const [manualTopic, setTopic] = useState<ManualTopic | undefined>(() => readManualTopic(projectId));
  const [entries, setEntries] = useState(() => readFocusHistory(projectId));
  const [budget, setBudget] = useState(() => readRecomputeBudget(projectId, clock));
  const [override, setOverride] = useState<SiteFocusReport | null>(null);
  const [nonce, setNonce] = useState(0);
  const [scope, setScope] = useState({ projectId, runId: run?.id });

  if (scope.projectId !== projectId || scope.runId !== run?.id) {
    setScope({ projectId, runId: run?.id });
    setOverride(null);
    setTopic(readManualTopic(projectId));
    setEntries(readFocusHistory(projectId));
    setBudget(readRecomputeBudget(projectId, clock));
  }

  const base = useMemo(() => (isCompletedRun(run) ? buildRunReport(run, manualTopic) : null),
    // nonce forces a rebuild on explicit recompute; clock is read inside the callbacks.
    [run, manualTopic, nonce]);
  const report = override ?? base;

  useEffect(() => {
    if (!base || !run || !validFocusProject(projectId)) return;
    const saved = recordFullAnalysis(projectId, base, run.id, { clock });
    if (saved.saved) setEntries(saved.entries);
    // Snapshot once per run: dedupe by runId lives in the history store.
  }, [base?.generatedAt, run?.id, projectId]);

  const recompute = useCallback(() => {
    const spent = consumeRecompute(projectId, clock);
    setBudget(spent.budget);
    if (!spent.allowed || !run || !isCompletedRun(run) || !validFocusProject(projectId)) return { ok: false, budget: spent.budget };
    const fresh = buildRunReport(run, readManualTopic(projectId), new Date(clock()).toISOString());
    const saved = recordFullAnalysis(projectId, fresh, `${run.id}:manual:${clock()}`, { clock });
    setEntries(saved.entries);
    setOverride(null);
    setNonce((value) => value + 1);
    return { ok: true, budget: spent.budget };
  }, [projectId, run, clock]);

  const setManualTopic = useCallback((topic: ManualTopic | null) => {
    if (validFocusProject(projectId)) writeManualTopic(projectId, topic);
    setOverride(null);
    setTopic(validFocusProject(projectId) ? readManualTopic(projectId) : undefined);
  }, [projectId]);

  const incrementalUpdate = useCallback((newPages: FocusPage[]): PageFocus[] => {
    if (!report || !run) return [];
    const outcome = applyIncremental(projectId, report, newPages, run.startUrl, { clock });
    setOverride(outcome.report);
    return outcome.scored;
  }, [report, run, projectId, clock]);

  return {
    report, history: entries.map((entry) => entry.snapshot), annotations: annotationsByRun(entries),
    recomputeBudget: budget, manualTopic, recompute, setManualTopic, incrementalUpdate,
  };
};
