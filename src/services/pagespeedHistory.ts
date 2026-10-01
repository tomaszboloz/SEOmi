import type { CruxReport, PageSpeedReport, PageSpeedStrategy } from '@/services/pagespeed';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { createId } from '@/services/ids';
import i18n from '@/i18n';

export const MAX_PAGESPEED_SNAPSHOTS = 24;

export interface PageSpeedSnapshot {
  id: string;
  capturedAt: string;
  url: string;
  strategy: PageSpeedStrategy;
  formFactor: CruxReport['formFactor'];
  scope: CruxReport['scope'];
  pageSpeed: PageSpeedReport | null;
  crux: CruxReport | null;
}

export interface PageSpeedSnapshotInput {
  url: string;
  strategy: PageSpeedStrategy;
  formFactor: CruxReport['formFactor'];
  scope: CruxReport['scope'];
  pageSpeed?: PageSpeedReport | null;
  crux?: CruxReport | null;
  capturedAt?: string;
}

export interface PageSpeedComparison {
  baseline: PageSpeedSnapshot;
  current: PageSpeedSnapshot;
  categoryDeltas: Array<{ key: keyof PageSpeedReport['categories']; baseline: number | null; current: number | null; delta: number | null }>;
  metricDeltas: Array<{ id: string; baseline: number | null; current: number | null; delta: number | null }>;
  cruxDeltas: Array<{ id: string; baseline: number | null; current: number | null; delta: number | null }>;
}

const storageKey = (projectId: string) => `seomi_project_${projectId}_pagespeed_history_v1`;
const validStrategies: PageSpeedStrategy[] = ['mobile', 'desktop'];
const validFormFactors: CruxReport['formFactor'][] = ['PHONE', 'DESKTOP', 'TABLET'];
const validScopes: CruxReport['scope'][] = ['url', 'origin'];

const validDate = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
};

const validReport = (value: unknown): PageSpeedReport | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as PageSpeedReport;
  return typeof report.requestedUrl === 'string' && typeof report.strategy === 'string' ? report : null;
};

const validCrux = (value: unknown): CruxReport | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as CruxReport;
  return typeof report.target === 'string' && typeof report.scope === 'string' ? report : null;
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

export const readPageSpeedSnapshots = (projectId: string | null): PageSpeedSnapshot[] => {
  if (!projectId) return [];
  return normalizePageSpeedSnapshots(readJsonStorage(storageKey(projectId), []));
};

const makeSnapshotId = (_capturedAt: string) => createId('pagespeed');

export const createPageSpeedSnapshot = (input: PageSpeedSnapshotInput): PageSpeedSnapshot => {
  const capturedAt = input.capturedAt || new Date().toISOString();
  return {
    id: makeSnapshotId(capturedAt),
    capturedAt,
    url: input.url.trim(),
    strategy: input.strategy,
    formFactor: input.formFactor,
    scope: input.scope,
    pageSpeed: input.pageSpeed || null,
    crux: input.crux || null,
  };
};

export const savePageSpeedSnapshot = (projectId: string | null, snapshot: PageSpeedSnapshot, existing?: PageSpeedSnapshot[]): PageSpeedSnapshot[] => {
  if (!projectId) return existing || [];
  const next = normalizePageSpeedSnapshots([snapshot, ...(existing || readPageSpeedSnapshots(projectId))]);
  writeJsonStorage(storageKey(projectId), next);
  return next;
};

export const clearPageSpeedSnapshots = (projectId: string | null): void => {
  if (!projectId) return;
  writeJsonStorage(storageKey(projectId), []);
};

const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const categoryKeys: Array<keyof PageSpeedReport['categories']> = ['performance', 'accessibility', 'bestPractices', 'seo'];
const metricIds = ['first-contentful-paint', 'largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'speed-index', 'interactive'];
const cruxMetricIds = ['largest_contentful_paint', 'interaction_to_next_paint', 'cumulative_layout_shift', 'first_contentful_paint', 'experimental_time_to_first_byte'];

const psiMetricValue = (snapshot: PageSpeedSnapshot, id: string): number | null => numeric(snapshot.pageSpeed?.metrics?.[id]?.numericValue);
const cruxMetricValue = (snapshot: PageSpeedSnapshot, id: string): number | null => {
  const metrics = (snapshot.crux?.response as Record<string, unknown> | undefined)?.record as Record<string, unknown> | undefined;
  const metric = metrics?.metrics && typeof metrics.metrics === 'object' ? (metrics.metrics as Record<string, unknown>)[id] : null;
  return metric && typeof metric === 'object' ? numeric((metric as Record<string, unknown>).percentiles && ((metric as Record<string, unknown>).percentiles as Record<string, unknown>).p75) : null;
};

const delta = (baseline: number | null, current: number | null) => baseline === null || current === null ? null : current - baseline;

export const comparePageSpeedSnapshots = (baseline: PageSpeedSnapshot, current: PageSpeedSnapshot): PageSpeedComparison => ({
  baseline,
  current,
  categoryDeltas: categoryKeys.map((key) => {
    const baselineValue = numeric(baseline.pageSpeed?.categories?.[key]);
    const currentValue = numeric(current.pageSpeed?.categories?.[key]);
    return { key, baseline: baselineValue, current: currentValue, delta: delta(baselineValue, currentValue) };
  }),
  metricDeltas: metricIds.map((id) => {
    const baselineValue = psiMetricValue(baseline, id);
    const currentValue = psiMetricValue(current, id);
    return { id, baseline: baselineValue, current: currentValue, delta: delta(baselineValue, currentValue) };
  }),
  cruxDeltas: cruxMetricIds.map((id) => {
    const baselineValue = cruxMetricValue(baseline, id);
    const currentValue = cruxMetricValue(current, id);
    return { id, baseline: baselineValue, current: currentValue, delta: delta(baselineValue, currentValue) };
  }),
});

export const pageSpeedHistoryStorageKey = storageKey;

const csvCell = (value: unknown): string => {
  const text = String(value ?? '');
  const safe = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

/** Export only values already present in local project snapshots. No API call is made. */
export const pageSpeedHistoryCsv = (snapshots: PageSpeedSnapshot[]): string => {
  const rows: unknown[][] = [[
    i18n.t('pageSpeedUi.csv.capturedAt'),
    i18n.t('pageSpeedUi.url'),
    i18n.t('pageSpeedUi.csv.strategy'),
    i18n.t('pageSpeedUi.csv.cruxFormFactor'),
    i18n.t('pageSpeedUi.cruxScope'),
    i18n.t('pageSpeedUi.categories.performance'),
    i18n.t('pageSpeedUi.categories.accessibility'),
    i18n.t('pageSpeedUi.categories.bestPractices'),
    i18n.t('pageSpeedUi.categories.seo'),
    i18n.t('pageSpeedUi.source'),
  ]];
  snapshots.forEach((snapshot) => rows.push([
    snapshot.capturedAt,
    snapshot.url,
    snapshot.strategy,
    snapshot.formFactor,
    snapshot.scope,
    snapshot.pageSpeed?.categories.performance ?? '',
    snapshot.pageSpeed?.categories.accessibility ?? '',
    snapshot.pageSpeed?.categories.bestPractices ?? '',
    snapshot.pageSpeed?.categories.seo ?? '',
    [snapshot.pageSpeed ? 'PageSpeed' : '', snapshot.crux ? 'CrUX' : ''].filter(Boolean).join(' + '),
  ]));
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
};
