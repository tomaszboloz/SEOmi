import type { SiteFocusReport } from '@/services/siteFocus';
import { protectionRows, type ProtectionResult } from '@/services/urlProtection';

/** PDF rows for the URL protection check; advisory evidence only, nothing here is executed. */
export interface FocusPdfProtection {
  /** False when no GSC/GA4/backlink snapshot exists: every row then needs data. */
  telemetry: boolean;
  trs_threshold: number;
  pri_threshold: number;
  rows: Array<{
    url: string;
    trs: number;
    decision: ProtectionResult['decision'];
    pri: number | null;
    reasons: string[];
    evidence: Array<{ signal: string; state: string; value: number | null; currency?: string }>;
    advice: Array<{ code: string; conditions: string[] }>;
  }>;
}

export const summarizeProtection = (report: SiteFocusReport, projectId: string | null | undefined): FocusPdfProtection | undefined => {
  const { snapshot, rows } = protectionRows(report, projectId);
  const first = rows[0]?.result.parameters;
  if (!first) return undefined;
  return {
    telemetry: snapshot !== null,
    trs_threshold: first.trsThreshold,
    pri_threshold: first.priThreshold,
    rows: rows.map(({ url, trs, result }) => ({
      url, trs, decision: result.decision, pri: result.pri.pri, reasons: [...result.reasons],
      evidence: result.evidence.map(({ signal, state, value, currency }) => ({ signal, state, value, ...(currency ? { currency } : {}) })),
      advice: result.advice.map(({ code, conditions }) => ({ code, conditions: [...conditions] })),
    })),
  };
};
