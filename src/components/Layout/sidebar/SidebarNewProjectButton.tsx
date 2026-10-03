import React from "react";
import { useTranslation } from "react-i18next";
import { FolderPlus } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

interface SidebarNewProjectButtonProps {
  sidebarCollapsed: boolean;
}

export const SidebarNewProjectButton: React.FC<SidebarNewProjectButtonProps> = ({
  sidebarCollapsed,
}) => {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);

  return (
    <button
      type="button"
      onClick={() => openModal("create-project")}
      className={`flex w-full items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2 text-xs font-semibold text-emerald-300 transition hover:border-emerald-400/55 hover:bg-emerald-500/15 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${sidebarCollapsed ? "justify-center" : "gap-2"}`}
      title={t("sidebar.newProject")}
      aria-label={t("sidebar.newProject")}
    >
      <FolderPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!sidebarCollapsed && <span>{t("sidebar.newProject")}</span>}
    </button>
  );
};
