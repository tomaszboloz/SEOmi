import { DEFAULT_CRAWL_REPORT_TEMPLATE } from "@/services/reportTemplates";

import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlReportTemplateSelector = ({ session }: { session: Session }) => {
const { createReportTemplate, removeReportTemplate, reportTemplateName, reportTemplates, selectReportTemplate, selectedReportTemplate, setReportTemplateName, t } = session;

return (<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                        <label className="text-[11px] text-slate-400">
                          {t("siteAudit.activeTemplate")}
                          <select
                            aria-label={t("siteAudit.activeTemplateAria")}
                            value={selectedReportTemplate.id}
                            onChange={(event) =>
                              selectReportTemplate(event.target.value)
                            }
                            className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
                          >
                            <option value={DEFAULT_CRAWL_REPORT_TEMPLATE.id}>
                              {DEFAULT_CRAWL_REPORT_TEMPLATE.name}
                            </option>
                            {reportTemplates
                              .filter((template) => !template.builtIn)
                              .map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="text-[11px] text-slate-400">
                          {t("siteAudit.newTemplateName")}
                          <input
                            aria-label={t("siteAudit.newTemplateAria")}
                            value={reportTemplateName}
                            onChange={(event) =>
                              setReportTemplateName(event.target.value)
                            }
                            placeholder={t("siteAudit.templatePlaceholder")}
                            className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white placeholder:text-slate-600"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={createReportTemplate}
                          className="self-end rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          {t("siteAudit.saveAsNew")}
                        </button>
                        {!selectedReportTemplate.builtIn && (
                          <button
                            type="button"
                            onClick={removeReportTemplate}
                            className="self-end rounded-md border border-rose-500/30 px-3 py-2 text-xs text-rose-300 hover:border-rose-400"
                          >
                            {t("siteAudit.remove")}
                          </button>
                        )}
                      </div>);
};
