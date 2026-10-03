import { cell, tableHead } from '../crawlResultsHelpers';
import { Table } from '../CrawlViewPrimitives';
import type { CustomSearchRow } from './customSearchTypes';

interface CustomSearchTableProps {
  rows: CustomSearchRow[];
  displayLimit: number;
  onLoadMore: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const CustomSearchTable = ({
  rows,
  displayLimit,
  onLoadMore,
  t,
}: CustomSearchTableProps) => (
  <>
    <Table minWidth="min-w-[1040px]">
      <thead className={tableHead}>
        <tr>
          {[
            t("crawl.ui.url"),
            t("crawl.customSearch.label"),
            t("crawl.customSearch.resultType"),
            t("crawl.ui.match"),
            t("crawl.ui.preview"),
            t("crawl.ui.status"),
          ].map((label) => (
            <th key={label} className={cell}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, displayLimit).map((row) => (
          <tr
            key={row.key}
            className="border-t border-slate-800/80 text-slate-300"
          >
            <td
              className={`${cell} max-w-64 truncate font-mono`}
              title={row.url}
            >
              {row.url}
            </td>
            <td className={cell}>{row.search.name}</td>
            <td className={`${cell} font-mono text-slate-400`}>
              {row.search.selectorType.toUpperCase()} · {row.search.resultType}
            </td>
            <td className={`${cell} text-center font-mono`}>
              {row.match || "—"}
            </td>
            <td
              className={`${cell} max-w-[520px] whitespace-pre-wrap break-all font-mono text-[11px]`}
              title={row.value}
            >
              {row.value}
            </td>
            <td className={`${cell} text-slate-400`}>{row.status}</td>
          </tr>
        ))}
      </tbody>
    </Table>
    {rows.length > displayLimit && (
      <button
        type="button"
        onClick={onLoadMore}
        className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-emerald-400/40"
      >
        {t("crawl.customSearch.more", { count: rows.length })}
      </button>
    )}
  </>
);
