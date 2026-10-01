import { crawlErrorLabel } from "@/services/crawlErrors";

import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlResultsOverview = ({ session }: { session: Session }) => {
const { activeErrorKindFilter, availableErrorKinds, filteredPages, setErrorKindFilter, setSeverityFilter, severityFilter, t } = session;

return (<div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    {t("siteAudit.pagesInventory", {
                      count: filteredPages.length,
                    })}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {t("siteAudit.severity")}:
                    </span>
                    {(["all", "Critical", "Warning", "Info"] as const).map(
                      (mode) => (
                        <button
                          key={mode}
                          onClick={() => setSeverityFilter(mode)}
                          className={`text-xs px-2.5 py-1 rounded-md transition ${
                            severityFilter === mode
                              ? "bg-emerald-500/20 text-emerald-300 font-medium"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          {mode === "all"
                            ? t("siteAudit.allPages")
                            : t(`siteAudit.severityValues.${mode}`)}
                        </button>
                      ),
                    )}
                    <label className="ml-1 flex items-center gap-2 text-xs text-slate-400">
                      {t("siteAudit.errorType")}
                      <select
                        value={activeErrorKindFilter}
                        onChange={(event) =>
                          setErrorKindFilter(event.target.value)
                        }
                        className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                      >
                        <option value="all">{t("siteAudit.all")}</option>
                        {availableErrorKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {crawlErrorLabel(kind)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>);
};
