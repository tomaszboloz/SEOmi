import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";

import { readNavigationSearch, persistNavigationSearch } from "./sidebar/sidebarTypes";
import { useSidebarNavigation } from "./sidebar/useSidebarNavigation";
import { SidebarNewProjectButton } from "./sidebar/SidebarNewProjectButton";
import { SidebarProjectCard } from "./sidebar/SidebarProjectCard";
import { SidebarSearchField } from "./sidebar/SidebarSearchField";
import { SidebarNavSectionComponent } from "./sidebar/SidebarNavSection";
import { SidebarAiCard } from "./sidebar/SidebarAiCard";
import { SidebarCollapseButton } from "./sidebar/SidebarCollapseButton";

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const [navQuery, setNavQuery] = useState("");
  const {
    sidebarCollapsed,
    collapsedSections,
    toggleSidebar,
    hydrateSidebarSections,
    toggleSidebarSection,
  } = useUIStore();
  const { activeProjectId, projects } = useProjectStore();
  const activeProject = projects.find((project) => project.id === activeProjectId);

  const { visibleNavSections, activeSectionKey, activeTab, setActiveTab } = useSidebarNavigation(
    navQuery,
    sidebarCollapsed
  );
  
  const lastNavigatedTab = useRef(activeTab);

  useEffect(() => {
    hydrateSidebarSections(activeProjectId);
  }, [activeProjectId, hydrateSidebarSections]);

  useEffect(() => {
    setNavQuery(readNavigationSearch(activeProjectId));
  }, [activeProjectId]);

  const updateNavQuery = (value: string) => {
    const nextValue = value.slice(0, 120);
    setNavQuery(nextValue);
    persistNavigationSearch(activeProjectId, nextValue);
  };

  const normalizedNavQuery = sidebarCollapsed ? "" : navQuery.trim().toLocaleLowerCase();

  useEffect(() => {
    if (lastNavigatedTab.current === activeTab) return;
    lastNavigatedTab.current = activeTab;
    if (sidebarCollapsed || typeof document === "undefined" || !activeSectionKey) return;
    if (collapsedSections[activeSectionKey]) {
      toggleSidebarSection(activeProjectId, activeSectionKey);
    }
    const frame = window.requestAnimationFrame(() => {
      const activeItem = Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-tab]")).find(
        (element) => element.dataset.sidebarTab === activeTab,
      );
      activeItem?.scrollIntoView?.({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeProjectId, activeSectionKey, activeTab, collapsedSections, sidebarCollapsed, toggleSidebarSection]);

  return (
    <aside
      className={`h-full min-h-0 bg-slate-900/80 border-r border-slate-800/80 flex flex-col justify-between transition-all duration-200 pb-4 shrink-0 ${sidebarCollapsed ? "w-16" : "w-64"}`}
      aria-label={t("sidebar.navigation")}
    >
      <nav className="py-2 px-2 overflow-y-auto space-y-2 flex-1" aria-label={t("sidebar.modules")}>
        <SidebarNewProjectButton sidebarCollapsed={sidebarCollapsed} />
        <SidebarProjectCard sidebarCollapsed={sidebarCollapsed} activeProject={activeProject} />
        {!sidebarCollapsed && <SidebarSearchField navQuery={navQuery} updateNavQuery={updateNavQuery} />}
        {visibleNavSections.map((section) => (
          <SidebarNavSectionComponent
            key={section.key}
            section={section}
            isSectionActive={activeSectionKey === section.key}
            isSectionCollapsed={Boolean(collapsedSections[section.key]) && !normalizedNavQuery}
            sidebarCollapsed={sidebarCollapsed}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onToggle={() => toggleSidebarSection(activeProjectId, section.key)}
          />
        ))}
        {visibleNavSections.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-center text-[11px] leading-5 text-slate-500">
            {t("sidebar.noMenuResults", { query: navQuery })}
          </p>
        )}
        {!sidebarCollapsed && navQuery.trim() && visibleNavSections.length > 0 && (
          <p className="sr-only" role="status" aria-live="polite">
            {t("sidebar.menuResultsCount", { count: visibleNavSections.length })}
          </p>
        )}
      </nav>

      <div className="p-2 border-t border-slate-800/80 space-y-2 shrink-0">
        {!sidebarCollapsed && <SidebarAiCard />}
        <SidebarCollapseButton sidebarCollapsed={sidebarCollapsed} toggleSidebar={toggleSidebar} />
      </div>
    </aside>
  );
};
