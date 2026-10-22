import React from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZES, type PagedRows } from './usePagedRows';

export interface PagedColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  cell: (row: T) => React.ReactNode;
  cellClassName?: string;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

interface Props<T> {
  columns: PagedColumn<T>[];
  paged: PagedRows<T>;
  emptyLabel: string;
  rowKey: (row: T) => string;
}

export function PagedTable<T>({ columns, paged, emptyLabel, rowKey }: Props<T>) {
  const { t } = useTranslation();
  const button = 'rounded border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="border-b border-slate-800 font-sans uppercase text-slate-500">
            <tr>
              {columns.map((column) => {
                const active = paged.sortKey === column.key;
                const arrow = active ? (paged.sortDirection === 'asc' ? '▲' : '▼') : '';
                return (
                  <th key={column.key} className={`pb-2 ${ALIGN[column.align ?? 'left']}`} aria-sort={active ? (paged.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => paged.toggleSort(column.key)} className="uppercase transition hover:text-emerald-300" title={t('searchConsole.sortBy', { column: column.label })}>
                      {column.label} <span aria-hidden="true">{arrow}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paged.rows.map((row) => (
              <tr key={rowKey(row)} className="transition hover:bg-slate-800/30">
                {columns.map((column) => (
                  <td key={column.key} className={`py-2.5 ${ALIGN[column.align ?? 'left']} ${column.cellClassName ?? ''}`}>{column.cell(row)}</td>
                ))}
              </tr>
            ))}
            {paged.total === 0 && <tr><td colSpan={columns.length} className="py-4 text-center text-slate-500">{emptyLabel}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 font-sans text-[11px] text-slate-400">
        <span>{t('searchConsole.showingRows', { from: paged.from, to: paged.to, total: paged.total })}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            {t('searchConsole.rowsPerPage')}
            <select value={paged.pageSize} onChange={(event) => paged.setPageSize(Number(event.target.value))} className="rounded border border-slate-700 bg-slate-950 px-1 py-1 text-slate-200">
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <button type="button" className={button} disabled={paged.page <= 1} onClick={() => paged.setPage(paged.page - 1)}>{t('searchConsole.pagePrevious')}</button>
          <span>{t('searchConsole.pageOf', { page: paged.page, total: paged.pageCount })}</span>
          <button type="button" className={button} disabled={paged.page >= paged.pageCount} onClick={() => paged.setPage(paged.page + 1)}>{t('searchConsole.pageNext')}</button>
        </div>
      </div>
    </div>
  );
}
