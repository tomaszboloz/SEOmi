

import { FileDown } from "lucide-react";

import { downloadCrawlCustomSearchCsv } from "@/services/export";

import { cell, tableHead } from './crawlResultsHelpers';
import { customSearchRows } from './customSearchRows';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlCustomSearchTab = ({ session }: { session: Session }) => {
const { currentRun, customSearchDisplayLimit, result, setCustomSearchDisplayLimit, t } = session;
{
        const searches = currentRun?.config.customSearches || [];
        if (searches.length === 0)
          return <Empty>{t("crawl.customSearch.notConfigured")}</Empty>;
        const rows = customSearchRows(result.pages, searches, t);
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {t("crawl.customSearch.previewTitle", {
                    count: searches.length,
                  })}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  {t("crawl.customSearch.previewDescription")}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  currentRun && downloadCrawlCustomSearchCsv(currentRun)
                }
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-emerald-500/30 px-3 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("crawl.customSearch.export")}
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {searches.map((search) => (
                <div
                  key={search.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                >
                  <p className="text-xs font-semibold text-slate-200">
                    {search.name} · {search.resultType}
                    {search.resultType === "attribute"
                      ? ` (${search.attribute || t("crawl.customSearch.attribute")})`
                      : ""}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-emerald-200">
                    {search.selectorType.toUpperCase()}: {search.query}
                  </p>
                </div>
              ))}
            </div>
            {rows.length === 0 ? (
              <Empty>{t("crawl.customSearch.noPages")}</Empty>
            ) : (
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
                    {rows.slice(0, customSearchDisplayLimit).map((row) => (
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
                          {row.search.selectorType.toUpperCase()} ·{" "}
                          {row.search.resultType}
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
                        <td className={`${cell} text-slate-400`}>
                          {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {rows.length > customSearchDisplayLimit && (
                  <button
                    type="button"
                    onClick={() =>
                      setCustomSearchDisplayLimit((limit) => limit + 200)
                    }
                    className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-emerald-400/40"
                  >
                    {t("crawl.customSearch.more", { count: rows.length })}
                  </button>
                )}
              </>
            )}
          </div>
        );
      }
};
