import { useMemo } from 'react';
import type { Ga4JoinedRow } from '@/types/ga4';
import { PagedTable, type PagedColumn } from '../PagedTable';
import { usePagedRows } from '../usePagedRows';
import type { Ga4Rows, Ga4T } from './viewTypes';

interface Props { rows: Ga4Rows; t: Ga4T; }
const value = (number: number | undefined, t: Ga4T): string => number === undefined ? t('ga4.unknown') : number.toLocaleString();
/** Unknown metrics sort below every measured value, never as zero. */
const sortable = (number: number | undefined): number => number ?? Number.NEGATIVE_INFINITY;

const SORT: Record<string, (row: Ga4JoinedRow) => string | number> = {
  landingPage: (row) => row.landing_page,
  host: (row) => row.host_name,
  sessions: (row) => sortable(row.sessions),
  engagedSessions: (row) => sortable(row.engaged_sessions),
  keyEvents: (row) => sortable(row.key_events),
  clicks: (row) => sortable(row.gsc?.clicks),
  impressions: (row) => sortable(row.gsc?.impressions),
  issues: (row) => sortable(row.crawl_issue_count),
};

/** Landing pages one page at a time (25-250 rows), sortable by every column; sessions first. */
export function Ga4ReportTable({ rows, t }: Props) {
  const paged = usePagedRows(rows, SORT, 'sessions');
  const columns = useMemo((): PagedColumn<Ga4JoinedRow>[] => [
    { key: 'landingPage', label: t('ga4.landingPage'), cellClassName: 'max-w-[320px] truncate text-sky-200', cell: (row) => <span title={row.landing_page}>{row.landing_page}</span> },
    { key: 'host', label: t('ga4.host'), cell: (row) => row.host_name },
    { key: 'sessions', label: t('ga4.sessions'), align: 'right', cell: (row) => value(row.sessions, t) },
    { key: 'engagedSessions', label: t('ga4.engagedSessions'), align: 'right', cell: (row) => value(row.engaged_sessions, t) },
    { key: 'keyEvents', label: t('ga4.keyEvents'), align: 'right', cell: (row) => value(row.key_events, t) },
    { key: 'clicks', label: t('ga4.clicks'), align: 'right', cell: (row) => value(row.gsc?.clicks, t) },
    { key: 'impressions', label: t('ga4.impressions'), align: 'right', cell: (row) => value(row.gsc?.impressions, t) },
    { key: 'issues', label: t('ga4.issues'), align: 'right', cell: (row) => value(row.crawl_issue_count, t) },
  ], [t]);
  if (!rows.length) return <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400">{t('ga4.noRows')}</p>;
  return <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-slate-300">
    <PagedTable columns={columns} paged={paged} emptyLabel={t('ga4.noRows')} rowKey={(row) => `${row.host_name}:${row.landing_page}`} />
  </div>;
}
