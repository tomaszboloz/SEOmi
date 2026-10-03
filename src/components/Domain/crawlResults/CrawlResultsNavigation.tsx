import { useRef } from 'react';
import { useCrawlNavigationHeight } from './useCrawlNavigationHeight';
import { CrawlResultsGroups } from "./CrawlResultsGroups";
import { CrawlResultsTabStrip } from "./CrawlResultsTabStrip";
import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;
export const CrawlResultsNavigation = ({ session }: { session: Session }) => {
const navigationRef = useRef<HTMLDivElement>(null);
useCrawlNavigationHeight(navigationRef, session.resultsRef);
const { activeGroupMeta, activeTab, activeTabMeta, localizedGroupLabel, localizedTabLabel, t, tabCounts } = session;
return (
<div ref={navigationRef} className="sticky top-0 z-30 rounded-xl border border-slate-700/90 bg-slate-950 p-2 shadow-lg shadow-black/20">
<div className="flex flex-col gap-2">
<CrawlResultsGroups session={session} />
<CrawlResultsTabStrip session={session} />
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
);
};
