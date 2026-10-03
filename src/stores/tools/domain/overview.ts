import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { dataForSeoLanguage, requireDataForSeoMarket, resolveDataForSeoMarket } from '@/services/dataforseo';
import { useSettingsStore } from '../../settingsStore';
import i18n from '@/i18n';
import { activeProjectId } from '../storageKeys';
import { beginToolRequest, isLatestToolRequest } from '../runtime';
import { domainOverviewKey, domainQueryKey } from '../storageKeys';
import { saveProjectResearch } from '../researchPersistence';
import { saveProjectQuery } from '../projectPreferences';

export const createDomainOverviewActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "analyzeDomain"> => ({
analyzeDomain: async (domain, country, language) => {
    const projectIdAtStart = activeProjectId();
    if (!projectIdAtStart) return set({ domainError: i18n.t('runtimeErrors.tools.projectRequired') });
    const target = (domain ?? get().domainQuery).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!target) return;

    if (country) get().setDomainCountry(country);
    if (language) get().setDomainLanguage(language);
    const selectedCountry = country || get().domainCountry;
    if (!resolveDataForSeoMarket(selectedCountry)) return set({ domainError: i18n.t('runtimeErrors.dataforseo.marketRequired') });
    const selectedLanguage = dataForSeoLanguage(selectedCountry, language || get().domainLanguage);
    if (domain !== undefined) {
      saveProjectQuery(domainQueryKey, domain);
      set({ domainQuery: domain.trim() });
    }

    const requestToken = beginToolRequest('domain-overview');
    set({ isDomainLoading: true, domainError: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.domainConnect'));
      const domainOverview = await services.createDataForSeoClient(login, password).getDomainOverview(target, requireDataForSeoMarket(selectedCountry).locationCode, selectedLanguage);
      if (!domainOverview) throw new Error(i18n.t('runtimeErrors.tools.domainNoOverview'));
      if (activeProjectId() !== projectIdAtStart || !isLatestToolRequest('domain-overview', requestToken)) return;
      saveProjectResearch(domainOverviewKey, domainOverview, projectIdAtStart);
      set({ domainOverview, isDomainLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : i18n.t('runtimeErrors.tools.domainNoOverview');
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('domain-overview', requestToken)) set({ domainError: msg, isDomainLoading: false });
    }
  },
});
