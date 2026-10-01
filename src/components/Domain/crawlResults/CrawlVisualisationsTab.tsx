

import { format } from "date-fns";

import { CrawlArchitectureGraph } from "@/components/Charts/CrawlArchitectureGraph";

import { TrendChart } from "@/components/Charts/TrendChart";

import { Empty } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlVisualisationsTab = ({ session }: { session: Session }) => {
const { compareByPath, comparison, comparisonRunId, currentRun, historyMetrics, result, runs, setComparisonRunId, t, updateCompareByPath } = session;
return (
          <div
            id="crawl-map-section"
            tabIndex={-1}
            aria-label={t("crawl.navigation.mapSectionAria")}
            className="scroll-mt-32 space-y-4 outline-none"
          >
            <CrawlArchitectureGraph
              pages={result.pages}
              startUrl={result.start_url}
              crawlMode={result.crawl_mode}
              sitemapUrls={result.sitemap_urls}
              runs={runs}
              currentRunId={currentRun?.id}
            />
            {runs.length > 1 ? (
              <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {t("crawlDeepUi.savedRunMetrics")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("crawlDeepUi.savedRunMetricsDescription")}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {historyMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <p className={`text-xs font-medium ${metric.colour}`}>
                        {metric.label}
                      </p>
                      <p className="mt-1 text-xl font-semibold text-white">
                        {metric.values.at(-1) ?? "—"}
                      </p>
                      <TrendChart
                        values={metric.values}
                        label={t("siteAudit.historyChartLabel", { metric: metric.label })}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <Empty>{t("crawlDeepUi.historyChartEmpty")}</Empty>
            )}
            {runs.length > 1 && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      {t("crawlDeepUi.compareTwoRuns")}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {compareByPath
                        ? t("crawlDeepUi.environmentMatchDescription")
                        : t("crawlDeepUi.fullUrlDescription")}
                    </p>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <select
                      aria-label={t("crawl.ui.compareCrawl")}
                      value={comparisonRunId}
                      onChange={(event) =>
                        setComparisonRunId(event.target.value)
                      }
                      className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                    >
                      <option value="">{t("crawl.ui.chooseBaseRun")}</option>
                      {runs
                        .filter((run) => run.id !== currentRun?.id)
                        .map((run) => (
                          <option key={run.id} value={run.id}>
                            {format(
                              new Date(run.completedAt),
                              "yyyy-MM-dd HH:mm",
                            )}{" "}
                            · {t("crawl.ui.urlsCount", { count: run.result.pages_crawled })} · {run.startUrl}
                          </option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={compareByPath}
                        onChange={(event) =>
                          updateCompareByPath(event.target.checked)
                        }
                        className="accent-emerald-400"
                      />
                      {t("crawlDeepUi.matchByPath")}
                    </label>
                  </div>
                </div>
                {compareByPath && (
                  <p
                    role="note"
                    className="mt-3 rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[11px] leading-5 text-sky-100"
                  >
                    {t("crawlDeepUi.pathMatchDisclaimer")}
                  </p>
                )}
                {comparison && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                      {t("crawlDeepUi.addedUrls")}{" "}
                      <strong className="ml-2 text-lg text-white">
                        {comparison.added.length}
                      </strong>
                    </div>
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-200">
                      {t("crawlDeepUi.removedUrls")}{" "}
                      <strong className="ml-2 text-lg text-white">
                        {comparison.removed.length}
                      </strong>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                      {t("crawlDeepUi.changedUrls")}{" "}
                      <strong className="ml-2 text-lg text-white">
                        {comparison.changed.length}
                      </strong>
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs sm:col-span-3">
                      {[
                        ...comparison.added,
                        ...comparison.removed,
                        ...comparison.changed,
                      ].length === 0 ? (
                        <p className="text-slate-500">
                          {t("crawlDeepUi.noComparisonChanges")}
                        </p>
                      ) : (
                        [
                          ...comparison.added,
                          ...comparison.removed,
                          ...comparison.changed,
                        ].map((change) => (
                          <p
                            key={`${change.kind}-${change.url}`}
                            className="truncate py-1 text-slate-300"
                          >
                            {change.kind} · {change.url}
                            {change.matchedUrl &&
                            change.matchedUrl !== change.url
                              ? ` ↔ ${change.matchedUrl}`
                              : ""}
                            {change.fields.length
                              ? ` (${change.fields.join(", ")})`
                              : ""}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        );
};
