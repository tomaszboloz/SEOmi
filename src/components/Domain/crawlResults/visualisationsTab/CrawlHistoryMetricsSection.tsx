import { TrendChart } from "@/components/Charts/TrendChart";
import { Empty } from '../CrawlViewPrimitives';

interface HistoryMetric {
  label: string;
  colour: string;
  values: (number | null)[];
}

interface CrawlHistoryMetricsSectionProps {
  runsCount: number;
  historyMetrics: HistoryMetric[];
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const CrawlHistoryMetricsSection = ({
  runsCount,
  historyMetrics,
  t,
}: CrawlHistoryMetricsSectionProps) => {
  if (runsCount <= 1) {
    return <Empty>{t("crawlDeepUi.historyChartEmpty")}</Empty>;
  }

  return (
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
  );
};
