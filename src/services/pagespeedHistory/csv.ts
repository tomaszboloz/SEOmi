import i18n from '@/i18n';
import { PageSpeedSnapshot } from "./contracts";

export const csvCell = (value: unknown): string => {
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
