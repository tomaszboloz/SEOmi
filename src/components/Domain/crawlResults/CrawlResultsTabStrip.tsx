import { ChevronLeft, ChevronRight } from "lucide-react";
import { tabs } from "./crawlResultsHelpers";
import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;
export const CrawlResultsTabStrip = ({ session }: { session: Session }) => {
const { activeTab, localizedTabLabel, scrollTabStrip, selectTabByKey, setActiveTab, t, tabCounts, tabScrollerRef } = session;
return (
<div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              aria-label={t("crawl.navigation.scrollTabsStart")}
              title={t("crawl.navigation.scrollTabsStart")}
              onClick={() => scrollTabStrip("start")}
              aria-controls="crawl-tab-strip"
              className="flex h-10 min-w-9 px-2 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
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
              className="flex h-10 min-w-9 px-2 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span className="md:hidden" aria-hidden="true">
                ↦
              </span>
              <span className="hidden md:inline">
                {t("crawl.navigation.end")}
              </span>
            </button>
          </div>
);
};
