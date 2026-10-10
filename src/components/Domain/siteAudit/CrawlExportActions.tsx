import { Download } from "lucide-react";

import { downloadCrawlHtml, downloadCrawlImagesCsv, downloadCrawlIssuesCsv, downloadCrawlJson, downloadCrawlLinksCsv, downloadCrawlPagesCsv, downloadCrawlResourcesCsv } from "@/services/export";

import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlExportActions = ({ session }: { session: Session }) => {
const { exportCrawlPdf, selectedReportTemplate, selectedRun, t } = session;

if (!selectedRun) return null;
return (<div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          downloadCrawlJson(selectedRun, selectedReportTemplate)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("crawlDeepUi.exportJson")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportCrawlPdf()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("crawlDeepUi.exportPdf")}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCrawlHtml(selectedRun, selectedReportTemplate)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("crawlDeepUi.exportHtml")}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCrawlPagesCsv(selectedRun)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("siteAudit.urlCsv")}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCrawlLinksCsv(selectedRun)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("siteAudit.linksCsv")}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCrawlImagesCsv(selectedRun)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("siteAudit.imagesCsv")}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCrawlResourcesCsv(selectedRun)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("siteAudit.resourcesCsv")}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCrawlIssuesCsv(selectedRun)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("siteAudit.issuesCsv")}
                      </button>
                    </div>);
};
