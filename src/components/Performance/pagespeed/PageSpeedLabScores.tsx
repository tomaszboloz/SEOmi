import React from "react";
import { useTranslation } from "react-i18next";
import { scoreColor } from "../performanceFormatting";
import { PSI_METRICS } from "../performanceSession";

export const PageSpeedLabScores: React.FC<{ psiReport: any }> = ({ psiReport }) => {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["performance", "performance"],
            ["accessibility", "accessibility"],
            ["bestPractices", "bestPractices"],
            ["seo", "seo"],
          ] as const
        ).map(([key, label]) => {
          const score = psiReport.categories[key];
          return (
            <article key={key} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">{t(`pageSpeedUi.categories.${label}`)}</span>
                <span className="font-mono text-xl font-bold text-white">{score === null ? "—" : score}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full ${scoreColor(score)}`} style={{ width: `${score ?? 0}%` }} />
              </div>
            </article>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PSI_METRICS.map(([id, label]) => {
          const metric = psiReport.metrics[id];
          return (
            <article key={id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="text-xs text-slate-400">{t(`pageSpeedUi.metrics.${label}`)}</h3>
              <p className="mt-1 text-lg font-semibold text-white">{metric?.displayValue || t("pageSpeedUi.noData")}</p>
              {metric?.score !== null && metric?.score !== undefined && (
                <span className="text-[11px] text-slate-500">
                  {t("pageSpeedUi.lighthouseScore")}: {Math.round(metric.score * 100)}%
                </span>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
};
