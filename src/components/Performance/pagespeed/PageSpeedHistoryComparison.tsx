import React from "react";
import { useTranslation } from "react-i18next";
import { formatDelta } from "../performanceFormatting";

export const PageSpeedHistoryComparison: React.FC<{ comparison: any }> = ({ comparison }) => {
  const { t } = useTranslation();
  if (!comparison) return null;
  return (
    <div className="space-y-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-sky-200">{t("pageSpeedUi.comparisonTitle")}</h3>
        <span className="text-[10px] text-slate-500">
          {t("pageSpeedUi.comparisonMeta", {
            baseline: new Date(comparison.baseline.capturedAt).toLocaleString(),
            current: new Date(comparison.current.capturedAt).toLocaleString(),
          })}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {comparison.categoryDeltas.map((item: any) => (
          <div key={item.key} className="rounded-md border border-slate-800 bg-slate-950/50 p-2">
            <span className="block text-[10px] text-slate-500">{t(`pageSpeedUi.categories.${item.key}`)}</span>
            <span className={`font-mono text-sm ${item.delta !== null && item.delta < 0 ? "text-rose-300" : "text-emerald-300"}`}>
              {formatDelta(item.delta, ` ${t("pageSpeedUi.pointsUnit")}`)}
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {comparison.metricDeltas.filter((item: any) => item.baseline !== null || item.current !== null).map((item: any) => (
          <div key={item.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-2">
            <span className="block text-[10px] text-slate-500">{t(`pageSpeedUi.metricShort.${item.id}`)}</span>
            <span className="font-mono text-xs text-slate-200">{formatDelta(item.delta, ` ${t("pageSpeedUi.ms")}`)}</span>
            <span className="ml-1 text-[10px] text-slate-600">{t("pageSpeedUi.lowerBetter")}</span>
          </div>
        ))}
        {comparison.cruxDeltas.filter((item: any) => item.baseline !== null || item.current !== null).map((item: any) => (
          <div key={`crux-${item.id}`} className="rounded-md border border-slate-800 bg-slate-950/50 p-2">
            <span className="block text-[10px] text-slate-500">{t("uiUnits.crux")} {t(`pageSpeedUi.cruxShort.${item.id}`)}</span>
            <span className="font-mono text-xs text-slate-200">
              {formatDelta(item.delta, item.id.includes("layout") ? "" : ` ${t("pageSpeedUi.ms")}`)}
            </span>
            <span className="ml-1 text-[10px] text-slate-600">{t("uiUnits.percentile75")}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
