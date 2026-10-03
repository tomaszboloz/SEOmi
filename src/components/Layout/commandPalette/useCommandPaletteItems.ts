import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { FolderPlus } from 'lucide-react';
import { WORKSPACE_NAVIGATION } from '@/components/Layout/navigation';
import { writeEphemeralStorage } from '@/services/storage';
import type { SeoProject, TabType } from '@/types';
import { type PaletteItem, normalize } from './commandPaletteTypes';

interface UseCommandPaletteItemsParams {
  query: string;
  activeProjectId: string | null;
  projects: SeoProject[];
  selectProject: (id: string) => void;
  setActiveTab: (tab: TabType) => void;
  openModal: (modal: any) => void;
  run: (action: () => void) => void;
  t: TFunction;
}

export function useCommandPaletteItems({
  query,
  activeProjectId,
  projects,
  selectProject,
  setActiveTab,
  openModal,
  run,
  t,
}: UseCommandPaletteItemsParams): { items: PaletteItem[]; filteredItems: PaletteItem[] } {
  const items = useMemo<PaletteItem[]>(() => {
    const navigate = (tab: TabType) => run(() => setActiveTab(tab));

    const moduleItems: PaletteItem[] = WORKSPACE_NAVIGATION.flatMap((section) =>
      section.items
        .filter((definition) => definition.tab)
        .map((definition) => ({
          id: definition.key,
          label: t(definition.labelKey),
          keywords: definition.keywords,
          group: t(section.titleKey),
          icon: definition.icon,
          action: () => {
            if (definition.action === 'semantic-map') {
              writeEphemeralStorage('seomi_open_crawl_map_v1', '1');
            }
            navigate(definition.tab as TabType);
            if (definition.action === 'semantic-map') {
              window.dispatchEvent(new Event('seomi:open-crawl-map'));
            }
          },
        })),
    );

    const workspaceActions: PaletteItem[] = [
      { id: 'history', label: t('sidebar.history'), group: t('sidebar.workspaceTools'), keywords: 'history audit run', icon: WORKSPACE_NAVIGATION.find((section) => section.key === 'workspace-tools')?.items.find((item) => item.key === 'history')?.icon ?? FolderPlus, action: () => run(() => openModal('history')) },
      { id: 'settings', label: t('sidebar.settings'), group: t('sidebar.workspaceTools'), keywords: 'settings integrations dataforseo google', icon: WORKSPACE_NAVIGATION.find((section) => section.key === 'workspace-tools')?.items.find((item) => item.key === 'settings')?.icon ?? FolderPlus, action: () => run(() => openModal('settings')) },
      { id: 'ai-assistant', label: t('sidebar.aiAssistant'), group: t('sidebar.workspaceTools'), keywords: 'AI schema metadata', icon: WORKSPACE_NAVIGATION.find((section) => section.key === 'workspace-tools')?.items.find((item) => item.key === 'ai-assistant')?.icon ?? FolderPlus, action: () => run(() => openModal('ai')) },
      { id: 'ai-connection', label: t('sidebar.aiConnection'), group: t('sidebar.workspaceTools'), keywords: 'AI Claude Codex Gemini connection', icon: WORKSPACE_NAVIGATION.find((section) => section.key === 'workspace-tools')?.items.find((item) => item.key === 'ai-connection')?.icon ?? FolderPlus, action: () => run(() => openModal('subscription')) },
    ];

    const projectItems: PaletteItem[] = [
      {
        id: 'new-project',
        label: t('projects.createNew'),
        group: t('commandPalette.projectsGroup'),
        keywords: 'project workspace domain projekt workspace domena',
        icon: FolderPlus,
        action: () => run(() => openModal('create-project')),
      },
      ...projects.map((project) => ({
        id: `project:${project.id}`,
        label: project.id === activeProjectId
          ? `${project.name} · ${t('commandPalette.active')}`
          : project.name,
        group: t('commandPalette.projectsGroup'),
        keywords: `${project.rootUrl || ''} ${project.id}`,
        icon: FolderPlus,
        action: () => run(() => selectProject(project.id)),
      })),
    ];

    return [...projectItems, ...moduleItems, ...workspaceActions];
  }, [activeProjectId, openModal, projects, run, selectProject, setActiveTab, t]);

  const filteredItems = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return items;
    return items.filter((item) => normalize(`${item.label} ${item.group} ${item.keywords}`).includes(needle));
  }, [items, query]);

  return { items, filteredItems };
}
