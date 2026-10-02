import { Map } from "lucide-react";
import { CrawlTab, tabs, tabGroups } from "./crawlResultsHelpers";
import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;
export const CrawlResultsGroups = ({ session }: { session: Session }) => {
const { activeTab, activeTabGroup, activeTabMeta, localizedGroupLabel, localizedGroupShortLabel, localizedTabLabel, openMapSection, scrollResults, setActiveTab, setActiveTabGroup, t, tabCounts } = session;
return (
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
);
};
