import { useEffect, useMemo, useState } from 'react';
import { buildAioReport, readAioHistory, recordAioSnapshot, validAioProject, type AioReport, type AioSnapshot } from '@/services/aioReadiness';
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
    setHistory(recordAioSnapshot(projectId, report, run.id).entries);
    // One snapshot per run: dedupe by run id lives in the history store.
  }, [report, run?.id, projectId]);

  return { report, history };
};
