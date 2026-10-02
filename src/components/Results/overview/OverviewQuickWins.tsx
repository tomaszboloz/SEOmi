import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

interface OverviewQuickWinsProps {
  issuesCount: number;
}

export const OverviewQuickWins: React.FC<OverviewQuickWinsProps> = ({
  issuesCount,
}) => {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);

  if (issuesCount === 0) {
    return null;
  }

  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-emerald-950/30 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">
            {t("overview.quickWins")}
          </h4>
          <p className="text-xs text-slate-400">
            {t("legacyUi.overview.quickWinsDescription")}
          </p>
        </div>
      </div>
      <button
        onClick={() => openModal("ai")}
        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm shadow-emerald-600/30 shrink-0 flex items-center space-x-1"
      >
        <span>{t("legacyUi.overview.launchAi")}</span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
