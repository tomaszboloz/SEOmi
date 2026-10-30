import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';
import { ensureUrlTelemetry, type UrlTelemetry, type UrlTelemetrySnapshot } from '@/services/urlTelemetry';
import { decideProtection, DEFAULT_TRS_THRESHOLD, type ProtectionResult } from './decide';
import { logVisitEvidence } from './logEvidence';

export const MAX_PROTECTION_ROWS = 20;
/** Core Topic terms a page must already use, each at least twice, to count as related to the Core (#81 GEM-81-06). */
export const BRIDGE_MIN_CORE_TERMS = 3;
const BRIDGE_MIN_COUNT = 2;

/**
 * A real thread to the Core: the page already uses several Core terms more than in passing. Only then
 * may a measured low-value page be offered as a semantic bridge instead of a pruning review. SEOmi
 * adaptation; the threshold is part of decision D-PRI (#83) and is not a calibrated value.
 */
export const relatedToCore = (page: Pick<PageFocus, 'keywordsFound'>): boolean =>
  page.keywordsFound.filter((keyword) => keyword.count >= BRIDGE_MIN_COUNT).length >= BRIDGE_MIN_CORE_TERMS;
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
    const result = decideProtection(page.trs, telemetry, { relatedToCore: relatedToCore(page) });
    // Log visits enrich the evidence but never change the decision (#81 GEM-81-08).
    return { url: page.url, trs: page.trs, result: { ...result, evidence: [...result.evidence, visits(page.url)] } };
  });
  return { snapshot, rows };
};
