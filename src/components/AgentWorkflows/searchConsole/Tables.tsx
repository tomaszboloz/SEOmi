import type { SearchConsoleSession } from './useSearchConsoleSession';
import { appLocale } from '@/services/localeFormat';
import { PagedTable, type PagedColumn } from './PagedTable';
import { usePagedRows } from './usePagedRows';

type QueryRow = NonNullable<SearchConsoleSession['gscData']>['queries'][number];
type PageRow = NonNullable<SearchConsoleSession['gscData']>['pages'][number];

const NO_ROWS: never[] = [];
const QUERY_SORT = {
  text: (r: QueryRow) => r.query.toLowerCase(), clicks: (r: QueryRow) => r.clicks, impressions: (r: QueryRow) => r.impressions,
  ctr: (r: QueryRow) => r.ctr, position: (r: QueryRow) => r.position,
};
const PAGE_SORT = {
  text: (r: PageRow) => r.page.toLowerCase(), clicks: (r: PageRow) => r.clicks, impressions: (r: PageRow) => r.impressions,
  ctr: (r: PageRow) => r.ctr, position: (r: PageRow) => r.position,
};

export function SearchConsoleTables({ session }: { session: SearchConsoleSession }) {
  const { t, gscData } = session;
  const num = (value: number) => value.toLocaleString(appLocale());
  const queries = usePagedRows(gscData?.queries ?? NO_ROWS, QUERY_SORT, 'clicks');
  const pages = usePagedRows(gscData?.pages ?? NO_ROWS, PAGE_SORT, 'clicks');

  const queryColumns: PagedColumn<QueryRow>[] = [
    { key: 'text', label: t('searchConsole.searchQuery'), cell: (r) => r.query, cellClassName: 'font-sans font-medium text-slate-200' },
    { key: 'clicks', label: t('searchConsole.clicksShort'), align: 'right', cell: (r) => num(r.clicks), cellClassName: 'font-bold text-emerald-400' },
    { key: 'impressions', label: t('searchConsole.impressionsShort'), align: 'right', cell: (r) => num(r.impressions), cellClassName: 'text-slate-400' },
    { key: 'ctr', label: t('searchConsole.ctr'), align: 'right', cell: (r) => `${r.ctr}%`, cellClassName: 'text-slate-300' },
    { key: 'position', label: t('searchConsole.positionShortHeader'), align: 'center', cell: (r) => `#${r.position}`, cellClassName: 'font-bold text-amber-400' },
  ];
  const pageColumns: PagedColumn<PageRow>[] = [
    { key: 'text', label: t('searchConsole.pageUrl'), cell: (r) => r.page, cellClassName: 'max-w-[180px] truncate text-slate-200' },
    { key: 'clicks', label: t('searchConsole.clicksShort'), align: 'right', cell: (r) => num(r.clicks), cellClassName: 'font-bold text-emerald-400' },
    { key: 'impressions', label: t('searchConsole.impressionsShort'), align: 'right', cell: (r) => num(r.impressions), cellClassName: 'text-slate-400' },
    { key: 'ctr', label: t('searchConsole.ctr'), align: 'right', cell: (r) => `${r.ctr}%`, cellClassName: 'text-slate-300' },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-white">{t('searchConsole.topQueries')}</h3>
        <PagedTable columns={queryColumns} paged={queries} emptyLabel={t('searchConsole.noQueryRows')} rowKey={(r) => r.query} />
      </div>
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-white">{t('searchConsole.topPages')}</h3>
        <PagedTable columns={pageColumns} paged={pages} emptyLabel={t('searchConsole.noPageRows')} rowKey={(r) => r.page} />
      </div>
    </div>
  );
}
