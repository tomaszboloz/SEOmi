import React from "react";
import { useTranslation } from "react-i18next";
import { FolderKanban } from "lucide-react";

interface Project {
  id: string;
  name: string;
  rootUrl?: string | null;
}

interface SidebarProjectCardProps {
  sidebarCollapsed: boolean;
  activeProject?: Project;
}

export const SidebarProjectCard: React.FC<SidebarProjectCardProps> = ({
  sidebarCollapsed,
  activeProject,
}) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => {
        const selector = document.getElementById(
          "workspace-project-switcher",
        ) as HTMLSelectElement | null;
        selector?.focus();
        selector?.click();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const selector = document.getElementById(
            "workspace-project-switcher",
          ) as HTMLSelectElement | null;
          selector?.focus();
          selector?.click();
        }
      }}
      className={`w-full rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] text-left transition hover:border-emerald-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${sidebarCollapsed ? "p-2" : "px-2.5 py-2"}`}
      aria-label={t("projects.activeProject")}
      title={
        activeProject
          ? `${activeProject.name}${activeProject.rootUrl ? ` · ${activeProject.rootUrl}` : ""}`
          : undefined
      }
    >
      <div
        className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-2"}`}
      >
        <FolderKanban
          className="h-4 w-4 shrink-0 text-emerald-300"
          aria-hidden="true"
        />
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300/80">
              {t("projects.activeProject")}
            </p>
            <p className="truncate text-[11px] font-semibold text-slate-200">
              {activeProject?.name || "—"}
            </p>
            {activeProject?.rootUrl && (
              <p className="truncate text-[9px] text-slate-500">
                {activeProject.rootUrl}
              </p>
            )}
          </div>
        )}
      </div>
      {!sidebarCollapsed && (
        <span className="mt-1 block truncate text-left text-[9px] text-slate-500">
          {t("projects.changeProject")}
        </span>
      )}
    </button>
  );
};
