import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzePhraseIntent, type PhraseIntentReport } from '@/services/sija/phraseIntent';
import type { TopTenContentGapReport } from '@/services/targetPhraseAudit/types';
import { loadSijaHistory, recordSijaRun, type SijaHistoryEntry } from '@/services/sija/history';

/** Explicit, user-started SIJA run; a new TOP 10 report discards the previous result. */
export const usePhraseIntent = (report: TopTenContentGapReport | null, projectId: string | null = null, now: () => string = () => new Date().toISOString()) => {
  const [result, setResult] = useState<PhraseIntentReport | null>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [history, setHistory] = useState<SijaHistoryEntry[]>([]);
  const phrase = report?.phrase ?? '';
  const run = useRef(0);
  useEffect(() => { run.current += 1; setResult(null); setRunning(false); setFailed(false); setHistory(loadSijaHistory(projectId, phrase)); }, [report, projectId, phrase]);
  const targetUrl = report?.corpus?.target?.url ?? null;
  const topUrls = useMemo(() => report?.rows.filter((row) => row.availability === 'available').map((row) => row.finalUrl || row.url) ?? [], [report]);
  const canRun = Boolean(targetUrl) && topUrls.length > 0 && !running;
  const start = useCallback(async () => {
    if (!targetUrl) return;
    const id = ++run.current;
    setRunning(true); setFailed(false);
    try {
      const next = await analyzePhraseIntent(targetUrl, topUrls);
      if (id === run.current) { setResult(next); setHistory(recordSijaRun(projectId, phrase, next, now())); }
    } catch {
      if (id === run.current) setFailed(true);
    } finally {
      if (id === run.current) setRunning(false);
    }
  }, [targetUrl, topUrls, projectId, phrase, now]);
  return { result, running, failed, canRun, start, history };
};
