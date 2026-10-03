import { BacklinkGapReport } from '@/types';
import { normalizeDataForSeoDomain } from '@/services/dataforseo';
import { useSettingsStore } from '../../settingsStore';
import i18n from '@/i18n';
import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { backlinkGapReportKey, activeProjectId } from '../storageKeys';
import { beginToolRequest, isLatestToolRequest } from '../runtime';
import { saveProjectResearch } from '../researchPersistence';
import { saveBacklinkGapSettings } from '../projectPreferences';

export const createBacklinkGapActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setBacklinkGapCompetitors" | "setBacklinkGapIncludeSubdomains" | "analyzeBacklinkGap" | "loadMoreBacklinkGap"> => ({
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
    if (!projectIdAtStart) return set({ backlinkGapError: i18n.t('runtimeErrors.tools.projectRequired') });
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
    if (!projectIdAtStart) return set({ backlinkGapError: i18n.t('runtimeErrors.tools.projectRequired') });
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
        opportunities: [...current.opportunities, ...page.items.filter((item) => {
          if (seen.has(item.referring_domain)) return false;
          seen.add(item.referring_domain);
          return true;
        })],
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
