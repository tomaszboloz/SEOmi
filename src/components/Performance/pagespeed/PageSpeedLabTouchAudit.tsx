import React from "react";
import { useTranslation } from "react-i18next";
import { renderLighthouseDescription } from "./PageSpeedHelpers";

export const PageSpeedLabTouchAudit: React.FC<{ psiReport: any }> = ({ psiReport }) => {
  const { t } = useTranslation();
  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50" aria-label={t("pageSpeedUi.touchAuditAria")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{t("pageSpeedUi.touchAuditTitle")}</h3>
        <span className="text-[11px] text-slate-500">
          {psiReport.strategy.toUpperCase()} · {t("pageSpeedUi.labData")} · {psiReport.lighthouseVersion ? `Lighthouse ${psiReport.lighthouseVersion}` : t("pageSpeedUi.versionUnavailable")}
        </span>
      </div>
      {!psiReport.touchTargetAudit ? (
        <p className="p-4 text-xs leading-5 text-amber-200">{t("pageSpeedUi.noTouchAudit")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${psiReport.touchTargetAudit.score === 1 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : psiReport.touchTargetAudit.score === 0 ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
              {psiReport.touchTargetAudit.score === 1 ? t("pageSpeedUi.passed") : psiReport.touchTargetAudit.score === 0 ? t("pageSpeedUi.needsImprovement") : t("pageSpeedUi.noBinaryVerdict", { mode: psiReport.touchTargetAudit.scoreDisplayMode || t("pageSpeedUi.scoreUnavailable") })}
            </span>
            <span className="text-sm text-slate-200">{psiReport.touchTargetAudit.displayValue || psiReport.touchTargetAudit.title}</span>
            <span className="text-[11px] text-slate-500">{t("pageSpeedUi.evidenceCount", { count: psiReport.touchTargetAudit.evidenceCount })}</span>
          </div>
          <p className="px-4 pb-3 text-xs leading-5 text-slate-400">{renderLighthouseDescription(psiReport.touchTargetAudit.description)}</p>
          {psiReport.strategy !== "mobile" && <p className="mx-4 mb-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-200">{t("pageSpeedUi.desktopTouchNotice")}</p>}
          {psiReport.touchTargetAudit.evidence.length > 0 && (
            <div className="overflow-x-auto border-t border-slate-800">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">{t("pageSpeedUi.element")}</th><th className="px-4 py-2.5">{t("pageSpeedUi.targetSize")}</th><th className="px-4 py-2.5">{t("pageSpeedUi.lighthouseEvidence")}</th></tr></thead>
                <tbody className="divide-y divide-slate-800/80">
                  {psiReport.touchTargetAudit.evidence.map((item: any, index: number) => (
                    <tr key={`${item.selector || item.label || "target"}-${index}`}>
                      <td className="max-w-[22rem] break-words px-4 py-3 text-slate-200">
                        {item.label || item.selector || t("pageSpeedUi.targetNumber", { count: index + 1 })}
                        <span className="mt-1 block break-all font-mono text-[10px] text-slate-500">{item.selector}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {item.target || (item.targetSize ? JSON.stringify(item.targetSize) : "—")}
                        <span className="mt-1 block text-[10px] text-slate-500">{item.boundingRect ? JSON.stringify(item.boundingRect) : ""}</span>
                      </td>
                      <td className="max-w-[28rem] break-words px-4 py-3 text-slate-400">
                        {item.failureSummary || item.explanation || item.snippet || t("pageSpeedUi.lighthouseFallback")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {psiReport.touchTargetAudit.evidenceTruncated && <p className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">{t("pageSpeedUi.firstEvidence", { count: psiReport.touchTargetAudit.evidenceCount })}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
};
