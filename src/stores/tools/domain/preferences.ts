import type { ToolsState, ToolsSet, ToolsGet } from '../contracts';
import { writeJsonStorage, writeStorage } from '@/services/storage';
import { dataForSeoLanguage, resolveDataForSeoMarket } from '@/services/dataforseo';
import { rankTrackingDraftKey, domainQueryKey, domainCountryKey, domainLanguageKey, keywordCountryKey, keywordLanguageKey, activeProjectId } from '../storageKeys';
import { saveDomainComparison } from '../researchPersistence';
import { saveProjectQuery } from '../projectPreferences';

export const createDomainPreferences = (set: ToolsSet, get: ToolsGet): Pick<ToolsState, "setDomainQuery" | "setDomainCountry" | "setDomainLanguage" | "setDomainComparisonTargets"> => ({
setDomainQuery: (d) => {
    const query = d.trim();
    saveProjectQuery(domainQueryKey, query);
    set({ domainQuery: query });
  },
setDomainCountry: (country) => {
    const normalized = resolveDataForSeoMarket(country)?.code;
    if (!normalized) return;
    const projectId = activeProjectId();
    if (projectId) writeStorage(domainCountryKey(projectId), normalized);
    const language = dataForSeoLanguage(normalized, get().domainLanguage);
    if (projectId) writeStorage(domainLanguageKey(projectId), language);
    if (projectId) {
      writeStorage(`seomi_project_${projectId}_dataforseo_market_v1`, normalized);
      writeStorage(keywordCountryKey(projectId), normalized);
      writeStorage(keywordLanguageKey(projectId), language);
    }
    const rankTrackingDraft = { ...get().rankTrackingDraft, location: normalized, language };
    if (projectId) writeJsonStorage(rankTrackingDraftKey(projectId), rankTrackingDraft);
    set({ domainCountry: normalized, domainLanguage: language, keywordCountry: normalized, keywordLanguage: language, rankTrackingDraft });
  },
setDomainLanguage: (language) => {
    const normalized = dataForSeoLanguage(get().domainCountry, language);
    const projectId = activeProjectId();
    if (projectId) writeStorage(domainLanguageKey(projectId), normalized);
    if (projectId) writeStorage(keywordLanguageKey(projectId), normalized);
    set({ domainLanguage: normalized, keywordLanguage: normalized });
  },
setDomainComparisonTargets: (targets) => {
    const normalized = Array.from(new Set(targets.map((value) => value.trim()).filter(Boolean))).slice(0, 5);
    const projectId = activeProjectId();
    if (projectId) saveDomainComparison(projectId, get().domainComparison, normalized);
    set({ domainComparisonTargets: normalized });
  },
});
