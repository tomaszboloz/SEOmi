
import { BacklinkGapReport } from '@/types';

import { normalizeDataForSeoDomain } from '@/services/dataforseo';
import { useSettingsStore } from '../settingsStore';

import i18n from '@/i18n';

import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { backlinkQueryKey, backlinkProfileKey, backlinkGapReportKey, activeProjectId } from './storageKeys';
import { beginToolRequest, isLatestToolRequest } from './runtime';
import { saveProjectResearch, loadBacklinkProfileHistory, saveBacklinkProfileSnapshot } from './researchPersistence';
import { saveProjectQuery, saveBacklinkGapSettings } from './projectPreferences';

export const createBacklinksSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setBacklinkQuery" | "analyzeBacklinks" | "loadMoreBacklinks" | "loadMoreBacklinkAnchors" | "setBacklinkGapCompetitors" | "setBacklinkGapIncludeSubdomains" | "analyzeBacklinkGap" | "loadMoreBacklinkGap"> => ({
setBacklinkQuery: (d) => {
    const query = d.trim();
    saveProjectQuery(backlinkQueryKey, query);
    set({ backlinkQuery: query });
  },
analyzeBacklinks: async (domain) => {
    const projectIdAtStart = activeProjectId();
    if (!projectIdAtStart) {
      set({ backlinkError: i18n.t('runtimeErrors.tools.projectRequired') });
      return;
    }
    const target = (domain ?? get().backlinkQuery).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!target) return;

    if (domain !== undefined) {
      saveProjectQuery(backlinkQueryKey, domain);
      set({ backlinkQuery: domain.trim() });
    }

    const requestToken = beginToolRequest('backlink-profile');
    set({ isBacklinkLoading: true, backlinkError: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.backlinkProfileConnect'));
      const backlinkProfile = await services.createDataForSeoClient(login, password).getBacklinkProfile(target);
      if (!backlinkProfile) throw new Error(i18n.t('runtimeErrors.tools.backlinkNoProfile'));
      if (activeProjectId() !== projectIdAtStart || !isLatestToolRequest('backlink-profile', requestToken)) return;
      saveProjectResearch(backlinkProfileKey, backlinkProfile, projectIdAtStart);
      const nextHistory = saveBacklinkProfileSnapshot(
        projectIdAtStart,
        backlinkProfile,
        loadBacklinkProfileHistory(projectIdAtStart),
      );
      set({ backlinkProfile, backlinkProfileHistory: nextHistory, isBacklinkLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : i18n.t('runtimeErrors.tools.backlinkNoProfile');
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ backlinkError: msg, isBacklinkLoading: false });
    }
  },
loadMoreBacklinks: async () => {
    const projectIdAtStart = activeProjectId();
    const profile = get().backlinkProfile;
    if (!profile || get().isBacklinkLoading || profile.total_backlink_rows === null || profile.backlinks.length >= profile.total_backlink_rows) return;
    const requestToken = beginToolRequest('backlink-profile');
    set({ isBacklinkLoading: true, backlinkError: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.backlinkLoad'));
      const page = await services.createDataForSeoClient(login, password).getBacklinksPage(profile.domain, profile.backlinks.length);
      const current = get().backlinkProfile;
      if (!current || current.domain !== profile.domain || activeProjectId() !== projectIdAtStart || !isLatestToolRequest('backlink-profile', requestToken)) return;
      const nextProfile = { ...current, total_backlink_rows: page.totalCount ?? current.total_backlink_rows, backlinks: [...current.backlinks, ...page.items] };
      saveProjectResearch(backlinkProfileKey, nextProfile, projectIdAtStart);
      set({ backlinkProfile: nextProfile });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ backlinkError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.backlinkLoad') });
    } finally {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ isBacklinkLoading: false });
    }
  },
loadMoreBacklinkAnchors: async () => {
    const projectIdAtStart = activeProjectId();
    const profile = get().backlinkProfile;
    if (!profile || get().isBacklinkLoading || profile.total_anchor_rows === null || profile.anchors.length >= profile.total_anchor_rows) return;
    const requestToken = beginToolRequest('backlink-profile');
    set({ isBacklinkLoading: true, backlinkError: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.backlinkAnchorLoad'));
      const page = await services.createDataForSeoClient(login, password).getBacklinkAnchorsPage(profile.domain, profile.anchors.length, 100, profile.total_backlinks);
      const current = get().backlinkProfile;
      if (!current || current.domain !== profile.domain || activeProjectId() !== projectIdAtStart || !isLatestToolRequest('backlink-profile', requestToken)) return;
      const nextProfile = { ...current, total_anchor_rows: page.totalCount ?? current.total_anchor_rows, anchors: [...current.anchors, ...page.items] };
      saveProjectResearch(backlinkProfileKey, nextProfile, projectIdAtStart);
      set({ backlinkProfile: nextProfile });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ backlinkError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.backlinkAnchorLoad') });
    } finally {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-profile', requestToken)) set({ isBacklinkLoading: false });
    }
  },
setBacklinkGapCompetitors: (competitors) => {
    const cleaned = competitors.map((value) => value.trim()).filter(Boolean).slice(0, 19);
    saveBacklinkGapSettings(cleaned, get().backlinkGapIncludeSubdomains);
    set({ backlinkGapCompetitors: cleaned });
  },
setBacklinkGapIncludeSubdomains: (includeSubdomains) => {
    saveBacklinkGapSettings(get().backlinkGapCompetitors, includeSubdomains);
    set({ backlinkGapIncludeSubdomains: includeSubdomains });
  },
analyzeBacklinkGap: async (target, competitors, includeSubdomains) => {
    const projectIdAtStart = activeProjectId();
    const rawDomain = (target ?? get().backlinkQuery).trim();
    const rawCompetitors = (competitors ?? get().backlinkGapCompetitors).map((value) => value.trim()).filter(Boolean);
    const includeChildren = includeSubdomains ?? get().backlinkGapIncludeSubdomains;
    if (!rawDomain) return;
    const requestToken = beginToolRequest('backlink-gap');
    set({ isBacklinkGapLoading: true, backlinkGapError: null, backlinkGapReport: null });
    try {
      const domain = normalizeDataForSeoDomain(rawDomain);
      const comparisonDomains = [...new Set(rawCompetitors.map(normalizeDataForSeoDomain))].filter((competitor) => competitor !== domain);
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.backlinkConnect'));
      const client = services.createDataForSeoClient(login, password);
      const page = await client.getBacklinkGapPage(domain, comparisonDomains, 0, 100, includeChildren);
      if (activeProjectId() !== projectIdAtStart || !isLatestToolRequest('backlink-gap', requestToken)) return;
      const nextReport = {
        target: domain,
        competitors: comparisonDomains,
        include_subdomains: includeChildren,
        opportunities: page.items,
        total_rows: page.totalCount,
        rows_scanned: page.rawCount ?? page.items.length,
      } satisfies BacklinkGapReport;
      saveProjectResearch(backlinkGapReportKey, nextReport, projectIdAtStart);
      set({ backlinkGapReport: nextReport });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-gap', requestToken)) set({ backlinkGapError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.backlinkAnalyzeFailed') });
    } finally { if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-gap', requestToken)) set({ isBacklinkGapLoading: false }); }
  },
loadMoreBacklinkGap: async () => {
    const projectIdAtStart = activeProjectId();
    const report = get().backlinkGapReport;
    if (!report || get().isBacklinkGapLoading || report.total_rows === null || report.rows_scanned >= report.total_rows) return;
    const requestToken = beginToolRequest('backlink-gap');
    set({ isBacklinkGapLoading: true, backlinkGapError: null });
    try {
      const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
      if (!login || !password) throw new Error(i18n.t('runtimeErrors.tools.backlinkPageConnect'));
      const page = await services.createDataForSeoClient(login, password).getBacklinkGapPage(report.target, report.competitors, report.rows_scanned, 100, report.include_subdomains);
      const current = get().backlinkGapReport;
      if (!current || current.target !== report.target || activeProjectId() !== projectIdAtStart || !isLatestToolRequest('backlink-gap', requestToken)) return;
      const seen = new Set(current.opportunities.map((item) => item.referring_domain));
      const nextReport = {
        ...current,
        opportunities: [...current.opportunities, ...page.items.filter((item) => !seen.has(item.referring_domain))],
        total_rows: page.totalCount ?? current.total_rows,
        rows_scanned: current.rows_scanned + (page.rawCount ?? page.items.length),
      } satisfies BacklinkGapReport;
      saveProjectResearch(backlinkGapReportKey, nextReport, projectIdAtStart);
      set({ backlinkGapReport: nextReport });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-gap', requestToken)) set({ backlinkGapError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.backlinkPageFailed') });
    } finally { if (activeProjectId() === projectIdAtStart && isLatestToolRequest('backlink-gap', requestToken)) set({ isBacklinkGapLoading: false }); }
  }
});
