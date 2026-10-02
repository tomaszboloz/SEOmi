import React from "react";
import { useTranslation } from "react-i18next";
import { TrendChart } from "@/components/Charts/TrendChart";
import { PageSpeedSnapshot } from "@/services/pagespeedHistory";

export const PageSpeedHistoryCharts: React.FC<{
  chronologicalHistory: PageSpeedSnapshot[];
  latestSnapshot: PageSpeedSnapshot | null;
}> = ({ chronologicalHistory, latestSnapshot }) => {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {(["performance", "accessibility", "bestPractices", "seo"] as const).map((key) => (
        <article key={key} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{t(`pageSpeedUi.categories.${key}`)}</span>
            <span className="text-[10px] text-slate-600">
              {t("pageSpeedUi.points", { count: chronologicalHistory.length })}
            </span>
          </div>
          <TrendChart
            values={chronologicalHistory.map((snapshot) => snapshot.pageSpeed?.categories[key] ?? null)}
            label={t("pageSpeedUi.trendAria", { metric: t(`pageSpeedUi.categories.${key}`) })}
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>{chronologicalHistory[0]?.pageSpeed?.categories[key] ?? "—"}</span>
            <span>{latestSnapshot?.pageSpeed?.categories[key] ?? "—"}</span>
          </div>
        </article>
      ))}
    </div>
  );
};
