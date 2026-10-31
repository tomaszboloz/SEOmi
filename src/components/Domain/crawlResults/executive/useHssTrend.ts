import { useEffect, useState } from 'react';
import { hssTrend, loadHssHistory, recordHssRun, type HssReport, type HssTrend } from '@/services/hss';

/**
 * Saves the HSS of a saved crawl run once per run (idempotent) and returns the trend against the
 * previous comparable run (#72 history, #73 per-card trend). Unsaved runs only read history.
 */
export const useHssTrend = (projectId: string | null | undefined, hss: HssReport, generatedAt: string | null | undefined): HssTrend | null => {
  const [trend, setTrend] = useState<HssTrend | null>(null);
  useEffect(() => {
    if (!projectId || !generatedAt) { setTrend(null); return; }
    const history = hss.runId === 'unsaved' ? loadHssHistory(projectId) : recordHssRun(projectId, hss, generatedAt);
    setTrend(hssTrend(hss, history, generatedAt));
  }, [projectId, hss, generatedAt]);
  return trend;
};
