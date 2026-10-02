import React from "react";
import { useTranslation } from "react-i18next";
import { Clock, Sparkles } from "lucide-react";
import type { PageAuditData } from "@/types";
import { useUIStore } from "@/stores/uiStore";

interface OverviewContentCardProps {
  audit: PageAuditData;
}

export const OverviewContentCard: React.FC<OverviewContentCardProps> = ({
  audit,
}) => {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {t("overview.wordCount")}
        </span>
        <button
          onClick={() => openModal("ai")}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-1"
        >
          <Sparkles className="w-3 h-3" />
          <span>{t("legacyUi.overview.aiFix")}</span>
        </button>
      </div>
      <div className="my-2">
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white font-mono">
            {audit.content_stats.word_count}
          </span>
          <span className="text-xs text-slate-400">
            {t("legacyUi.overview.words")}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>
            {t("legacyUi.overview.readingTime", {
              count: audit.content_stats.reading_time_minutes,
            })}
          </span>
        </p>
      </div>
      <div className="text-[11px] text-slate-400">
        {t("legacyUi.overview.textRatio")}{" "}
        <span className="text-white font-medium">
          {audit.content_stats.text_ratio_percent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};
