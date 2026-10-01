

import { ChevronLeft, ChevronRight, Map } from "lucide-react";
import { format } from "date-fns";

import { CrawlTab, CrawlResultsTabsProps, tabs, tabGroups } from './crawlResults/crawlResultsHelpers';

import { useCrawlResultsSession } from './crawlResults/useCrawlResultsSession';
import { CrawlResultsContent } from './crawlResults/CrawlResultsContent';
export const CrawlResultsTabs = (props: CrawlResultsTabsProps) => {
const session = useCrawlResultsSession(props);
const { activeGroupMeta, activeTab, activeTabGroup, activeTabMeta, currentRun, deleteCurrentRun, isCrawling, localizedGroupLabel, localizedGroupShortLabel, localizedTabLabel, onDeleteRun, onSelectRun, openMapSection, result, resultsRef, runs, scrollResults, scrollTabStrip, selectTabByKey, setActiveTab, setActiveTabGroup, t, tabCounts, tabScrollerRef } = session;
return (
    <section
      ref={resultsRef}
      id="crawl-results"
      tabIndex={-1}
      className="scroll-mt-20 space-y-3"
      aria-label={t("crawl.navigation.resultsTitle")}
    >
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
          {result.crawl_mode === "browser-rendered" && (
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
                    {format(new Date(run.completedAt), "yyyy-MM-dd HH:mm")} ·{" "}
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
      <div className="sticky top-12 z-30 rounded-xl border border-slate-700/90 bg-slate-950/95 p-2 shadow-lg shadow-black/20 backdrop-blur supports-[backdrop-filter]:bg-slate-950/90">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              aria-label={t("crawl.navigation.groupAria")}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
            >
              {tabGroups.map((group) => {
                const isActive = activeTabGroup === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    aria-pressed={isActive}
                    title={`${localizedGroupLabel(group)}: ${group.tabs.length} ${t("crawl.navigation.items")}`}
                    onClick={() => {
                      setActiveTabGroup(group.id);
                      setActiveTab(group.tabs[0]);
                    }}
                    className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${isActive ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-800/70 hover:text-slate-200"}`}
                  >
                    <span className="sm:hidden">
                      {localizedGroupShortLabel(group)}
                    </span>
                    <span className="hidden sm:inline">
                      {localizedGroupLabel(group)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
              <span className="hidden lg:inline">
                {t("crawl.navigation.active")}{" "}
                <span className="text-slate-300">
                  {localizedTabLabel(activeTabMeta)}
                </span>
              </span>
              <label className="flex items-center gap-2">
                <span className="sr-only">
                  {t("crawl.navigation.jumpLabel")}
                </span>
                <select
                  aria-label={t("crawl.navigation.jumpLabel")}
                  value={activeTab}
                  onChange={(event) =>
                    setActiveTab(event.target.value as CrawlTab)
                  }
                  className="h-8 min-w-0 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400 sm:w-44"
                >
                  {tabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {localizedTabLabel(tab)} · {tabCounts[tab.id]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                aria-label={t("crawl.navigation.mapAria", {
                  count: tabCounts.visualisations,
                })}
                title={t("crawl.navigation.mapButton")}
                onClick={openMapSection}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-emerald-400/35 bg-emerald-400/10 px-2 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-300/70 hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Map className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {t("crawl.navigation.mapButtonShort")}
                </span>
                <span className="rounded bg-slate-950/50 px-1 font-mono text-[10px]">
                  {tabCounts.visualisations}
                </span>
              </button>
              <button
                type="button"
                aria-label={t("crawl.navigation.scrollResultsStart")}
                title={t("crawl.navigation.scrollResultsStart")}
                onClick={() => scrollResults("start")}
                className="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-700 px-2 text-[10px] font-medium text-slate-400 transition hover:border-slate-500 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <span className="sm:hidden" aria-hidden="true">
                  ↑
                </span>
                <span className="hidden sm:inline">
                  ↑ {t("crawl.navigation.beginning")}
                </span>
              </button>
              <button
                type="button"
                aria-label={t("crawl.navigation.scrollResultsEnd")}
                title={t("crawl.navigation.scrollResultsEnd")}
                onClick={() => scrollResults("end")}
                className="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-700 px-2 text-[10px] font-medium text-slate-400 transition hover:border-slate-500 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <span className="sm:hidden" aria-hidden="true">
                  ↓
                </span>
                <span className="hidden sm:inline">
                  ↓ {t("crawl.navigation.end")}
                </span>
              </button>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              aria-label={t("crawl.navigation.scrollTabsStart")}
              title={t("crawl.navigation.scrollTabsStart")}
              onClick={() => scrollTabStrip("start")}
              aria-controls="crawl-tab-strip"
              className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span className="md:hidden" aria-hidden="true">
                ↤
              </span>
              <span className="hidden md:inline">
                {t("crawl.navigation.beginning")}
              </span>
            </button>
            <button
              type="button"
              aria-label={t("crawl.navigation.scrollTabsLeft")}
              title={t("crawl.navigation.scrollTabsLeft")}
              onClick={() => scrollTabStrip("left")}
              aria-controls="crawl-tab-strip"
              className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div
              ref={tabScrollerRef}
              id="crawl-tab-strip"
              role="tablist"
              aria-label={t("crawl.navigation.resultsTitle")}
              onKeyDown={selectTabByKey}
              className="scrollbar-thin flex min-w-0 flex-1 snap-x gap-1 overflow-x-auto scroll-smooth overscroll-x-contain"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`crawl-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls="crawl-tab-panel"
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${activeTab === tab.id ? "bg-emerald-400/10 text-emerald-200 shadow-inner shadow-emerald-300/5" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{localizedTabLabel(tab)}</span>
                    <span
                      className={`rounded px-1 py-0.5 font-mono text-[10px] ${activeTab === tab.id ? "bg-emerald-400/10 text-emerald-100" : "bg-slate-800 text-slate-500"}`}
                    >
                      {tabCounts[tab.id]}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label={t("crawl.navigation.scrollTabsRight")}
              title={t("crawl.navigation.scrollTabsRight")}
              onClick={() => scrollTabStrip("right")}
              aria-controls="crawl-tab-strip"
              className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={t("crawl.navigation.scrollTabsEnd")}
              title={t("crawl.navigation.scrollTabsEnd")}
              onClick={() => scrollTabStrip("end")}
              aria-controls="crawl-tab-strip"
              className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span className="md:hidden" aria-hidden="true">
                ↦
              </span>
              <span className="hidden md:inline">
                {t("crawl.navigation.end")}
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-1 text-[10px] text-slate-500">
            <span>
              {localizedGroupLabel(activeGroupMeta)} ·{" "}
              {localizedTabLabel(activeTabMeta)} · {tabCounts[activeTab]}{" "}
              {t("crawl.navigation.items")}
            </span>
            <span className="hidden sm:inline">
              {t("crawl.navigation.keyboardHint")}
            </span>
            <span className="sm:hidden">
              {t("crawl.navigation.mobileHint")}
            </span>
          </div>
        </div>
      </div>
      <div
        role="tabpanel"
        id="crawl-tab-panel"
        aria-labelledby={`crawl-tab-${activeTab}`}
        className="min-h-64 rounded-xl border border-slate-800 bg-slate-900/25 p-3 sm:p-4"
      >
        {<CrawlResultsContent session={session} />}
      </div>
    </section>
  );
};
