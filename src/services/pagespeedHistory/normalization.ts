import type { CruxReport, PageSpeedReport, PageSpeedStrategy } from '@/services/pagespeed';

import { MAX_PAGESPEED_SNAPSHOTS, PageSpeedSnapshot } from "./contracts";

export const validStrategies: PageSpeedStrategy[] = ['mobile', 'desktop'];

export const validFormFactors: CruxReport['formFactor'][] = ['PHONE', 'DESKTOP', 'TABLET'];

export const validScopes: CruxReport['scope'][] = ['url', 'origin'];

export const validDate = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
};

export const validReport = (value: unknown): PageSpeedReport | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as PageSpeedReport;
  return typeof report.requestedUrl === 'string' && validStrategies.includes(report.strategy)
    && Boolean(report.categories) && typeof report.categories === 'object' && !Array.isArray(report.categories) ? report : null;
};

export const validCrux = (value: unknown): CruxReport | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as CruxReport;
  return typeof report.target === 'string' && validScopes.includes(report.scope)
    && validFormFactors.includes(report.formFactor) ? report : null;
};

export const normalizePageSpeedSnapshots = (value: unknown, now = new Date().toISOString()): PageSpeedSnapshot[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item, index) => {
      const pageSpeed = validReport(item.pageSpeed);
      const crux = validCrux(item.crux);
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `legacy-${index}`;
      return {
        id,
        capturedAt: validDate(item.capturedAt, now),
        url,
        strategy: validStrategies.includes(item.strategy as PageSpeedStrategy) ? item.strategy as PageSpeedStrategy : pageSpeed?.strategy || 'mobile',
        formFactor: validFormFactors.includes(item.formFactor as CruxReport['formFactor']) ? item.formFactor as CruxReport['formFactor'] : crux?.formFactor || 'PHONE',
        scope: validScopes.includes(item.scope as CruxReport['scope']) ? item.scope as CruxReport['scope'] : crux?.scope || 'url',
        pageSpeed,
        crux,
      } satisfies PageSpeedSnapshot;
    })
    .filter((item) => item.url.length > 0 && (item.pageSpeed !== null || item.crux !== null))
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .slice(0, MAX_PAGESPEED_SNAPSHOTS);
};
