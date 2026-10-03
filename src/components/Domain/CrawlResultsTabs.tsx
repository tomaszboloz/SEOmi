


import { CrawlResultsTabsProps } from './crawlResults/crawlResultsHelpers';

import { useCrawlResultsSession } from './crawlResults/useCrawlResultsSession';
import { CrawlResultsHeader } from './crawlResults/CrawlResultsHeader';
import { CrawlResultsNavigation } from './crawlResults/CrawlResultsNavigation';
import { CrawlResultsContent } from './crawlResults/CrawlResultsContent';
export const CrawlResultsTabs = (props: CrawlResultsTabsProps) => {
const session = useCrawlResultsSession(props);
const { activeTab, resultsRef, t } = session;
return (
    <section
      ref={resultsRef}
      id="crawl-results"
      tabIndex={-1}
      className="scroll-mt-20 space-y-3"
      aria-label={t("crawl.navigation.resultsTitle")}
    >
      <CrawlResultsHeader session={session} />
      <CrawlResultsNavigation session={session} />
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
