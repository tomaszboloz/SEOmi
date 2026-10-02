import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import type { Issue } from "@/types";

interface OverviewIssuesSummaryProps {
  criticalIssues: Issue[];
  warnings: Issue[];
  infoIssues: Issue[];
  totalIssuesCount: number;
}

export const OverviewIssuesSummary: React.FC<OverviewIssuesSummaryProps> = ({
  criticalIssues,
  warnings,
  infoIssues,
  totalIssuesCount,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {t("legacyUi.overview.issuesAudit")}
      </span>
      <div className="grid grid-cols-3 gap-2 my-2">
        <div className="text-center p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <div className="text-lg font-bold text-rose-400">
            {criticalIssues.length}
          </div>
          <div className="text-[10px] text-slate-400 uppercase font-medium">
            {t("legacyUi.overview.critical")}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="text-lg font-bold text-amber-400">
            {warnings.length}
          </div>
          <div className="text-[10px] text-slate-400 uppercase font-medium">
            {t("legacyUi.overview.warnings")}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="text-lg font-bold text-blue-400">
            {infoIssues.length}
          </div>
          <div className="text-[10px] text-slate-400 uppercase font-medium">
            {t("legacyUi.overview.info")}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 flex items-center space-x-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>
          {totalIssuesCount === 0
            ? t("legacyUi.overview.noReportedIssues")
            : t("legacyUi.overview.totalReported", {
                count: totalIssuesCount,
              })}
        </span>
      </div>
    </div>
  );
};
