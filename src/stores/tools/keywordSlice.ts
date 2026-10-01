
import { SavedKeywordItem, TrackedRankItem } from '@/types';

import { createId } from '@/services/ids';
import { writeJsonStorage, writeStorage } from '@/services/storage';

import { dataForSeoLanguage, requireDataForSeoMarket, resolveDataForSeoMarket } from '@/services/dataforseo';
import { useSettingsStore } from '../settingsStore';

import i18n from '@/i18n';

import type { ToolsState, RankTrackingDraft, ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { savedKeywordsKey, trackedRanksKey, rankTrackingDraftKey, domainCountryKey, domainLanguageKey, keywordQueryKey, keywordCountryKey, keywordLanguageKey, activeProjectId } from './storageKeys';
import { beginToolRequest, isLatestToolRequest } from './runtime';

import { saveProjectQuery } from './projectPreferences';

export const createKeywordSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setKeywordQuery" | "setKeywordCountry" | "setKeywordLanguage" | "setSelectedTagFilter" | "searchKeywords" | "addSavedKeyword" | "removeSavedKeyword" | "updateKeywordTags" | "setRankTrackingDraft" | "addTrackedRank" | "removeTrackedRank" | "refreshAllRanks"> => ({
setKeywordQuery: (q) => {
    const query = q.trim();
    saveProjectQuery(keywordQueryKey, query);
    set({ keywordQuery: query });
  },
setKeywordCountry: (c) => {
    const country = resolveDataForSeoMarket(c)?.code;
    if (!country) return;
    const projectId = activeProjectId();
    if (projectId) writeStorage(keywordCountryKey(projectId), country);
    const language = dataForSeoLanguage(country, get().keywordLanguage);
    if (projectId) writeStorage(keywordLanguageKey(projectId), language);
    if (projectId) {
      writeStorage(`seomi_project_${projectId}_dataforseo_market_v1`, country);
      writeStorage(domainCountryKey(projectId), country);
      writeStorage(domainLanguageKey(projectId), language);
    }
    const rankTrackingDraft = { ...get().rankTrackingDraft, location: country, language };
    if (projectId) writeJsonStorage(rankTrackingDraftKey(projectId), rankTrackingDraft);
    set({ keywordCountry: country, keywordLanguage: language, domainCountry: country, domainLanguage: language, rankTrackingDraft });
  },
setKeywordLanguage: (language) => {
    const country = get().keywordCountry;
    const normalized = dataForSeoLanguage(country, language);
    const projectId = activeProjectId();
    if (projectId) writeStorage(keywordLanguageKey(projectId), normalized);
    if (projectId) writeStorage(domainLanguageKey(projectId), normalized);
    set({ keywordLanguage: normalized, domainLanguage: normalized });
  },
setSelectedTagFilter: (tag) => set({ selectedTagFilter: tag }),
searchKeywords: async (query, country, language) => {
    const projectIdAtStart = activeProjectId();
    const q = (query ?? get().keywordQuery).trim();
    const selectedCountry = country || get().keywordCountry;
    if (query !== undefined) get().setKeywordQuery(query);
    if (country) get().setKeywordCountry(country);
    if (language) get().setKeywordLanguage(language);
    if (!q) return;
    const requestToken = beginToolRequest('keyword-search');
    set({ isKeywordLoading: true, keywordError: null, keywordResults: [], keywordResultsSource: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.keywordConnect'));
      const selectedMarket = requireDataForSeoMarket(selectedCountry);
      const locationCode = selectedMarket.locationCode;
      const languageCode = dataForSeoLanguage(selectedCountry, language || get().keywordLanguage);
      const keywordResults = await services.createDataForSeoClient(login, password).getKeywordIdeas(
        q,
        locationCode,
        languageCode,
      );
      if (activeProjectId() !== projectIdAtStart || !isLatestToolRequest('keyword-search', requestToken)) return;
      set({ keywordResults, keywordResultsSource: { seedKeyword: q, countryCode: selectedMarket.code, locationCode, languageCode, retrievedAt: new Date().toISOString() }, isKeywordLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : i18n.t('runtimeErrors.tools.comparisonFailed');
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('keyword-search', requestToken)) set({ keywordResults: [], keywordResultsSource: null, keywordError: msg, isKeywordLoading: false });
    }
  },
addSavedKeyword: (item) => {
    const existing = get().savedKeywords;
    if (existing.some((k) => k.keyword.toLowerCase() === item.keyword.toLowerCase())) {
      return;
    }
    const newItem: SavedKeywordItem = {
      ...item,
      id: createId('k'),
      addedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...existing];
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(savedKeywordsKey(projectId), updated);
    set({ savedKeywords: updated });
  },
removeSavedKeyword: (id) => {
    const updated = get().savedKeywords.filter((k) => k.id !== id);
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(savedKeywordsKey(projectId), updated);
    set({ savedKeywords: updated });
  },
updateKeywordTags: (id, tags) => {
    const updated = get().savedKeywords.map((k) => (k.id === id ? { ...k, tags } : k));
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(savedKeywordsKey(projectId), updated);
    set({ savedKeywords: updated });
  },
setRankTrackingDraft: (patch) => {
    const current = get().rankTrackingDraft;
    const requestedLocation = patch.location ?? current.location;
    const location = resolveDataForSeoMarket(requestedLocation)?.code;
    if (!location) return;
    const draft: RankTrackingDraft = {
      ...current,
      ...patch,
      location,
      language: dataForSeoLanguage(location, patch.language ?? current.language),
    };
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(rankTrackingDraftKey(projectId), draft);
    set({ rankTrackingDraft: draft });
  },
addTrackedRank: (keyword, domain, targetUrl, location, languageCode) => {
    const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
    const cleanTarget = targetUrl || `https://${cleanDomain}`;
    const cleanLoc = location || 'US';

    const newItem: TrackedRankItem = {
      id: `r-${Date.now()}`,
      keyword: keyword.trim(),
      domain: cleanDomain,
      target_url: cleanTarget,
      location: cleanLoc,
      language_code: dataForSeoLanguage(cleanLoc, languageCode),
      current_rank: null,
      previous_rank: null,
      delta: null,
      best_rank: null,
      history: [],
      last_checked: '',
    };
    const updated = [newItem, ...get().trackedRanks];
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(trackedRanksKey(projectId), updated);
    set({ trackedRanks: updated });
  },
removeTrackedRank: (id) => {
    const updated = get().trackedRanks.filter((r) => r.id !== id);
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(trackedRanksKey(projectId), updated);
    set({ trackedRanks: updated });
  },
refreshAllRanks: async () => {
    const projectIdAtStart = activeProjectId();
    const trackedRanks = get().trackedRanks;
    if (trackedRanks.length === 0) {
      set({ rankError: i18n.t('runtimeErrors.tools.rankNeedPhrase') });
      return;
    }
    const requestToken = beginToolRequest('rank-refresh');
    set({ isRankLoading: true, rankError: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.rankConnect'));
      const client = services.createDataForSeoClient(login, password);
      const date = new Date().toISOString().slice(0, 10);
      const attempts = await Promise.allSettled(trackedRanks.map(async (item) => {
        const languageCode = dataForSeoLanguage(item.location, item.language_code);
        const rows = await client.getSerpCompetitors(item.keyword, requireDataForSeoMarket(item.location).locationCode, languageCode);
        const found = rows.find((row) => row.domain === item.domain || row.domain.endsWith(`.${item.domain}`));
        const currentRank = found ? (found.rank_absolute > 100 ? 101 : found.rank_absolute) : 101;
        return {
          ...item,
          language_code: languageCode,
          previous_rank: item.current_rank,
          current_rank: currentRank,
          delta: item.current_rank !== null && currentRank !== null ? item.current_rank - currentRank : null,
          best_rank: item.best_rank !== null && currentRank !== null && currentRank <= 100 ? Math.min(item.best_rank, currentRank) : (currentRank !== null && currentRank <= 100 ? currentRank : item.best_rank),
          history: currentRank !== null ? [...item.history, { date, rank: currentRank }].slice(-90) : item.history,
          last_checked: new Date().toISOString(),
        };
      }));
      const updated = attempts.flatMap((attempt, index) => attempt.status === 'fulfilled' ? [attempt.value] : [trackedRanks[index]]);
      const failed = attempts.filter((attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected');
      if (activeProjectId() !== projectIdAtStart || !isLatestToolRequest('rank-refresh', requestToken)) return;
      if (projectIdAtStart) writeJsonStorage(trackedRanksKey(projectIdAtStart), updated);
      set({ trackedRanks: updated, rankError: failed.length ? i18n.t('runtimeErrors.tools.rankPartial', { failed: failed.length, total: trackedRanks.length }) : null });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('rank-refresh', requestToken)) set({ rankError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.rankRefreshFailed') });
    }
    finally { if (activeProjectId() === projectIdAtStart && isLatestToolRequest('rank-refresh', requestToken)) set({ isRankLoading: false }); }
  }
});
