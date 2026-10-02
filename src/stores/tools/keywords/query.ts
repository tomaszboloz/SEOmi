import { writeJsonStorage, writeStorage } from '@/services/storage';
import { dataForSeoLanguage, requireDataForSeoMarket, resolveDataForSeoMarket } from '@/services/dataforseo';
import { useSettingsStore } from '../../settingsStore';
import i18n from '@/i18n';
import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { rankTrackingDraftKey, domainCountryKey, domainLanguageKey, keywordQueryKey, keywordCountryKey, keywordLanguageKey, activeProjectId } from '../storageKeys';
import { beginToolRequest, isLatestToolRequest } from '../runtime';
import { saveProjectQuery } from '../projectPreferences';

export const createKeywordQueryActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setKeywordQuery" | "setKeywordCountry" | "setKeywordLanguage" | "setSelectedTagFilter" | "searchKeywords"> => ({
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
  }
});
