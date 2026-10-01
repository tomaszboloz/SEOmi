
import { SavedKeywordItem, TrackedRankItem } from '@/types';

import { isStorageAvailable, readJsonStorage, readStorage, removeStorage, writeJsonStorage, writeStorage } from '@/services/storage';

import { dataForSeoLanguage, resolveDataForSeoMarket } from '@/services/dataforseo';

import type { RankTrackingDraft } from './contracts';
import { savedKeywordsKey, trackedRanksKey, rankTrackingDraftKey, activeProjectId } from './storageKeys';

import { projectDefaultMarket } from './projectPreferences';

export const LEGACY_SAVED_KEYWORDS_KEY = 'seomi_saved_keywords';

export const LEGACY_TRACKED_RANKS_KEY = 'seomi_tracked_ranks';

export const LEGACY_TOOLS_MIGRATED_KEY = 'seomi_legacy_tools_migrated_v1';

export const loadSavedKeywords = (): SavedKeywordItem[] => {
  const projectId = activeProjectId();
  if (!projectId) return [];
  const value = readJsonStorage<unknown>(savedKeywordsKey(projectId), []);
  return Array.isArray(value) ? value as SavedKeywordItem[] : [];
};

export const loadTrackedRanks = (): TrackedRankItem[] => {
  const projectId = activeProjectId();
  if (!projectId) return [];
  const value = readJsonStorage<unknown>(trackedRanksKey(projectId), []);
  if (!Array.isArray(value)) return [];

  // Older project snapshots stored a display name (for example
  // "United States") and did not always include language_code. Normalize the
  // persisted draft once so every subsequent provider request receives the
  // canonical ISO location and a language supported by that location.
  const normalized = value.flatMap((candidate): TrackedRankItem[] => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const raw = candidate as Partial<TrackedRankItem>;
    if (typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.keyword !== 'string') return [];
    const domain = typeof raw.domain === 'string' ? raw.domain : '';
    const locationInput = typeof raw.location === 'string' && raw.location.trim() ? raw.location : 'US';
    const location = resolveDataForSeoMarket(locationInput)?.code || locationInput;
    const history = Array.isArray(raw.history)
      ? raw.history.filter((point): point is { date: string; rank: number } => Boolean(
        point && typeof point === 'object' && typeof (point as { date?: unknown }).date === 'string'
          && typeof (point as { rank?: unknown }).rank === 'number' && Number.isFinite((point as { rank: number }).rank),
      )).slice(-500)
      : [];
    return [{
      id: raw.id,
      keyword: raw.keyword,
      domain,
      target_url: typeof raw.target_url === 'string' ? raw.target_url : (domain ? `https://${domain}` : ''),
      location,
      language_code: resolveDataForSeoMarket(location) ? dataForSeoLanguage(location, typeof raw.language_code === 'string' ? raw.language_code : undefined) : raw.language_code || '',
      current_rank: typeof raw.current_rank === 'number' && Number.isFinite(raw.current_rank) ? raw.current_rank : null,
      previous_rank: typeof raw.previous_rank === 'number' && Number.isFinite(raw.previous_rank) ? raw.previous_rank : null,
      delta: typeof raw.delta === 'number' && Number.isFinite(raw.delta) ? raw.delta : null,
      best_rank: typeof raw.best_rank === 'number' && Number.isFinite(raw.best_rank) ? raw.best_rank : null,
      history,
      last_checked: typeof raw.last_checked === 'string' ? raw.last_checked : '',
    }];
  });
  if (JSON.stringify(normalized) !== JSON.stringify(value)) writeJsonStorage(trackedRanksKey(projectId), normalized);
  return normalized;
};

export const defaultRankTrackingDraft = (projectId: string | null = activeProjectId()): RankTrackingDraft => ({
  keyword: '',
  domain: '',
  targetUrl: '',
  location: projectId ? projectDefaultMarket(projectId) : 'US',
  language: dataForSeoLanguage(projectId ? projectDefaultMarket(projectId) : 'US'),
});

export const loadRankTrackingDraft = (projectId: string | null = activeProjectId()): RankTrackingDraft => {
  if (!projectId) return defaultRankTrackingDraft();
  const stored = readJsonStorage<unknown>(rankTrackingDraftKey(projectId), null);
  if (!stored || typeof stored !== 'object') return defaultRankTrackingDraft();
  const value = stored as Partial<RankTrackingDraft>;
  const requestedLocation = typeof value.location === 'string' ? value.location : projectDefaultMarket(projectId);
  const location = resolveDataForSeoMarket(requestedLocation)?.code || requestedLocation;
  return {
    keyword: typeof value.keyword === 'string' ? value.keyword : '',
    domain: typeof value.domain === 'string' ? value.domain : '',
    targetUrl: typeof value.targetUrl === 'string' ? value.targetUrl : '',
    location,
    language: resolveDataForSeoMarket(location) ? dataForSeoLanguage(location, typeof value.language === 'string' ? value.language : undefined) : value.language || '',
  };
};

export const migrateLegacyToolData = (projectId: string) => {
  if (!isStorageAvailable()) return;
  if (readStorage(LEGACY_TOOLS_MIGRATED_KEY)) return;

  let malformedLegacyRecord = false;
  const migrateArray = (legacyKey: string, destinationKey: string) => {
    if (readStorage(destinationKey)) return;
    const raw = readStorage(legacyKey);
    if (!raw) return;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      malformedLegacyRecord = true;
      return;
    }
    if (Array.isArray(parsed)) writeJsonStorage(destinationKey, parsed);
  };

  migrateArray(LEGACY_SAVED_KEYWORDS_KEY, savedKeywordsKey(projectId));
  migrateArray(LEGACY_TRACKED_RANKS_KEY, trackedRanksKey(projectId));
  if (malformedLegacyRecord) return;
  removeStorage(LEGACY_SAVED_KEYWORDS_KEY);
  removeStorage(LEGACY_TRACKED_RANKS_KEY);
  writeStorage(LEGACY_TOOLS_MIGRATED_KEY, 'true');
};