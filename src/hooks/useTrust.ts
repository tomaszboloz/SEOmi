import { useEffect, useMemo, useState } from 'react';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildTrustReport, comparableTrustSnapshots, readTrustHistory, recordTrust, type ProfileEvidence, type TrustReport, type TrustSnapshot } from '@/services/eeatTrust';
import { hasVerifiedTrustEvidence } from '@/services/eeatTrust/history';
import { monitorScoreDrop } from '@/services/monitoringAlerts';
import { projectFocusOptions } from '@/services/siteFocusMonitoring/projectReport';
import { useFocusConfigRevision } from '@/hooks/useFocusConfigRevision';

export interface TrustState { report: TrustReport | null; previous: TrustSnapshot | undefined }

/** E-E-A-T trust report for a crawl; the Site Focus report (manual topic applied) supplies the Core Topic. One history snapshot per saved run. */
export const useTrust = (pages: CrawledPageSummary[], startUrl: string, run: CrawlRunRecord | null | undefined, projectId: string | null | undefined, profileEvidence?: Record<string, ProfileEvidence>): TrustState => {
  const [history, setHistory] = useState(() => readTrustHistory(projectId));
  const focusRevision = useFocusConfigRevision(projectId);
  const report = useMemo(() => {
    if (!pages.length) return null;
    const focus = buildSiteFocusReport(pages, startUrl, { ...projectFocusOptions(projectId), now: run?.completedAt });
    return buildTrustReport(pages, focus, { now: run?.completedAt, profileEvidence });
    // focusRevision: a saved topic/goal/anchor/brand change rebuilds EETV on the new Core Topic (#82).
  }, [pages, startUrl, projectId, run?.completedAt, profileEvidence, focusRevision]);

  useEffect(() => { setHistory((current) => { const next = readTrustHistory(projectId); return JSON.stringify(current) === JSON.stringify(next) ? current : next; }); }, [projectId]);
  useEffect(() => {
    if (!report || report.score === null || report.availability === 'unavailable' || !run || !projectId) return;
    const before = readTrustHistory(projectId);
    const existing = before.find((item) => item.runId === run.id);
    // Registry results live only for the current view. Do not let a remount
    // without them overwrite a stronger verified snapshot for this run.
    if (existing && hasVerifiedTrustEvidence(existing) && !hasVerifiedTrustEvidence(report)) {
      setHistory((current) => JSON.stringify(current) === JSON.stringify(before) ? current : before);
      return;
    }
    const entries = recordTrust(projectId, report, run.id);
    setHistory((current) => JSON.stringify(current) === JSON.stringify(entries) ? current : entries);
    const previous = before.filter((item) => item.runId !== run.id).at(-1);
    if (!before.some((item) => item.runId === run.id) && comparableTrustSnapshots(previous, { ...report, score: report.score, runId: run.id, at: report.generatedAt })) void monitorScoreDrop(projectId, 'trust', previous, report, run.id).catch(() => undefined);
  }, [report, run?.id, projectId]);

  const candidate = [...history].reverse().find((item) => item.runId !== run?.id);
  const previous = candidate && report && report.score !== null && comparableTrustSnapshots(candidate, { ...report, score: report.score, runId: run?.id ?? '', at: report.generatedAt }) ? candidate : undefined;
  return { report, previous };
};
