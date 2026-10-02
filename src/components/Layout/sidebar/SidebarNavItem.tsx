import React from "react";
import { useTranslation } from "react-i18next";
import { NavItem } from "./sidebarTypes";
import { TabType } from "@/types";

interface SidebarNavItemProps {
  item: NavItem;
  itemIndex: number;
  sidebarCollapsed: boolean;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  item,
  itemIndex,
  sidebarCollapsed,
  activeTab,
  setActiveTab,
}) => {
  const { t } = useTranslation();
  const Icon = item.icon;
  const isActive = Boolean(item.id && activeTab === item.id && !item.action);
  const badgeValue = item.badge?.();

  return (
    <button
      key={`${item.id || item.labelKey}-${itemIndex}`}
      type="button"
      onClick={() => {
        if (item.action) {
          item.action();
        } else if (item.id) {
          setActiveTab(item.id);
        }
      }}
      aria-current={isActive ? "page" : undefined}
      data-sidebar-tab={item.id}
      className={`w-full flex items-center rounded-lg px-2.5 py-2 text-xs font-medium transition-all group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"}`}
      title={sidebarCollapsed ? t(item.labelKey) : undefined}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition ${isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-200"}`}
        aria-hidden="true"
      />
      {!sidebarCollapsed && (
        <span className="ml-2.5 truncate text-left flex-1">
          {t(item.labelKey)}
        </span>
      )}
      {!sidebarCollapsed &&
        badgeValue !== null &&
        badgeValue !== undefined && (
          <span
            className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ${isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"}`}
          >
            {badgeValue}
          </span>
        )}
    </button>
  );
};
