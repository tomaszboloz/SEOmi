

import { Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

import { CrawlSummaryMetrics } from './CrawlSummaryMetrics';
export const CrawlOverviewTab = ({ session }: { session: Session }) => {
const { result, t } = session;
const summaryRows = <CrawlSummaryMetrics session={session} />;
return (
          <div className="space-y-4">
            <Table minWidth="min-w-[520px]">
              <tbody>{summaryRows}</tbody>
            </Table>
            {(result.rejected_urls?.length || 0) > 0 && (
              <details className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                <summary className="cursor-pointer font-medium">
                  {t("siteAudit.rejectedUrls", {
                    count: result.rejected_urls?.length || 0,
                  })}
                </summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-auto font-mono text-[11px] text-slate-300">
                  {result.rejected_urls?.map((item) => (
                    <li key={`${item.url}-${item.reason}`}>
                      {item.url} — {item.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="text-[11px] text-slate-500">
              {t("crawl.ui.savedHttpValues")}
            </p>
          </div>
        );
};
