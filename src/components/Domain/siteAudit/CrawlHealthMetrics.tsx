import { Layers, CheckCircle2, AlertTriangle, AlertCircle, Clock } from "lucide-react";

import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlHealthMetrics = ({ session }: { session: Session }) => {
const { crawlResult, t } = session;

if (!crawlResult) return null;
return (<div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t("siteAudit.healthScore")}</span>
                    </div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {crawlResult.health_score} / 100
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {t("siteAudit.healthIndex")}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>{t("siteAudit.pagesCrawled")}</span>
                    </div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {crawlResult.pages_crawled}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {t("siteAudit.internalTargets")}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>{t("siteAudit.criticalIssues")}</span>
                    </div>
                    <div className="text-2xl font-bold text-rose-400 font-mono">
                      {crawlResult.critical_count}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {t("siteAudit.immediateAction")}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t("siteAudit.warningLabel")}</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-400 font-mono">
                      {crawlResult.warning_count}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {t("siteAudit.suboptimalPractices")}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>{t("siteAudit.crawlTime")}</span>
                    </div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {crawlResult.duration_ms} {t("performance.milliseconds")}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {t("siteAudit.asynchronousExecution")}
                    </span>
                  </div>
                </div>);
};
