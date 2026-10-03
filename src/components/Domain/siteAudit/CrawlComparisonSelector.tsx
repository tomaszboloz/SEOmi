import { format } from "date-fns";

import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlComparisonSelector = ({ session }: { session: Session }) => {
const { comparisonByPath, comparisonRunId, crawlEnvironmentLabel, crawlRuns, selectedRun, setComparisonRunId, t, updateComparisonByPath } = session;

return (<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      {t("siteAudit.crawlComparisonTitle")}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {comparisonByPath
                        ? t("siteAudit.crawlComparisonPathMode")
                        : t("siteAudit.crawlComparisonUrlMode")}
                    </p>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <select
                      aria-label={t("siteAudit.comparisonSelectAria")}
                      value={comparisonRunId}
                      onChange={(event) =>
                        setComparisonRunId(event.target.value)
                      }
                      className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400 sm:w-96"
                    >
                      <option value="">
                        {t("siteAudit.comparisonSelectPlaceholder")}
                      </option>
                      {crawlRuns
                        .filter((run) => run.id !== selectedRun?.id)
                        .map((run) => (
                          <option key={run.id} value={run.id}>
                            {crawlEnvironmentLabel(run.environment)} ·{" "}
                            {format(
                              new Date(run.completedAt),
                              "yyyy-MM-dd HH:mm",
                            )}{" "}
                            · {t("crawl.ui.urlsCount", { count: run.result.pages_crawled })} · {run.startUrl}
                          </option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={comparisonByPath}
                        onChange={(event) =>
                          updateComparisonByPath(event.target.checked)
                        }
                        className="accent-emerald-400"
                      />
                      {t("siteAudit.comparisonPathLabel")}
                    </label>
                  </div>
                </div>);
};
