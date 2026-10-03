import { useSettingsStore } from '../../settingsStore';
import i18n from '@/i18n';
import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { backlinkQueryKey, backlinkProfileKey, activeProjectId } from '../storageKeys';
import { beginToolRequest, isLatestToolRequest } from '../runtime';
import { saveProjectResearch, loadBacklinkProfileHistory, saveBacklinkProfileSnapshot } from '../researchPersistence';
import { saveProjectQuery } from '../projectPreferences';

export const createBacklinkProfileActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setBacklinkQuery" | "analyzeBacklinks" | "loadMoreBacklinks" | "loadMoreBacklinkAnchors"> => ({
setBacklinkQuery: (d) => {
    const query = d.trim();
    saveProjectQuery(backlinkQueryKey, query);
    set({ backlinkQuery: query });
  },
analyzeBacklinks: async (domain) => {
    const projectIdAtStart = activeProjectId();
    if (!projectIdAtStart) {
      set({ backlinkError: i18n.t('runtimeErrors.tools.projectRequired') });
      return;
    }
    const target = (domain ?? get().backlinkQuery).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!target) return;

    if (domain !== undefined) {
      saveProjectQuery(backlinkQueryKey, domain);
      set({ backlinkQuery: domain.trim() });
    }

    const requestToken = beginToolRequest('backlink-profile');
    set({ isBacklinkLoading: true, backlinkError: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.backlinkProfileConnect'));
      const backlinkProfile = await services.createDataForSeoClient(login, password).getBacklinkProfile(target);
      if (!backlinkProfile) throw new Error(i18n.t('runtimeErrors.tools.backlinkNoProfile'));
      if (activeProjectId() !== projectIdAtStart || !isLatestToolRequest('backlink-profile', requestToken)) return;
      saveProjectResearch(backlinkProfileKey, backlinkProfile, projectIdAtStart);
      const nextHistory = saveBacklinkProfileSnapshot(
        projectIdAtStart,
        backlinkProfile,
        loadBacklinkProfileHistory(projectIdAtStart),
      );
      set({ backlinkProfile, backlinkProfileHistory: nextHistory, isBacklinkLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : i18n.t('runtimeErrors.tools.backlinkNoProfile');
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ backlinkError: msg, isBacklinkLoading: false });
    }
  },
loadMoreBacklinks: async () => {
    const projectIdAtStart = activeProjectId();
    if (!projectIdAtStart) return set({ backlinkError: i18n.t('runtimeErrors.tools.projectRequired') });
    const profile = get().backlinkProfile;
    if (!profile || get().isBacklinkLoading || profile.total_backlink_rows === null || profile.backlinks.length >= profile.total_backlink_rows) return;
    const requestToken = beginToolRequest('backlink-profile');
    set({ isBacklinkLoading: true, backlinkError: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.backlinkLoad'));
      const page = await services.createDataForSeoClient(login, password).getBacklinksPage(profile.domain, profile.backlinks.length);
      const current = get().backlinkProfile;
      if (!current || current.domain !== profile.domain || activeProjectId() !== projectIdAtStart || !isLatestToolRequest('backlink-profile', requestToken)) return;
      const nextProfile = { ...current, total_backlink_rows: page.totalCount ?? current.total_backlink_rows, backlinks: [...current.backlinks, ...page.items] };
      saveProjectResearch(backlinkProfileKey, nextProfile, projectIdAtStart);
      set({ backlinkProfile: nextProfile });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ backlinkError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.backlinkLoad') });
    } finally {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ isBacklinkLoading: false });
    }
  },
loadMoreBacklinkAnchors: async () => {
    const projectIdAtStart = activeProjectId();
    if (!projectIdAtStart) return set({ backlinkError: i18n.t('runtimeErrors.tools.projectRequired') });
    const profile = get().backlinkProfile;
    if (!profile || get().isBacklinkLoading || profile.total_anchor_rows === null || profile.anchors.length >= profile.total_anchor_rows) return;
    const requestToken = beginToolRequest('backlink-profile');
    set({ isBacklinkLoading: true, backlinkError: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.backlinkAnchorLoad'));
      const page = await services.createDataForSeoClient(login, password).getBacklinkAnchorsPage(profile.domain, profile.anchors.length, 100, profile.total_backlinks);
      const current = get().backlinkProfile;
      if (!current || current.domain !== profile.domain || activeProjectId() !== projectIdAtStart || !isLatestToolRequest('backlink-profile', requestToken)) return;
      const nextProfile = { ...current, total_anchor_rows: page.totalCount ?? current.total_anchor_rows, anchors: [...current.anchors, ...page.items] };
      saveProjectResearch(backlinkProfileKey, nextProfile, projectIdAtStart);
      set({ backlinkProfile: nextProfile });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ backlinkError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.backlinkAnchorLoad') });
    } finally {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ isBacklinkLoading: false });
    }
  }
});
