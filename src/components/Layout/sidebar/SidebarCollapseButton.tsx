import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SidebarCollapseButtonProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const SidebarCollapseButton: React.FC<SidebarCollapseButtonProps> = ({
  sidebarCollapsed,
  toggleSidebar,
}) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="w-full flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      title={
        sidebarCollapsed ? t("sidebar.expandMenu") : t("sidebar.collapseMenu")
      }
      aria-label={
        sidebarCollapsed ? t("sidebar.expandMenu") : t("sidebar.collapseMenu")
      }
      aria-pressed={sidebarCollapsed}
    >
      {sidebarCollapsed ? (
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      ) : (
        <div className="flex items-center space-x-1.5">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span className="text-[11px] text-slate-400">
            {t("sidebar.collapseMenu")}
          </span>
        </div>
      )}
    </button>
  );
};
