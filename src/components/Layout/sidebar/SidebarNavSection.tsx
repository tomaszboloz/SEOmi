import React from "react";
import { NavSection, sectionId } from "./sidebarTypes";
import { SidebarSectionHeader } from "./SidebarSectionHeader";
import { SidebarNavItem } from "./SidebarNavItem";
import { TabType } from "@/types";

interface SidebarNavSectionProps {
  section: NavSection;
  isSectionActive: boolean;
  isSectionCollapsed: boolean;
  sidebarCollapsed: boolean;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onToggle: () => void;
}

export const SidebarNavSectionComponent: React.FC<SidebarNavSectionProps> = ({
  section,
  isSectionActive,
  isSectionCollapsed,
  sidebarCollapsed,
  activeTab,
  setActiveTab,
  onToggle,
}) => {
  const headingId = sectionId(section.key);
  const sectionBadge = section.badge?.();

  return (
    <section
      className={`space-y-1 rounded-xl ${isSectionActive && !sidebarCollapsed ? "bg-slate-800/20" : ""}`}
    >
      {!sidebarCollapsed && (
        <SidebarSectionHeader
          section={section}
          isSectionActive={isSectionActive}
          isSectionCollapsed={isSectionCollapsed}
          headingId={headingId}
          sectionBadge={sectionBadge}
          onToggle={onToggle}
        />
      )}

      <div
        id={headingId}
        className="space-y-0.5"
        hidden={!sidebarCollapsed && isSectionCollapsed}
      >
        {section.items.map((item, itemIndex) => (
          <SidebarNavItem
            key={`${item.id || item.labelKey}-${itemIndex}`}
            item={item}
            itemIndex={itemIndex}
            sidebarCollapsed={sidebarCollapsed}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        ))}
      </div>
    </section>
  );
};
