import { useEffect, useMemo, useState } from 'react';
import { buildAioReport, readAioHistory, recordAioSnapshot, validAioProject, type AioReport, type AioSnapshot } from '@/services/aioReadiness';
import { monitorScoreDrop } from '@/services/monitoringAlerts';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';

export interface AioState {
  report: AioReport;
  history: AioSnapshot[];
}

/** AI Overviews / RAG readiness of a crawl; one history snapshot is stored per completed run of a project. */
export const useAioReadiness = (pages: CrawledPageSummary[], run: CrawlRunRecord | null | undefined, projectId: string | null | undefined): AioState => {
  const report = useMemo(() => buildAioReport(pages), [pages]);
  const [history, setHistory] = useState<AioSnapshot[]>(() => readAioHistory(projectId));

  useEffect(() => {
    if (!run || !validAioProject(projectId)) {
      setHistory(readAioHistory(projectId));
      return;
    }
    const { saved, entries } = recordAioSnapshot(projectId, report, run.id);
    setHistory(entries);
    if (saved && entries.length > 1) void monitorScoreDrop(projectId, 'aio', entries[entries.length - 2], entries[entries.length - 1], run.id).catch(() => undefined);
    // One snapshot per run: dedupe by run id lives in the history store.
  }, [report, run?.id, projectId]);

  return { report, history };
};
