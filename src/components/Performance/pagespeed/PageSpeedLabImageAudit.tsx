import React from "react";
import { useTranslation } from "react-i18next";
import { renderLighthouseDescription } from "./PageSpeedHelpers";
import { formatBytes } from "../performanceFormatting";

export const PageSpeedLabImageAudit: React.FC<{ psiReport: any }> = ({ psiReport }) => {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4" aria-label={t("pageSpeedUi.imageAuditAria")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{t("pageSpeedUi.imageAuditTitle")}</h3>
        <span className="text-[11px] text-slate-500">{t("pageSpeedUi.imageAuditDescription")}</span>
      </div>
      {(psiReport.imageOptimizationAudits?.length ?? 0) === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs leading-5 text-amber-200">{t("pageSpeedUi.noImageAudit")}</p>
      ) : (
        <div className="space-y-2">
          {psiReport.imageOptimizationAudits?.map((audit: any) => (
            <article key={audit.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-slate-100">{audit.title}</h4>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {audit.score === 0 ? <span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-300">{t("pageSpeedUi.problemDetected")}</span> : audit.score === 1 ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">{t("pageSpeedUi.passed")}</span> : <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{t("pageSpeedUi.noVerdict", { mode: audit.scoreDisplayMode || t("pageSpeedUi.scoreUnavailable") })}</span>}
                  <span className="text-slate-400">{audit.displayValue || t("pageSpeedUi.noApiSummary")}</span>
                </div>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{renderLighthouseDescription(audit.description)}</p>
              {audit.overallSavingsBytes !== null && <p className="mt-2 text-xs text-amber-200">{t("pageSpeedUi.estimatedSavings", { value: formatBytes(audit.overallSavingsBytes) })}</p>}
              {audit.evidence.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {audit.evidence.map((item: any, index: number) => (
                    <div key={`${item.url || item.selector || audit.id}-${index}`} className="grid gap-1 rounded-md bg-slate-900/70 p-2 text-[11px] sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
                      <div className="min-w-0 break-all text-slate-300">{item.url || item.label || item.selector || t("pageSpeedUi.elementNumber", { count: index + 1 })}<span className="mt-0.5 block font-mono text-[10px] text-slate-500">{item.selector}</span></div>
                      <span className="text-slate-400">{t("pageSpeedUi.transfer")}: {formatBytes(item.totalBytes) || "—"}</span>
                      <span className="text-amber-200">{t("pageSpeedUi.potential")}: {formatBytes(item.wastedBytes) || "—"}{item.wastedPercent === null ? "" : ` (${item.wastedPercent.toFixed(1)}%)`}</span>
                    </div>
                  ))}
                  {audit.evidenceTruncated && <p className="text-[10px] text-slate-500">{t("pageSpeedUi.firstElements", { count: audit.evidenceCount })}</p>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
