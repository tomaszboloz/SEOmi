import React from "react";
import { useTranslation } from "react-i18next";
import { formatCruxValue, cruxCategory } from "../cruxEvidence";
import { appLocale } from '@/services/localeFormat';

export const PageSpeedField: React.FC<{ session: any; cruxMetrics: any; collectionPeriod: string | null }> = ({
  session,
  cruxMetrics,
  collectionPeriod,
}) => {
  const { t } = useTranslation();
  if (!session.crux) return null;
  return (
    <section className="space-y-4" aria-label={t("pageSpeedUi.cruxResultsAria")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">{t("pageSpeedUi.fieldTitle")}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {session.crux.source} · {session.crux.scope} · {session.crux.formFactor} · {t("pageSpeedUi.fetchedAt")} {new Date(session.crux.fetchedAt).toLocaleString(appLocale())}
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {collectionPeriod ? `${t("pageSpeedUi.window")}: ${collectionPeriod}` : t("pageSpeedUi.apiCollectionPeriod")}
        </span>
      </div>
      {cruxMetrics ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">{t("pageSpeedUi.metric")}</th><th className="px-4 py-3">{t("pageSpeedUi.percentile75")}</th><th className="px-4 py-3">{t("pageSpeedUi.apiRating")}</th><th className="px-4 py-3">{t("pageSpeedUi.populationShares")}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/60">
              {Object.entries(cruxMetrics).map(([key, metric]: [string, any]) => {
                const histogram = Array.isArray(metric.histogram) ? metric.histogram : [];
                return (
                  <tr key={key}>
                    <td className="px-4 py-3 font-medium text-slate-200">{t(`pageSpeedUi.cruxMetrics.${key}`)}</td>
                    <td className="px-4 py-3 font-mono text-white">{formatCruxValue({ ...metric, metric: key }, t)}</td>
                    <td className="px-4 py-3 text-slate-300">{cruxCategory({ ...metric, metric: key }, t)}</td>
                    <td className="px-4 py-3">
                      <div className="flex h-2 min-w-40 overflow-hidden rounded-full bg-slate-800" title={t("pageSpeedUi.populationHistogram", { values: histogram.map((bin: any) => `${Math.round((bin.density || 0) * 100)}%`).join(" / ") })}>
                        {histogram.map((bin: any, index: number) => <span key={index} style={{ width: `${Math.max(0, (bin.density || 0) * 100)}%` }} className={index === 0 ? "bg-emerald-400" : index === histogram.length - 1 ? "bg-rose-400" : "bg-amber-400"} />)}
                      </div>
                      <span className="mt-1 block text-[10px] text-slate-500">{histogram.map((bin: any) => `${(bin.density * 100).toFixed(0)}%`).join(" / ") || t("pageSpeedUi.noHistogram")}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">{t("pageSpeedUi.noCruxMetrics")}</p>
      )}
    </section>
  );
};
