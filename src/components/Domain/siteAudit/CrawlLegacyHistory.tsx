import { TrendChart } from "@/components/Charts/TrendChart";

import type { useSiteAuditSession } from './useSiteAuditSession';
import { CrawlResourceErrors } from './CrawlResourceErrors';
import { CrawlRunComparison } from './CrawlRunComparison';
import { CrawlRunResults } from './CrawlRunResults';
type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlLegacyHistory = ({ session }: { session: Session }) => {
const { crawlResult, crawlRuns, historyMetrics, t } = session;

return (<div className="hidden" aria-hidden="true">
            {crawlResult?.resources !== undefined && (
              <CrawlResourceErrors session={session} />
            )}

            {crawlRuns.length > 1 && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-100">
                    {t("siteAudit.metricHistoryTitle")}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("siteAudit.metricHistoryDescription")}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
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
                        label={t("siteAudit.historyChartLabel", {
                          metric: metric.label,
                        })}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {crawlRuns.length > 1 && crawlResult && (
              <CrawlRunComparison session={session} />
            )}

            {/* Crawl Result Dashboard */}
            {crawlResult && (
              <CrawlRunResults session={session} />
            )}
          </div>);
};
