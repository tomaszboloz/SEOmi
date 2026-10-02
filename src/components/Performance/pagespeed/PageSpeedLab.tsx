import React from "react";
import { useTranslation } from "react-i18next";
import { PageSpeedLabScores } from "./PageSpeedLabScores";
import { PageSpeedLabOpportunities } from "./PageSpeedLabOpportunities";
import { PageSpeedLabTouchAudit } from "./PageSpeedLabTouchAudit";
import { PageSpeedLabImageAudit } from "./PageSpeedLabImageAudit";

export const PageSpeedLab: React.FC<{ psiReport: any }> = ({ psiReport }) => {
  const { t } = useTranslation();
  if (!psiReport) return null;
  return (
    <section className="space-y-4" aria-label={t("pageSpeedUi.psiResultsAria")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-white">{t("pageSpeedUi.labTitle")}</h2>
        <span className="text-xs text-slate-500">
          {psiReport.source} · {psiReport.strategy} · {psiReport.fetchedAt || t("pageSpeedUi.apiTimeUnavailable")}
          {psiReport.lighthouseVersion ? ` · Lighthouse ${psiReport.lighthouseVersion}` : ""}
        </span>
      </div>
      <PageSpeedLabScores psiReport={psiReport} />
      <PageSpeedLabOpportunities psiReport={psiReport} />
      <PageSpeedLabTouchAudit psiReport={psiReport} />
      <PageSpeedLabImageAudit psiReport={psiReport} />
      {psiReport.fieldExperience && (
        <p className="text-xs text-slate-500">
          {t("pageSpeedUi.fieldIncluded", {
            category: String(psiReport.fieldExperience["overall_category"] || t("pageSpeedUi.noFieldData")),
          })}
        </p>
      )}
    </section>
  );
};
