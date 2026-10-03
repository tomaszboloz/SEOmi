import { useTranslation } from "react-i18next";
import { useAuditStore } from "@/stores/auditStore";
import { useUIStore } from "@/stores/uiStore";
import { useWorkspaceIndicatorsStore } from "@/stores/workspaceIndicatorsStore";
import { writeEphemeralStorage } from "@/services/storage";
import { WORKSPACE_NAVIGATION, type WorkspaceNavItemDefinition } from "@/components/Layout/navigation";
import { NavSection, pageAuditTabIds } from "./sidebarTypes";

export const useSidebarNavigation = (navQuery: string, sidebarCollapsed: boolean) => {
  const { t } = useTranslation();
  const { currentAudit, activeTab, setActiveTab, isLoading, isBatchRunning } = useAuditStore();
  const { openModal } = useUIStore();
  
  const {
    savedKeywordsCount,
    trackedRanksCount,
    isCrawling,
    crawlProgress,
    crawlRunsCount,
  } = useWorkspaceIndicatorsStore();

  const navSections: NavSection[] = WORKSPACE_NAVIGATION.map((section) => ({
    key: section.key,
    titleKey: section.titleKey,
    badge:
      section.key === "audit-workspace"
        ? () =>
            isCrawling
              ? `${Math.round(crawlProgress)}%`
              : isLoading || isBatchRunning
                ? t("sidebar.running")
                : currentAudit
                  ? currentAudit.health_score
                  : crawlRunsCount > 0
                    ? crawlRunsCount
                    : null
        : undefined,
    items: section.items.map((definition: WorkspaceNavItemDefinition) => ({
      id: definition.tab,
      keywords: definition.keywords,
      labelKey: definition.labelKey,
      icon: definition.icon,
      badge:
        definition.key === "overview"
          ? () => (currentAudit ? currentAudit.health_score : null)
          : definition.key === "saved-keywords"
            ? () => (savedKeywordsCount > 0 ? savedKeywordsCount : null)
            : definition.key === "rank-tracking"
              ? () => (trackedRanksCount > 0 ? trackedRanksCount : null)
              : undefined,
      action:
        definition.action === "semantic-map"
          ? () => {
              writeEphemeralStorage("seomi_open_crawl_map_v1", "1");
              setActiveTab("site-audit");
              window.dispatchEvent(new Event("seomi:open-crawl-map"));
            }
          : definition.action === "ai-assistant"
            ? () => openModal("ai")
            : definition.action === "ai-connection"
              ? () => openModal("subscription")
              : definition.action === "history"
                ? () => openModal("history")
                : definition.action === "settings"
                  ? () => openModal("settings")
                  : undefined,
    })),
  }));

  const normalizedNavQuery = sidebarCollapsed ? "" : navQuery.trim().toLocaleLowerCase();
  const visibleNavSections = navSections
    .map((section) => {
      if (!normalizedNavQuery) return section;
      const sectionMatches = t(section.titleKey).toLocaleLowerCase().includes(normalizedNavQuery);
      const items = sectionMatches
        ? section.items
        : section.items.filter((item) =>
            `${t(item.labelKey)} ${item.keywords}`.toLocaleLowerCase().includes(normalizedNavQuery),
          );
      return items.length > 0 ? { ...section, items } : null;
    })
    .filter((section): section is NavSection => section !== null);

  const activeSectionKey =
    pageAuditTabIds.includes(activeTab) && activeTab !== "dataforseo"
      ? "audit-workspace"
      : navSections.find((section) => section.items.some((item) => item.id === activeTab))?.key;

  return { visibleNavSections, activeSectionKey, activeTab, setActiveTab };
};
