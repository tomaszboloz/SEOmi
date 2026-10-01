
import { CrawlRequestProfile } from '@/types';

import { createId } from '@/services/ids';

import i18n from '@/i18n';

import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { activeProjectId } from './storageKeys';

import { persistCrawlRequestProfiles, persistCrawlSettings } from './crawlPersistence';

export const createCrawlProfilesSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setCrawlUrl" | "setCrawlLimit" | "setCrawlConfig" | "saveCrawlRequestProfile" | "deleteCrawlRequestProfile"> => ({
setCrawlUrl: (u) => {
    set({ crawlUrl: u });
    persistCrawlSettings({ url: u, limit: get().crawlLimit, config: get().crawlConfig });
  },
setCrawlLimit: (limit) => {
    set({ crawlLimit: limit });
    persistCrawlSettings({ url: get().crawlUrl, limit, config: get().crawlConfig });
  },
setCrawlConfig: (patch) => {
    const config = { ...get().crawlConfig, ...patch };
    set({ crawlConfig: config });
    persistCrawlSettings({ url: get().crawlUrl, limit: get().crawlLimit, config });
  },
saveCrawlRequestProfile: async ({ id, name, userAgent, headers, cookie, proxyUrl }) => {
    const projectId = activeProjectId();
    if (!projectId) throw new Error(i18n.t('runtimeErrors.tools.profileProject'));
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error(i18n.t('runtimeErrors.tools.profileName'));
    if (normalizedName.length > 80) throw new Error(i18n.t('runtimeErrors.tools.profileNameLength'));
    if (userAgent.length > 1024) throw new Error(i18n.t('runtimeErrors.tools.userAgentLength'));
    const profileId = id || createId('profile');
    const previous = get().crawlRequestProfiles.find((profile) => profile.id === profileId);
    set({ isSavingCrawlRequestProfile: true });
    try {
      await services.invoke('save_crawl_auth_profile', { projectId, profileId, headers, cookie: cookie || null, proxyUrl: proxyUrl || null });
      const now = new Date().toISOString();
      const profile: CrawlRequestProfile = {
        id: profileId,
        name: normalizedName,
        userAgent: userAgent.trim(),
        hasProxy: Boolean(proxyUrl.trim()),
        hasHeaders: headers.length > 0,
        hasCookie: Boolean(cookie.trim()),
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      };
      // The native write belongs to the originating project, but a project
      // switch during the request must not hydrate that project's UI with the
      // old profile or persist settings under the newly active project.
      if (activeProjectId() !== projectId) return profile;
      const crawlRequestProfiles = [profile, ...get().crawlRequestProfiles.filter((candidate) => candidate.id !== profileId)];
      persistCrawlRequestProfiles(crawlRequestProfiles);
      const crawlConfig = { ...get().crawlConfig, requestProfileId: profile.id, userAgent: profile.userAgent };
      persistCrawlSettings({ url: get().crawlUrl, limit: get().crawlLimit, config: crawlConfig });
      set({ crawlRequestProfiles, crawlConfig });
      return profile;
    } finally {
      if (activeProjectId() === projectId) set({ isSavingCrawlRequestProfile: false });
    }
  },
deleteCrawlRequestProfile: async (id) => {
    const projectId = activeProjectId();
    if (!projectId) throw new Error(i18n.t('runtimeErrors.tools.profileDeleteProject'));
    await services.invoke('delete_crawl_auth_profile', { projectId, profileId: id });
    if (activeProjectId() !== projectId) return;
    const crawlRequestProfiles = get().crawlRequestProfiles.filter((profile) => profile.id !== id);
    persistCrawlRequestProfiles(crawlRequestProfiles);
    const crawlConfig = get().crawlConfig.requestProfileId === id
      ? { ...get().crawlConfig, requestProfileId: undefined }
      : get().crawlConfig;
    persistCrawlSettings({ url: get().crawlUrl, limit: get().crawlLimit, config: crawlConfig });
    set({ crawlRequestProfiles, crawlConfig });
  }
});
