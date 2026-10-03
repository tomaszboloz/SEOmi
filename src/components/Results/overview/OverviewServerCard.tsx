import React from "react";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import type { PageAuditData } from "@/types";

interface OverviewServerCardProps {
  audit: PageAuditData;
}

export const OverviewServerCard: React.FC<OverviewServerCardProps> = ({
  audit,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {t("overview.responseTime")}
      </span>
      <div className="my-2">
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white font-mono">
            {audit.response_time_ms}
          </span>
          <span className="text-xs text-slate-400">
            {t("legacyUi.overview.milliseconds")}
          </span>
        </div>
        <div className="flex items-center space-x-2 mt-1">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
              audit.http_status === 200
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}
          >
            {t("exportUi.statuses.http", { status: audit.http_status })}
          </span>
          <span className="text-xs text-slate-400">
            {audit.redirect_chain.length === 0
              ? t("legacyUi.overview.directResponse")
              : t("legacyUi.overview.redirectHops", {
                  count: audit.redirect_chain.length,
                })}
          </span>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 flex items-center space-x-1 truncate">
        <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="truncate">
          {audit.technical.server ||
            t("legacyUi.overview.serverHeaderMissing")}
        </span>
      </div>
    </div>
  );
};
