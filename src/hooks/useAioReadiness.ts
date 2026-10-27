import { useEffect, useMemo, useState } from 'react';
import { buildAioReport, readAioHistory, recordAioSnapshot, validAioProject, type AioReport, type AioSnapshot } from '@/services/aioReadiness';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';

export interface AioState {
  report: AioReport;
  history: AioSnapshot[];
  comparableHistory: AioSnapshot[];
}

const profileKey = (profile: AioReport['profile'] | AioSnapshot['profile']): string | undefined => profile
  && [profile.id, profile.algorithmVersion, profile.configHash, profile.language, profile.market].join('|');

const sameHistory = (left: AioSnapshot[], right: AioSnapshot[]): boolean => left.length === right.length
  && left.every((item, index) => item.runId === right[index]?.runId && item.at === right[index]?.at && item.score === right[index]?.score && profileKey(item.profile) === profileKey(right[index]?.profile));

/** AI Overviews / RAG readiness of a crawl; one history snapshot is stored per completed run of a project. */
export const useAioReadiness = (pages: CrawledPageSummary[], run: CrawlRunRecord | null | undefined, projectId: string | null | undefined): AioState => {
  const report = useMemo(() => buildAioReport(pages), [pages]);
  const [history, setHistory] = useState<AioSnapshot[]>(() => readAioHistory(projectId));

  useEffect(() => {
    if (!run || !validAioProject(projectId)) {
      const next = readAioHistory(projectId);
      setHistory((current) => sameHistory(current, next) ? current : next);
      return;
    }
    const { entries } = recordAioSnapshot(projectId, report, run.id);
    setHistory((current) => sameHistory(current, entries) ? current : entries);
    // One snapshot per run: dedupe by run id lives in the history store.
  }, [report, run?.id, projectId]);

  const currentProfile = profileKey(report.profile);
  const comparableHistory = history.filter((item) => profileKey(item.profile) === currentProfile);
  return { report, history: comparableHistory, comparableHistory };
};
