import { create } from 'zustand';
import { readJsonStorage, readStorage, writeJsonStorage, writeStorage } from '@/services/storage';

export type ModalType = 'settings' | 'ai' | 'login' | 'subscription' | 'history' | 'create-project' | null;

const SIDEBAR_COLLAPSED_KEY = 'seomi_sidebar_collapsed_v1';
const sidebarSectionsKey = (projectId: string) => `seomi_project_${projectId}_sidebar_sections_v1`;

const readSidebarCollapsed = (): boolean => {
  return readStorage(SIDEBAR_COLLAPSED_KEY) === 'true';
};

const readSidebarSections = (projectId: string | null): Record<string, boolean> => {
  if (!projectId) return {};
  try {
    const value = readJsonStorage(sidebarSectionsKey(projectId), {});
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const sections = Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    );
    // The audit and crawler groups were intentionally combined to keep the
    // first workspace step coherent. Preserve an existing user's collapsed
    // preference without rewriting storage or requiring a migration.
    if (sections['audit-workspace'] === undefined && (sections['page-audit'] || sections['crawl-technical'])) {
      sections['audit-workspace'] = true;
    }
    return sections;
  } catch {
    return {};
  }
};

const persistSidebarSections = (projectId: string | null, sections: Record<string, boolean>) => {
  if (!projectId) return;
  writeJsonStorage(sidebarSectionsKey(projectId), sections);
};

interface UIState {
  sidebarCollapsed: boolean;
  collapsedSections: Record<string, boolean>;
  activeModal: ModalType;
  commandPaletteOpen: boolean;
  splitPaneRatio: number; // percentage (e.g. 50)

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  hydrateSidebarSections: (projectId: string | null) => void;
  toggleSidebarSection: (projectId: string | null, sectionKey: string) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setSplitPaneRatio: (ratio: number) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: readSidebarCollapsed(),
  collapsedSections: {},
  activeModal: null,
  commandPaletteOpen: false,
  splitPaneRatio: 50,

  toggleSidebar: () => {
    const collapsed = !get().sidebarCollapsed;
    writeStorage(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },
  setSidebarCollapsed: (collapsed) => {
    writeStorage(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },
  hydrateSidebarSections: (projectId) => set({ collapsedSections: readSidebarSections(projectId) }),
  toggleSidebarSection: (projectId, sectionKey) => {
    const collapsedSections = {
      ...get().collapsedSections,
      [sectionKey]: !get().collapsedSections[sectionKey],
    };
    persistSidebarSections(projectId, collapsedSections);
    set({ collapsedSections });
  },
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  setSplitPaneRatio: (ratio) => set({ splitPaneRatio: ratio }),
}));
