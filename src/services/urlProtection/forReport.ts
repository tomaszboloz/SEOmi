import type { SiteFocusReport } from '@/services/siteFocus';
import { ensureUrlTelemetry, type UrlTelemetry, type UrlTelemetrySnapshot } from '@/services/urlTelemetry';
import { decideProtection, DEFAULT_TRS_THRESHOLD, type ProtectionResult } from './decide';
import { logVisitEvidence } from './logEvidence';

export const MAX_PROTECTION_ROWS = 20;
const NONE = { state: 'unavailable', value: null } as const;
const keyOf = (url: string): string => url.replace(/\/+$/, '');

export interface ProtectionRows {
  /** Shared telemetry snapshot; null means no source, so every row needs data. */
  snapshot: UrlTelemetrySnapshot | null;
  rows: Array<{ url: string; trs: number; result: ProtectionResult }>;
}

/**
 * Advisory PRI guardrail for scored pages below the TRS threshold, in report order, so the app
 * and the PDF list the same URLs. Missing telemetry is never zero.
 */
export const protectionRows = (report: SiteFocusReport, projectId: string | null | undefined, limit = MAX_PROTECTION_ROWS): ProtectionRows => {
  const low = report.pages.filter((page) => !page.skipped && page.trs < DEFAULT_TRS_THRESHOLD);
  const snapshot = projectId ? ensureUrlTelemetry(projectId, report.pages.map((page) => page.url)) : null;
  const byUrl = new Map((snapshot?.urls ?? []).map((row) => [keyOf(row.url), row]));
  const visits = logVisitEvidence(projectId);
  const rows = low.slice(0, limit).map((page) => {
    const telemetry: UrlTelemetry = byUrl.get(keyOf(page.url)) ?? { url: page.url, gsc: NONE, ga4: NONE, backlinks: NONE, revenue: NONE };
    const result = decideProtection(page.trs, telemetry);
    // Log visits enrich the evidence but never change the decision (#81 GEM-81-08).
    return { url: page.url, trs: page.trs, result: { ...result, evidence: [...result.evidence, visits(page.url)] } };
  });
  return { snapshot, rows };
};
