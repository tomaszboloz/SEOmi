import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { dataForSeoLanguage, requireDataForSeoMarket, resolveDataForSeoMarket } from '@/services/dataforseo';
import { useSettingsStore } from '../../settingsStore';
import i18n from '@/i18n';
import { activeProjectId } from '../storageKeys';
import { beginToolRequest, isLatestToolRequest } from '../runtime';
import type { DomainComparisonData } from '@/types';
import { normalizeDataForSeoDomain } from '@/services/dataforseo';
import { loadDomainComparisonHistory, saveDomainComparisonSnapshot } from '../researchPersistence';

export const createDomainComparisonActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "compareDomains"> => ({
compareDomains: async (targets, country, language) => {
    const rawTargets = (targets ?? get().domainComparisonTargets).map((value) => value.trim()).filter(Boolean);
    const projectId = activeProjectId();
    const overviewTarget = get().domainOverview?.domain || get().domainQuery;
    if (overviewTarget.trim()) rawTargets.unshift(overviewTarget.trim());
    let normalizedTargets: string[];
    try {
      normalizedTargets = Array.from(new Set(rawTargets.map(normalizeDataForSeoDomain))).slice(0, 5);
    } catch (error) {
      set({ domainComparisonError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.domainInvalid') });
      return;
    }
    if (normalizedTargets.length < 2) {
      set({ domainComparisonError: i18n.t('runtimeErrors.tools.domainCompetitorRequired') });
      return;
    }
    if (!projectId) {
      set({ domainComparisonError: i18n.t('runtimeErrors.tools.projectRequired') });
      return;
    }
    if (country) get().setDomainCountry(country);
    if (language) get().setDomainLanguage(language);
    const selectedCountry = country || get().domainCountry;
    if (!resolveDataForSeoMarket(selectedCountry)) return set({ domainComparisonError: i18n.t('runtimeErrors.dataforseo.marketRequired') });
    const selectedLanguage = dataForSeoLanguage(selectedCountry, language || get().domainLanguage);
    const selectedLocationCode = requireDataForSeoMarket(selectedCountry).locationCode;
    const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
    if (!login || !password) {
      set({ domainComparisonError: i18n.t('runtimeErrors.tools.dataforseoComparisonConnect') });
      return;
    }
    const requestToken = beginToolRequest('domain-comparison');
    set({ isDomainComparisonLoading: true, domainComparisonError: null, domainComparisonTargets: normalizedTargets });
    try {
      const client = services.createDataForSeoClient(login, password);
      const retrievedAt = new Date().toISOString();
      const attempts = await Promise.allSettled(normalizedTargets.map((domain) => client.getDomainOverview(domain, selectedLocationCode, selectedLanguage)));
      const rows = attempts.flatMap((attempt, index) => attempt.status === 'fulfilled' && attempt.value ? [{
        domain: normalizedTargets[index],
        organic_traffic: attempt.value.organic_traffic,
        organic_keywords: attempt.value.organic_keywords,
        domain_rank: attempt.value.domain_rank,
        referring_domains: attempt.value.referring_domains,
        total_backlinks: attempt.value.total_backlinks ?? null,
        dofollow_ratio: attempt.value.dofollow_ratio ?? null,
        retrieved_at: retrievedAt,
        top_keywords: attempt.value.top_keywords.slice(0, 10),
        top_pages: attempt.value.top_pages.slice(0, 10),
        competitors: attempt.value.competitors.slice(0, 10),
      }] : []);
      const failed = attempts.filter((attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected');
      const unavailableCount = normalizedTargets.length - rows.length;
      if (!rows.length) throw new Error(failed[0]?.reason instanceof Error ? failed[0].reason.message : i18n.t('runtimeErrors.tools.dataforseoNoComparison'));
      const comparison: DomainComparisonData = {
        target: normalizedTargets[0], rows, location_code: requireDataForSeoMarket(selectedCountry).locationCode, language_code: selectedLanguage, retrieved_at: retrievedAt, source: 'dataforseo',
      };
      if (activeProjectId() !== projectId || !isLatestToolRequest('domain-comparison', requestToken)) return;
      const nextHistory = saveDomainComparisonSnapshot(projectId, comparison, normalizedTargets, loadDomainComparisonHistory(projectId));
      set({ domainComparison: comparison, domainComparisonHistory: nextHistory, domainComparisonTargets: normalizedTargets, domainComparisonError: unavailableCount ? i18n.t('runtimeErrors.tools.comparisonPartial', { rows: rows.length, total: normalizedTargets.length, failed: unavailableCount }) : null, isDomainComparisonLoading: false });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('domain-comparison', requestToken)) set({ domainComparisonError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.comparisonFailed'), isDomainComparisonLoading: false });
    }
  }
});
