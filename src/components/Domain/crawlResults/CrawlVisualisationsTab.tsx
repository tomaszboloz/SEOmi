import { CrawlArchitectureGraph } from "@/components/Charts/CrawlArchitectureGraph";

import { TrendChart } from "@/components/Charts/TrendChart";

import { CrawlRunComparison } from './CrawlRunComparison';
import { Empty } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlVisualisationsTab = ({ session }: { session: Session }) => {
const { currentRun, historyMetrics, result, runs, t } = session;
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
            <CrawlRunComparison session={session} />
          </div>
        );
};
