import { TrackedRankItem } from '@/types';
import { createId } from '@/services/ids';
import { writeJsonStorage } from '@/services/storage';
import { dataForSeoLanguage, requireDataForSeoMarket, resolveDataForSeoMarket } from '@/services/dataforseo';
import { useSettingsStore } from '../../settingsStore';
import i18n from '@/i18n';
import type { ToolsState, RankTrackingDraft, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { trackedRanksKey, rankTrackingDraftKey, activeProjectId } from '../storageKeys';
import { beginToolRequest, isLatestToolRequest } from '../runtime';

export const createKeywordRanksActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setRankTrackingDraft" | "addTrackedRank" | "removeTrackedRank" | "refreshAllRanks"> => ({
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
      id: createId('r'),
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
          delta: item.current_rank !== null ? item.current_rank - currentRank : null,
          best_rank: item.best_rank !== null && currentRank <= 100 ? Math.min(item.best_rank, currentRank) : (currentRank <= 100 ? currentRank : item.best_rank),
          history: [...item.history, { date, rank: currentRank }].slice(-90),
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
