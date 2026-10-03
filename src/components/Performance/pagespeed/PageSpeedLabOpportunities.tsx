import React from "react";
import { useTranslation } from "react-i18next";
import { renderLighthouseDescription } from "./PageSpeedHelpers";

export const PageSpeedLabOpportunities: React.FC<{ psiReport: any }> = ({ psiReport }) => {
  const { t } = useTranslation();
  if (!psiReport.opportunities || psiReport.opportunities.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{t("pageSpeedUi.opportunities")}</h3>
      <div className="space-y-2">
        {psiReport.opportunities.map((item: any) => (
          <article key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-200">
              <span>{item.title}</span>
              <span className="text-xs text-amber-300">
                {item.displayValue || (item.score === null ? t("pageSpeedUi.diagnostic") : `${Math.round(item.score * 100)}%`)}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{renderLighthouseDescription(item.description)}</p>
          </article>
        ))}
      </div>
    </div>
  );
};
