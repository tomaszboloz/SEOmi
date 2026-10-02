import { CrawlRequestProfile } from '@/types';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { CrawlProjectSettings } from '../contracts';
import { crawlSettingsKey, crawlRequestProfilesKey, activeProjectId } from '../storageKeys';

export const loadCrawlRequestProfiles = (): CrawlRequestProfile[] => {
  const projectId = activeProjectId();
  if (!projectId) return [];
  const raw = readJsonStorage(crawlRequestProfilesKey(projectId), []);
  return Array.isArray(raw)
    ? raw.filter((profile): profile is CrawlRequestProfile => Boolean(
      profile && typeof profile.id === 'string' && typeof profile.name === 'string' && typeof profile.userAgent === 'string'
        && typeof profile.createdAt === 'string' && typeof profile.updatedAt === 'string',
    )).map((profile) => ({
      ...profile,
      hasProxy: Boolean(profile.hasProxy),
      hasHeaders: Boolean(profile.hasHeaders),
      hasCookie: Boolean(profile.hasCookie),
    }))
    : [];
};

export const persistCrawlRequestProfiles = (profiles: CrawlRequestProfile[]) => {
  const projectId = activeProjectId();
  if (projectId) writeJsonStorage(crawlRequestProfilesKey(projectId), profiles);
};

export const persistCrawlSettings = (settings: CrawlProjectSettings) => {
  const projectId = activeProjectId();
  if (projectId) writeJsonStorage(crawlSettingsKey(projectId), settings);
};
