import { crawlErrorLabel } from "@/services/crawlErrors";

import type { useSiteAuditSession } from './useSiteAuditSession';
import { CrawlResourceRows } from './CrawlResourceRows';
type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlResourceErrors = ({ session }: { session: Session }) => {
const { activeErrorKindFilter, crawlResult, filteredResources, t } = session;

if (!crawlResult?.resources) return null;
return (<section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      {t("siteAudit.resourcesTitle")}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("siteAudit.resourcesDescription")}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {t("siteAudit.resourceCount", {
                      count: crawlResult.resources.length,
                    })}
                    {crawlResult.resource_limit_reached
                      ? ` · ${t("siteAudit.resourceLimitReached")}`
                      : ""}
                  </div>
                </div>
                {crawlResult.resources.length > 0 ? (
                  <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-800">
                    <table className="w-full min-w-[880px] text-left text-xs">
                      <thead className="sticky top-0 bg-slate-950 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">
                            {t("siteAudit.resourceType")}
                          </th>
                          <th className="px-3 py-2 font-medium">
                            {t("siteAudit.status")}
                          </th>
                          <th className="px-3 py-2 font-medium">
                            {t("siteAudit.resource")}
                          </th>
                          <th className="px-3 py-2 font-medium">
                            {t("siteAudit.sources")}
                          </th>
                          <th className="px-3 py-2 font-medium">
                            {t("siteAudit.contentTypeSize")}
                          </th>
                          <th className="px-3 py-2 font-medium">
                            {t("siteAudit.intrinsicDimensions")}
                          </th>
                        </tr>
                      </thead>
                      <CrawlResourceRows session={session} />
                    </table>
                    {filteredResources.length === 0 &&
                      activeErrorKindFilter !== "all" && (
                        <p className="p-3 text-xs text-slate-500">
                          {t("siteAudit.noFilteredResources", {
                            error: crawlErrorLabel(activeErrorKindFilter),
                          })}
                        </p>
                      )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    {t("siteAudit.noResources")}
                  </p>
                )}
              </section>);
};
