

import type { CrawledPageSummary } from "@/types";

import { crawlErrorLabel } from "@/services/crawlErrors";

import { CrawlSegment, CrawlSort } from './crawlResultsHelpers';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;
import { CrawlFilterPresetBar } from './CrawlFilterPresetBar';
import { CrawlPageTable } from './CrawlPageTable';

export const CrawlUrlsTab = ({ session }: { session: Session }) => {
const { activeErrorKind, descending, errorKinds, onlyProblems, pages, query, result, segment, setDescending, setErrorKind, setOnlyProblems, setQuery, setSegment, setSeverity, setSort, severity, sort, t } = session;
const renderPageTable = (rows: CrawledPageSummary[]) => <CrawlPageTable session={session} rows={rows} />;
return (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs text-slate-400">
                {t("crawl.ui.searchUrlTitle")}
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("crawl.ui.searchLinkPlaceholder")}
                  className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                />
              </label>
              <label className="text-xs text-slate-400">
                {t("crawl.ui.httpSegment")}
                <select
                  value={segment}
                  onChange={(event) =>
                    setSegment(event.target.value as CrawlSegment)
                  }
                  className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                >
                  <option value="all">{t("legacyUi.overview.allStatuses")}</option>
                  <option value="2xx">{t("crawl.ui.successStatuses")}</option>
                  <option value="3xx">{t("crawl.ui.redirects")}</option>
                  <option value="4xx">{t("crawl.ui.errorKinds.http")}</option>
                  <option value="5xx">{t("crawl.ui.errorKinds.http")}</option>
                  <option value="transport">
                    {t("crawl.ui.transport")}
                  </option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                {t("crawlDeepUi.sortBy")}
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as CrawlSort)}
                  className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                >
                  <option value="url">{t("crawl.ui.url")}</option>
                  <option value="status">{t("crawl.ui.httpStatusLabel")}</option>
                  <option value="title">{t("crawl.ui.title")}</option>
                  <option value="depth">{t("crawl.ui.depth")}</option>
                  <option value="responseTime">
                    {t("crawl.ui.responseTime")}
                  </option>
                  <option value="issues">{t("crawl.ui.issueCount")}</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setDescending((value) => !value)}
                  aria-pressed={descending}
                  className="h-8 rounded-md border border-slate-700 px-2.5 text-xs text-slate-300 hover:border-emerald-400/50"
                >
                  {descending
                    ? `${t("crawl.ui.descending")} ↓`
                    : `${t("crawl.ui.ascending")} ↑`}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyProblems}
                  onChange={(event) => setOnlyProblems(event.target.checked)}
                  className="accent-emerald-400"
                />
                {t("crawl.ui.onlyProblems")}
              </label>
              <span className="text-xs text-slate-400">
                {t("crawl.ui.severity")}:
              </span>
              {(["all", "Critical", "Warning", "Info"] as const).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSeverity(value)}
                    aria-pressed={severity === value}
                    className={`rounded-md px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${severity === value ? "bg-emerald-500/20 font-medium text-emerald-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
                  >
                    {value === "all"
                      ? t("crawl.ui.all")
                      : t(`crawl.ui.severityValues.${value.toLowerCase()}`)}
                  </button>
                ),
              )}
              <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                {t("crawl.ui.errorType")}
                <select
                  aria-label={t("crawl.ui.errorTypeAria")}
                  value={activeErrorKind}
                  onChange={(event) => setErrorKind(event.target.value)}
                  className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                >
                  <option value="all">{t("crawl.ui.all")}</option>
                  {errorKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {crawlErrorLabel(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-xs text-slate-500">
                {pages.length} / {result.pages.length}
              </span>
            </div>
            <CrawlFilterPresetBar session={session} />
            {renderPageTable(pages)}
          </div>
        );
};
