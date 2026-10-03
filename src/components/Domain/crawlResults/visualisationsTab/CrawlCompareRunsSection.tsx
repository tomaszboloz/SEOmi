import { format } from "date-fns";
import type { CrawlRunRecord } from "@/types";
import type { CrawlDiff } from "@/services/crawlDiff";
import { ComparisonChangesList } from "./ComparisonChangesList";

interface CrawlCompareRunsSectionProps {
  runs: CrawlRunRecord[];
  currentRunId?: string;
  comparisonRunId: string;
  setComparisonRunId: (id: string) => void;
  compareByPath: boolean;
  updateCompareByPath: (val: boolean) => void;
  comparison: CrawlDiff | null;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const CrawlCompareRunsSection = ({
  runs,
  currentRunId,
  comparisonRunId,
  setComparisonRunId,
  compareByPath,
  updateCompareByPath,
  comparison,
  t,
}: CrawlCompareRunsSectionProps) => {
  if (runs.length <= 1) return null;

  return (
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
            onChange={(event) => setComparisonRunId(event.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
          >
            <option value="">{t("crawl.ui.chooseBaseRun")}</option>
            {runs
              .filter((run) => run.id !== currentRunId)
              .map((run) => (
                <option key={run.id} value={run.id}>
                  {format(new Date(run.completedAt), "yyyy-MM-dd HH:mm")}{" "}
                  · {t("crawl.ui.urlsCount", { count: run.result.pages_crawled })} · {run.startUrl}
                </option>
              ))}
          </select>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={compareByPath}
              onChange={(event) => updateCompareByPath(event.target.checked)}
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
          <ComparisonChangesList comparison={comparison} t={t} />
        </div>
      )}
    </section>
  );
};
