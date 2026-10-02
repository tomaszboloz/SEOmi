import React from "react";
import { useTranslation } from "react-i18next";
import type { PageAuditData } from "@/types";

interface OverviewScoreGaugeProps {
  audit: PageAuditData;
  criticalCount: number;
}

export const OverviewScoreGauge: React.FC<OverviewScoreGaugeProps> = ({
  audit,
  criticalCount,
}) => {
  const { t } = useTranslation();

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400 stroke-emerald-500";
    if (score >= 65) return "text-amber-400 stroke-amber-500";
    return "text-rose-400 stroke-rose-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 65) return "bg-amber-500/10 border-amber-500/20";
    return "bg-rose-500/10 border-rose-500/20";
  };

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (audit.health_score / 100) * circumference;

  return (
    <div
      className={`min-w-0 p-5 rounded-2xl border flex items-center space-x-5 ${getScoreBg(audit.health_score)}`}
    >
      <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            className={`transition-all duration-1000 ease-out ${getScoreColor(audit.health_score)}`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span
            className={`text-2xl font-black ${getScoreColor(audit.health_score).split(" ")[0]}`}
          >
            {audit.health_score}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
            / 100
          </span>
        </div>
      </div>

      <div className="min-w-0 [overflow-wrap:anywhere]">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {t("overview.healthScore")}
        </span>
        <h3 className="text-lg font-bold text-white mt-0.5">
          {audit.health_score >= 85
            ? t("legacyUi.overview.excellent")
            : audit.health_score >= 65
              ? t("legacyUi.overview.attention")
              : t("legacyUi.overview.poor")}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {audit.issues.length === 0
            ? t("legacyUi.overview.noIssuesRule")
            : t("legacyUi.overview.criticalFound", {
                count: criticalCount,
              })}
        </p>
      </div>
    </div>
  );
};
