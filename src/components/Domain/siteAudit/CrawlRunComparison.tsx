import type { useSiteAuditSession } from './useSiteAuditSession';
import { CrawlComparisonSelector } from './CrawlComparisonSelector';
import { CrawlComparisonDetails } from './CrawlComparisonDetails';
type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlRunComparison = ({ session }: { session: Session }) => {
const { comparison, comparisonByPath, t } = session;

return (<section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                <CrawlComparisonSelector session={session} />
                {comparisonByPath && (
                  <p
                    role="note"
                    className="mt-3 rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[11px] leading-5 text-sky-100"
                  >
                    {t("siteAudit.comparisonPathNotice")}
                  </p>
                )}
                {comparison && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-xs text-emerald-300">
                        {t("siteAudit.comparisonAdded")}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-white">
                        {comparison.added.length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                      <p className="text-xs text-rose-300">
                        {t("siteAudit.comparisonRemoved")}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-white">
                        {comparison.removed.length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-xs text-amber-300">
                        {t("siteAudit.comparisonChanged")}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-white">
                        {comparison.changed.length}
                      </p>
                    </div>
                    <CrawlComparisonDetails session={session} />
                  </div>
                )}
              </section>);
};
