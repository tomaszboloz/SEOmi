import React from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useAuditStore } from "@/stores/auditStore";

interface OverviewCoverageFiltersProps {
  localCheckQuery: string;
  setLocalCheckQuery: (val: string) => void;
  localCheckStatus: "all" | "pass" | "warning" | "error" | "not_applicable";
  setLocalCheckStatus: (
    val: "all" | "pass" | "warning" | "error" | "not_applicable",
  ) => void;
  localCheckCategory: string;
  setLocalCheckCategory: (val: string) => void;
  localCheckCategories: string[];
  resetPage: () => void;
}

export const OverviewCoverageFilters: React.FC<OverviewCoverageFiltersProps> = ({
  localCheckQuery,
  setLocalCheckQuery,
  localCheckStatus,
  setLocalCheckStatus,
  localCheckCategory,
  setLocalCheckCategory,
  localCheckCategories,
  resetPage,
}) => {
  const { t } = useTranslation();
  const showOnlyProblems = useAuditStore((s) => s.showOnlyProblems);

  return (
    <div className="mt-4 grid gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 md:grid-cols-[1.3fr_.8fr_.9fr_auto]">
      <label className="relative block">
        <span className="sr-only">
          {t("legacyUi.overview.searchChecks")}
        </span>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <input
          value={localCheckQuery}
          onChange={(event) => {
            setLocalCheckQuery(event.target.value.slice(0, 120));
            resetPage();
          }}
          placeholder={t("legacyUi.overview.searchPlaceholder")}
          className="h-8 w-full rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/60"
        />
      </label>
      <label className="flex items-center">
        <span className="sr-only">
          {t("legacyUi.overview.checkStatus")}
        </span>
        <select
          value={localCheckStatus}
          onChange={(event) => {
            setLocalCheckStatus(
              event.target.value as typeof localCheckStatus,
            );
            resetPage();
          }}
          className="h-8 w-full rounded-lg border border-slate-800 bg-slate-900 px-2 text-xs text-slate-300 outline-none focus:border-emerald-500/60"
        >
          <option value="all">{t("legacyUi.overview.allStatuses")}</option>
          <option value="pass">{t("legacyUi.overview.pass")}</option>
          <option value="warning">{t("legacyUi.overview.warning")}</option>
          <option value="error">{t("legacyUi.overview.error")}</option>
          <option value="not_applicable">
            {t("legacyUi.overview.notApplicable")}
          </option>
        </select>
      </label>
      <label className="flex items-center">
        <span className="sr-only">
          {t("legacyUi.overview.checkCategory")}
        </span>
        <select
          value={localCheckCategory}
          onChange={(event) => {
            setLocalCheckCategory(event.target.value);
            resetPage();
          }}
          className="h-8 w-full rounded-lg border border-slate-800 bg-slate-900 px-2 text-xs text-slate-300 outline-none focus:border-emerald-500/60"
        >
          <option value="all">
            {t("legacyUi.overview.allCategories")}
          </option>
          {localCheckCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 whitespace-nowrap text-[11px] text-slate-400">
        <input
          type="checkbox"
          checked={showOnlyProblems}
          onChange={(event) =>
            useAuditStore
              .getState()
              .setShowOnlyProblems(event.target.checked)
          }
          className="accent-emerald-500"
        />
        {t("legacyUi.overview.problemsOnly")}
      </label>
    </div>
  );
};
