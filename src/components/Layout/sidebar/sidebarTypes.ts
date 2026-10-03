import { TabType } from "@/types";
import { readStorage, writeStorage } from "@/services/storage";

export interface NavItem {
  id?: TabType;
  /** Search vocabulary is intentionally kept beside the visible label. */
  keywords: string;
  labelKey: string;
  icon: React.ElementType;
  badge?: () => number | string | null;
  action?: () => void;
}

export interface NavSection {
  key: string;
  titleKey: string;
  items: NavItem[];
  badge?: () => number | string | null;
}

export const sectionId = (key: string) => `sidebar-section-${key}`;

export const navigationSearchKey = (projectId: string | null) =>
  projectId ? `seomi_project_${projectId}_sidebar_search_v1` : null;

export const readNavigationSearch = (projectId: string | null): string => {
  const key = navigationSearchKey(projectId);
  if (!key) return "";
  return (readStorage(key) || "").slice(0, 120);
};

export const persistNavigationSearch = (
  projectId: string | null,
  value: string,
): void => {
  const key = navigationSearchKey(projectId);
  if (!key) return;
  writeStorage(key, value.slice(0, 120));
};

export const pageAuditTabIds: TabType[] = [
  "overview",
  "dataforseo",
  "social",
  "headings",
  "metadata",
  "images",
  "links",
  "security",
  "structured",
  "amp",
  "performance",
];
