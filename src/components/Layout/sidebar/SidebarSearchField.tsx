import React from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

interface SidebarSearchFieldProps {
  navQuery: string;
  updateNavQuery: (value: string) => void;
}

export const SidebarSearchField: React.FC<SidebarSearchFieldProps> = ({
  navQuery,
  updateNavQuery,
}) => {
  const { t } = useTranslation();

  return (
    <div className="sticky top-0 z-10 bg-slate-900/95 pb-1 backdrop-blur-sm">
      <label className="sr-only" htmlFor="workspace-nav-search">
        {t("sidebar.menuSearch")}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <input
          id="workspace-nav-search"
          value={navQuery}
          onChange={(event) => updateNavQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") updateNavQuery("");
          }}
          placeholder={t("sidebar.menuSearchPlaceholder")}
          autoComplete="off"
          className="h-8 w-full rounded-lg border border-slate-800 bg-slate-950/70 pl-8 pr-8 text-[11px] text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
        />
        {navQuery && (
          <button
            type="button"
            onClick={() => updateNavQuery("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label={t("sidebar.clearMenuSearch")}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
