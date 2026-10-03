import { StateCreator } from 'zustand';
import { AuditState } from './auditTypes';
import { activeProjectId, readHistory } from './auditStorage';
import { beginAuditRequest, isLatestAuditRequest, formatAuditRuntimeError, persistAuditHistory } from './auditHelpers';
import { invokeTauriCommand } from '@/services/tauri';
import { notifyAuditCompleted } from '@/services/desktopNotifications';
import i18n from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import { writeStorage } from '@/services/storage';
import { activeTabKey, onlyProblemsKey } from './auditConstants';
import { PageAuditData } from '@/types';

export const createAuditMainSlice: StateCreator<AuditState, [], [], Pick<AuditState, 'startAudit' | 'setAuditData' | 'importScheduledAuditResult' | 'setActiveTab' | 'setSearchFilter' | 'setShowOnlyProblems' | 'setSelectedUserAgent' | 'clearAudit' | 'removeFromHistory'>> = (set, get) => ({
  startAudit: async (url, userAgent) => {
    const projectId = activeProjectId();
    if (!projectId) {
      set({ error: i18n.t('runtimeErrors.audit.projectRequired') });
      return false;
    }
    const requestToken = beginAuditRequest('single');
    const projectHistory = readHistory(projectId);
    set({ isLoading: true, error: null, dataforseoData: null, dataforseoSerp: [], dataforseoError: null, isDataForSEOLoading: false });
    try {
      const data = await invokeTauriCommand<PageAuditData>('inspect_url', { url, userAgent: userAgent || get().selectedUserAgent || useSettingsStore.getState().config.default_user_agent, timeoutSecs: useSettingsStore.getState().config.request_timeout_secs, maxRedirects: useSettingsStore.getState().config.max_redirects, verifySsl: useSettingsStore.getState().config.verify_ssl });
      if (!isLatestAuditRequest('single', requestToken) && activeProjectId() === projectId) return false;
      const previousAudit = projectHistory.find((item) => item.final_url === data.final_url || item.url === url);
      const history = [data, ...projectHistory.filter((item) => item.final_url !== data.final_url)].slice(0, 25);
      const historyPersisted = persistAuditHistory(projectId, history);
      const historySaved = historyPersisted.saved;
      const projectIsStillActive = activeProjectId() === projectId && isLatestAuditRequest('single', requestToken);
      if (projectIsStillActive) set({ currentAudit: data, history, isLoading: false, error: historySaved ? null : i18n.t('runtimeErrors.audit.historySave') });
      void notifyAuditCompleted(projectId, data, previousAudit?.health_score);
      return true;
    } catch (error) {
      if (activeProjectId() === projectId && isLatestAuditRequest('single', requestToken)) {
        set({ error: formatAuditRuntimeError(error), isLoading: false });
      }
      return false;
    }
  },
  setAuditData: (data) => {
    beginAuditRequest('single');
    set({ currentAudit: data, error: null, isLoading: false });
  },
  importScheduledAuditResult: (data) => {
    if (!data || typeof data !== 'object') return false;
    const candidate = data as Partial<PageAuditData>;
    if (typeof candidate.url !== 'string' || typeof candidate.timestamp !== 'string') return false;
    const projectId = activeProjectId();
    if (!projectId) return false;
    beginAuditRequest('single');
    const current = readHistory(projectId);
    const audit = data as PageAuditData;
    const history = [audit, ...current.filter((item) => item.timestamp !== audit.timestamp && item.final_url !== audit.final_url)].slice(0, 25);
    if (!persistAuditHistory(projectId, history).saved) return false;
    if (activeProjectId() === projectId) set({ currentAudit: audit, history, isLoading: false, error: null });
    return true;
  },
  setActiveTab: (activeTab) => {
    try {
      const projectId = activeProjectId();
      if (projectId) writeStorage(activeTabKey(projectId), activeTab);
    } catch { }
    set({ activeTab });
  },
  setSearchFilter: (searchFilter) => set({ searchFilter }),
  setShowOnlyProblems: (showOnlyProblems) => {
    const projectId = activeProjectId();
    if (projectId) writeStorage(onlyProblemsKey(projectId), String(showOnlyProblems));
    set({ showOnlyProblems });
  },
  setSelectedUserAgent: (selectedUserAgent) => set({ selectedUserAgent }),
  clearAudit: () => {
    beginAuditRequest('single');
    set({ currentAudit: null, error: null, isLoading: false });
  },
  removeFromHistory: (index) => {
    const history = get().history.filter((_, itemIndex) => itemIndex !== index);
    const projectId = activeProjectId();
    if (projectId) persistAuditHistory(projectId, history);
    set({ history, currentAudit: history.find((item) => item.timestamp === get().currentAudit?.timestamp) || null });
  },
});
