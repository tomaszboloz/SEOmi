import { StateCreator } from 'zustand';
import { AuditState } from './auditTypes';
import { activeProjectId } from './auditStorage';
import { beginAuditRequest, isLatestAuditRequest } from './auditHelpers';
import i18n from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import { DataForSEOClient } from '@/services/dataforseo';
import { writeStorage } from '@/services/storage';
import { dataForSeoSummaryKey, dataForSeoSerpKey, dataForSeoTargetKey } from './auditConstants';

export const createAuditSeoSlice: StateCreator<AuditState, [], [], Pick<AuditState, 'fetchDataForSEO' | 'fetchDataForSEOSerp' | 'setDataForSEOData'>> = (set, get) => ({
  fetchDataForSEO: async (domain) => {
    const projectId = activeProjectId();
    if (!projectId) return set({ dataforseoData: null, dataforseoError: i18n.t('runtimeErrors.tools.projectRequired'), isDataForSEOLoading: false });
    const activeAudit = get().currentAudit;
    let target = domain?.trim() || '';
    if (!target && activeAudit) {
      try { target = new URL(activeAudit.final_url || activeAudit.url).hostname; } catch { target = ''; }
    }
    const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
    if (!login || !password || !target) return set({ dataforseoData: null, dataforseoError: !target ? i18n.t('runtimeErrors.audit.dataforseoDomain') : i18n.t('runtimeErrors.audit.dataforseoConnection'), isDataForSEOLoading: false });
    const requestToken = beginAuditRequest('dataforseo-summary');
    set({ isDataForSEOLoading: true, dataforseoError: null });
    try {
      const dataforseoData = await new DataForSEOClient(login, password).getBacklinksSummary(target);
      if (!isLatestAuditRequest('dataforseo-summary', requestToken) && activeProjectId() === projectId) return;
      if (dataforseoData) {
        writeStorage(dataForSeoSummaryKey(projectId), JSON.stringify(dataforseoData));
        writeStorage(dataForSeoTargetKey(projectId), dataforseoData.target.toLowerCase());
        if (activeProjectId() !== projectId) return;
        set({ dataforseoData, isDataForSEOLoading: false });
      } else {
        if (activeProjectId() !== projectId) return;
        set({ dataforseoData: null, dataforseoError: i18n.t('runtimeErrors.tools.backlinkNoProfile'), isDataForSEOLoading: false });
      }
    } catch (error) {
      if (activeProjectId() === projectId && isLatestAuditRequest('dataforseo-summary', requestToken)) set({ dataforseoData: null, dataforseoError: error instanceof Error ? error.message : String(error), isDataForSEOLoading: false });
    }
  },
  fetchDataForSEOSerp: async (keyword, locationCode = 2840, languageCode = 'en') => {
    const projectId = activeProjectId();
    if (!projectId) return set({ dataforseoSerp: [], dataforseoError: i18n.t('runtimeErrors.tools.projectRequired'), isDataForSEOLoading: false });
    const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
    if (!login || !password) return set({ dataforseoSerp: [], dataforseoError: i18n.t('runtimeErrors.audit.dataforseoConnection'), isDataForSEOLoading: false });
    const requestToken = beginAuditRequest('dataforseo-serp');
    set({ isDataForSEOLoading: true, dataforseoError: null });
    try {
      const dataforseoSerp = await new DataForSEOClient(login, password).getSerpCompetitors(keyword, locationCode, languageCode);
      if (!isLatestAuditRequest('dataforseo-serp', requestToken) && activeProjectId() === projectId) return;
      writeStorage(dataForSeoSerpKey(projectId), JSON.stringify(dataforseoSerp));
      if (activeProjectId() !== projectId) return;
      set({ dataforseoSerp, isDataForSEOLoading: false });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestAuditRequest('dataforseo-serp', requestToken)) set({ dataforseoSerp: [], dataforseoError: error instanceof Error ? error.message : String(error), isDataForSEOLoading: false });
    }
  },
  setDataForSEOData: (dataforseoData) => {
    beginAuditRequest('dataforseo-summary');
    const projectId = activeProjectId();
    if (projectId && dataforseoData) {
      writeStorage(dataForSeoSummaryKey(projectId), JSON.stringify(dataforseoData));
      writeStorage(dataForSeoTargetKey(projectId), dataforseoData.target.toLowerCase());
    }
    set({ dataforseoData });
  },
});
