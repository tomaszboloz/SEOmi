import type { useSiteAuditSession } from './useSiteAuditSession';
import { CrawlHealthMetrics } from './CrawlHealthMetrics';
import { CrawlReportTemplatePanel } from './CrawlReportTemplatePanel';
import { CrawlExportActions } from './CrawlExportActions';
import { CrawlResultsOverview } from './CrawlResultsOverview';
import { CrawlPageErrors } from './CrawlPageErrors';
type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlRunResults = ({ session }: { session: Session }) => {
const { crawlOnlyUrls, crawlPdfError, crawlResult, selectedRun, sitemapOnlyUrls, t } = session;

if (!crawlResult) return null;
return (<div className="space-y-8">
                {/* Summary Cards */}
                <CrawlHealthMetrics session={session} />
                {crawlResult.cancelled && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {t("siteAudit.cancelledNotice")}
                  </p>
                )}
                <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                  {t("siteAudit.robotsStatus", {
                    status: crawlResult.robots_txt_status,
                    count: crawlResult.robots_blocked_count,
                  })}
                </p>
                <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                  {t("siteAudit.sitemapStatus", {
                    status: crawlResult.sitemap_status,
                    count: crawlResult.sitemap_urls_discovered,
                  })}
                </p>
                {(crawlResult.rejected_urls?.length || 0) > 0 && (
                  <details className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                    <summary className="cursor-pointer font-medium">
                      {t("siteAudit.rejectedUrls", {
                        count: crawlResult.rejected_urls?.length,
                      })}
                    </summary>
                    <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono text-[11px] text-slate-300">
                      {crawlResult.rejected_urls?.map((item) => (
                        <li key={`${item.url}-${item.reason}`}>
                          {item.url} —{" "}
                          <span className="text-amber-200">{item.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {selectedRun && <CrawlReportTemplatePanel session={session} />}
                {selectedRun ? (
                  <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        {t("siteAudit.exportTitle")}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {t("siteAudit.exportDescription")}
                      </p>
                    </div>
                    <CrawlExportActions session={session} />
                    {crawlPdfError && (
                      <p role="alert" className="text-xs text-rose-300">
                        {crawlPdfError}
                      </p>
                    )}
                  </section>
                ) : (
                  <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                    {t("siteAudit.legacyExportUnavailable")}
                  </p>
                )}
                {crawlResult.sitemap_urls_discovered > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                      <p className="text-xs text-sky-200">
                        {t("siteAudit.sitemapOnlyTitle")}
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {sitemapOnlyUrls.length}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {t("siteAudit.sitemapOnlyDescription")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                      <p className="text-xs text-violet-200">
                        {t("siteAudit.crawlOnlyTitle")}
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {crawlOnlyUrls.length}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {t("siteAudit.crawlOnlyDescription")}
                      </p>
                    </div>
                  </div>
                )}
                {/* Filter Bar */}
                <CrawlResultsOverview session={session} />

                {/* Crawled Pages Table */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3 w-10"></th>
                          <th className="px-4 py-3">
                            {t("siteAudit.pageUrlTitle")}
                          </th>
                          <th className="px-4 py-3 text-center">
                            {t("siteAudit.status")}
                          </th>
                          <th className="px-4 py-3 text-center">
                            {t("siteAudit.depth")}
                          </th>
                          <th className="px-4 py-3 text-center">
                            {t("siteAudit.h1Count")}
                          </th>
                          <th className="px-4 py-3 text-right">
                            {t("siteAudit.speed")}
                          </th>
                          <th className="px-4 py-3 text-right">
                            {t("siteAudit.issues")}
                          </th>
                        </tr>
                      </thead>
                      <CrawlPageErrors session={session} />
                    </table>
                  </div>
                </div>
              </div>);
};
