import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, FileText } from "lucide-react";
import type { PageAuditData } from "@/types";
import { OverviewIssueItem } from "./OverviewIssueItem";

interface OverviewIssuesListProps {
  audit: PageAuditData;
}

export const OverviewIssuesList: React.FC<OverviewIssuesListProps> = ({
  audit,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>{t("overview.issuesTitle")}</span>
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300 font-mono">
            {audit.issues.length}
          </span>
        </h3>
      </div>

      <div className="divide-y divide-slate-800/80">
        {audit.issues.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">
              {t("legacyUi.overview.cleanHealth")}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {t("legacyUi.overview.cleanHealthDescription")}
            </p>
          </div>
        ) : (
          audit.issues.map((issue, idx) => (
            <OverviewIssueItem
              key={`${idx}-${issue.code}-${issue.message.slice(0, 20)}`}
              issue={issue}
              audit={audit}
            />
          ))
        )}
      </div>
    </div>
  );
};
