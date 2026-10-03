import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Database } from "lucide-react";
import type { PageAuditData } from "@/types";
import { useAuditStore } from "@/stores/auditStore";

interface OverviewDataForSeoBarProps {
  audit: PageAuditData;
}

export const OverviewDataForSeoBar: React.FC<OverviewDataForSeoBarProps> = ({
  audit,
}) => {
  const { t } = useTranslation();
  const dataforseoData = useAuditStore((s) => s.dataforseoData);
  const dataforseoError = useAuditStore((s) => s.dataforseoError);
  const setActiveTab = useAuditStore((s) => s.setActiveTab);

  let hostname: string;
  try {
    hostname = new URL(audit.final_url || audit.url).hostname;
  } catch {
    hostname = audit.final_url || audit.url;
  }

  return (
    <div className="bg-gradient-to-r from-slate-900/80 via-emerald-950/20 to-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center space-x-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-bold text-white">
              {t("legacyUi.overview.dataforseoTitle")}
            </h4>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {dataforseoData
                ? t("legacyUi.overview.liveData")
                : t("legacyUi.overview.connectionRequired")}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {dataforseoData
              ? t("legacyUi.overview.liveDomainMetrics", {
                  domain: hostname,
                })
              : dataforseoError || t("legacyUi.overview.connectPrompt")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-lg font-black text-white font-mono">
            {dataforseoData
              ? dataforseoData.total_backlinks.toLocaleString()
              : "—"}
          </div>
          <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">
            {t("legacyUi.overview.backlinks")}
          </span>
        </div>

        <div>
          <div className="text-lg font-black text-emerald-400 font-mono">
            {dataforseoData
              ? dataforseoData.referring_domains.toLocaleString()
              : "—"}
          </div>
          <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">
            {t("legacyUi.overview.refDomains")}
          </span>
        </div>

        <div>
          <div className="text-lg font-black text-amber-400 font-mono">
            {dataforseoData ? `${dataforseoData.rank}/100` : "—"}
          </div>
          <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">
            {t("legacyUi.overview.domainRank")}
          </span>
        </div>

        <button
          onClick={() => setActiveTab("dataforseo")}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1 shadow-sm"
        >
          <span>{t("legacyUi.overview.exploreSerp")}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
