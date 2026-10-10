import { Map } from "lucide-react";
import { format } from "date-fns";
import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;
const completionLabel = (value: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, "yyyy-MM-dd HH:mm") : "—";
};
export const CrawlResultsHeader = ({ session }: { session: Session }) => {
const { currentRun, deleteCurrentRun, isCrawling, onDeleteRun, onSelectRun, openMapSection, result, runs, t } = session;
// Warn when any rendered page lacks headers applicable to its final DOM.
const responseHeadersObserved = result.pages.every((page) => page.robots_decision?.response_headers_available === true);
return (
<div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/35 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-white">
              {t("crawl.navigation.resultsTitle")}
            </h2>
            <span className="rounded border border-sky-500/20 bg-sky-500/5 px-1.5 py-0.5 text-[10px] text-sky-200">
              {result.crawl_mode === "browser-rendered"
                ? t("crawlDeepUi.browserRendered")
                : t("crawlDeepUi.httpJavascriptNotRendered")}
            </span>
            <button
              type="button"
              onClick={openMapSection}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-300/60 hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Map className="h-3.5 w-3.5" />
              {t("crawl.navigation.mapAndClusters")}
            </button>
          </div>
          <p
            className="truncate text-[11px] text-slate-500"
            title={result.start_url}
          >
            {result.start_url}
          </p>
          {result.crawl_mode === "browser-rendered" && !responseHeadersObserved && (
            <p className="mt-1 text-[11px] leading-4 text-amber-200/80">
              {t("crawlDeepUi.renderedDomNote")}
            </p>
          )}
          {result.storage_pages_truncated && result.storage_pages_total && (
            <p className="mt-1 text-[11px] leading-4 text-amber-200/80" role="status">
              {t("crawl.persistence.pageIndexNote", {
                retained: result.pages.length,
                total: result.storage_pages_total,
              })}
            </p>
          )}
        </div>
        {runs.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <label className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
              <span className="shrink-0">{t("crawl.navigation.savedRun")}</span>
              <select
                aria-label={t("crawl.navigation.chooseSavedCrawl")}
                value={currentRun?.id || runs[0].id}
                onChange={(event) => onSelectRun(event.target.value)}
                className="h-8 max-w-[60vw] rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400 sm:max-w-96"
              >
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {completionLabel(run.completedAt)} ·{" "}
                    {t("crawl.ui.urlsCount", { count: run.result.pages_crawled })} · {run.startUrl}
                  </option>
                ))}
              </select>
            </label>
            {onDeleteRun && (
              <button
                type="button"
                onClick={() => void deleteCurrentRun()}
                disabled={!currentRun || isCrawling}
                className="inline-flex h-8 items-center rounded-md border border-rose-500/35 px-2.5 text-[11px] font-medium text-rose-200 transition hover:border-rose-400/70 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                title={
                  isCrawling
                    ? t("crawl.navigation.deleteRunDuringCrawl")
                    : t("crawl.navigation.deleteRunTitle")
                }
              >
                {t("crawl.navigation.deleteRun")}
              </button>
            )}
          </div>
        )}
      </div>
);
};
