import type { AioReport } from './types';

export interface AioLanguageStatusGroups {
  /** Languages scored with basic, not native-reviewed word lists (#108). */
  uncertain: string[];
  /** Languages without rules; English word lists were applied as a fallback. */
  unsupported: string[];
}

/**
 * Groups the languages of scored pages by rule status, so the UI can say which results are uncertain
 * and which used a fallback instead of folding both into one "basic" label. Skipped pages are left out
 * because they carry no score. Returns undefined for reports stored before pages recorded a status.
 */
export const aioLanguageStatusGroups = (report: Pick<AioReport, 'pages'>): AioLanguageStatusGroups | undefined => {
  const scored = (report.pages ?? []).filter((page) => !page.skipped);
  if (!scored.some((page) => page.languageStatus)) return undefined;
  const pick = (status: 'uncertain' | 'unsupported'): string[] => (
    [...new Set(scored.filter((page) => page.languageStatus === status).map((page) => page.language || 'und'))].sort()
  );
  return { uncertain: pick('uncertain'), unsupported: pick('unsupported') };
};
