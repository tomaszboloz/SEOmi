import React from "react";
import { useTranslation } from "react-i18next";
import type { LocalAuditCheck } from "@/services/auditChecks";

interface OverviewCoverageCardProps {
  item: LocalAuditCheck;
}

export const OverviewCoverageCard: React.FC<OverviewCoverageCardProps> = ({
  item,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`rounded-lg border p-3 ${
        item.status === "pass"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : item.status === "error"
            ? "border-rose-500/20 bg-rose-500/5"
            : item.status === "warning"
              ? "border-amber-500/20 bg-amber-500/5"
              : "border-slate-800 bg-slate-950/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate text-xs font-medium text-slate-200"
          title={item.label}
        >
          {item.label}
        </span>
        <span
          className={`shrink-0 text-[10px] font-semibold uppercase ${
            item.status === "pass"
              ? "text-emerald-300"
              : item.status === "error"
                ? "text-rose-300"
                : item.status === "warning"
                  ? "text-amber-300"
                  : "text-slate-500"
          }`}
        >
          {item.status === "pass"
            ? t("legacyUi.overview.pass")
            : item.status === "error"
              ? t("legacyUi.overview.error")
              : item.status === "warning"
                ? t("legacyUi.overview.warning")
                : t("legacyUi.overview.notApplicable")}
        </span>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">
        {item.category}
      </p>
      <p
        className="mt-1 truncate text-[11px] text-slate-400"
        title={item.evidence}
      >
        {item.evidence}
      </p>
    </div>
  );
};
