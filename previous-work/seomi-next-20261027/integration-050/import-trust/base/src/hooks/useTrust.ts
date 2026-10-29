import { useEffect, useMemo, useState } from 'react';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildTrustReport, readTrustHistory, recordTrust, type TrustReport, type TrustSnapshot } from '@/services/eeatTrust';
import { monitorScoreDrop } from '@/services/monitoringAlerts';
import { readManualTopic } from '@/services/siteFocusMonitoring/topic';

export interface TrustState { report: TrustReport | null; previous: TrustSnapshot | undefined }

/** E-E-A-T trust report for a crawl; the Site Focus report (manual topic applied) supplies the Core Topic. One history snapshot per saved run. */
export const useTrust = (pages: CrawledPageSummary[], startUrl: string, run: CrawlRunRecord | null | undefined, projectId: string | null | undefined): TrustState => {
  const [history, setHistory] = useState(() => readTrustHistory(projectId));
  const report = useMemo(() => {
    if (!pages.length) return null;
    const focus = buildSiteFocusReport(pages, startUrl, { manualTopic: readManualTopic(projectId), now: run?.completedAt });
    return buildTrustReport(pages, focus, { now: run?.completedAt });
  }, [pages, startUrl, projectId, run?.completedAt]);

  useEffect(() => { setHistory(readTrustHistory(projectId)); }, [projectId]);
  useEffect(() => {
    if (!report || !run || !projectId) return;
    const before = readTrustHistory(projectId);
    const entries = recordTrust(projectId, report, run.id);
    setHistory(entries);
    const previous = before.filter((item) => item.runId !== run.id).at(-1);
    if (!before.some((item) => item.runId === run.id)) void monitorScoreDrop(projectId, 'trust', previous, report, run.id).catch(() => undefined);
  }, [report, run?.id, projectId]);

  const previous = [...history].reverse().find((item) => item.runId !== run?.id);
  return { report, previous };
};
