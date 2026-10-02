import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { NavSection } from "./sidebarTypes";

interface SidebarSectionHeaderProps {
  section: NavSection;
  isSectionActive: boolean;
  isSectionCollapsed: boolean;
  headingId: string;
  sectionBadge?: string | number | null;
  onToggle: () => void;
}

export const SidebarSectionHeader: React.FC<SidebarSectionHeaderProps> = ({
  section,
  isSectionActive,
  isSectionCollapsed,
  headingId,
  sectionBadge,
  onToggle,
}) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${isSectionActive ? "text-emerald-300" : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"}`}
      aria-expanded={!isSectionCollapsed}
      aria-controls={headingId}
    >
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        {isSectionActive && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            aria-hidden="true"
          />
        )}
        {t(section.titleKey)}
      </span>
      <span className="ml-2 flex shrink-0 items-center gap-1.5">
        {sectionBadge !== null && sectionBadge !== undefined && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-mono ${isSectionActive ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"}`}
          >
            {sectionBadge}
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${isSectionCollapsed ? "-rotate-90" : "rotate-0"}`}
          aria-hidden="true"
        />
      </span>
    </button>
  );
};
