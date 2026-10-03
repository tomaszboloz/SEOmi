
import { CrawlRunRecord } from '@/types';
import { z } from 'zod';
import { parseCrawlConfig, parseCrawlRuns, parseSiteCrawlResult } from '@/services/crawlContracts';
import { CrawlConfigSchema } from '@/services/contracts/crawl';
import { isTauriEnvironment } from '@/services/tauri';
import { isStorageQuotaError, usesDedicatedCrawlStorage } from '@/services/crawlPersistence';

import { readJsonStorage, readStorage, removeStorage } from '@/services/storage';
import { emptyAiResearchSettings, normalizeAiResearchSettings } from '@/services/aiResearchEvidence';

import { useProjectStore } from '../projectStore';
import i18n from '@/i18n';
import { parseAiPromptComparison, parseAiResearchInputs, parseBrandAiReport, parseResearchHistory } from '@/services/researchContracts';
import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { crawlResultKey, crawlRunsKey, crawlSettingsKey, domainQueryKey, backlinkQueryKey, activeProjectId, aiBrandReportKey, aiPromptComparisonKey, aiResearchInputsKey, aiResearchSettingsKey, aiBrandSelectionKey, aiPromptSelectionKey } from './storageKeys';
import { beginToolRequest, isLatestToolRequest, formatCrawlPersistenceNotice, formatCrawlRuntimeError } from './runtime';
import { readProjectResearch, loadDomainComparisonTargets, loadDomainComparisonHistory, loadLatestDomainComparison, loadDomainOverview, loadBacklinkProfile, loadBacklinkProfileHistory, loadBacklinkGapReport } from './researchPersistence';
import { gscClientIdKey, gscClientSecretKey, gscPropertyKey, DEFAULT_GSC_FILTERS, readGscFilters, loadProjectQuery, loadKeywordQuery, loadKeywordCountry, loadKeywordLanguage, loadDomainCountry, loadDomainLanguage, loadBacklinkGapSettings } from './projectPreferences';
import { normalizeInterruptedCrawl, newestInterruptedCrawl, readInterruptedCrawl, DEFAULT_CRAWL_CONFIG, loadCrawlRequestProfiles } from './crawlPersistence';
import { loadSavedKeywords, loadTrackedRanks, defaultRankTrackingDraft, loadRankTrackingDraft, migrateLegacyToolData } from './keywordPersistence';
export const createHydrationSlice = (set: ToolsSet, _get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setMcpClientTab" | "hydrateProject"> => ({
setMcpClientTab: (tab) => set({ mcpClientTab: tab }),
hydrateProject: async (projectId) => {
    const requestToken = beginToolRequest('tools-hydration');
    const isCurrentHydration = () => activeProjectId() === projectId && isLatestToolRequest('tools-hydration', requestToken);
    beginToolRequest('gsc-session');
    beginToolRequest('gsc-data');
    beginToolRequest('gsc-inspection');
    if (!projectId) return set({ aiResearchSettings: emptyAiResearchSettings(), savedKeywords: [], trackedRanks: [], rankTrackingDraft: defaultRankTrackingDraft(), isRankLoading: false, rankError: null, crawlResult: null, crawlRuns: [], isCrawling: false, isCrawlPaused: false, crawlProgress: 0, activeCrawlRunId: null, crawlError: null, crawlPersistenceError: null, crawlPersistenceNotice: null, crawlPersistenceCompacted: false, isRetryingCrawlPersistence: false, crawlProgressDetail: null, interruptedCrawl: null, crawlUrl: '', crawlLimit: 25, crawlConfig: CrawlConfigSchema.parse(DEFAULT_CRAWL_CONFIG), crawlRequestProfiles: [], selectedCrawlRunId: null, isSavingCrawlRequestProfile: false, isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null, crawlExternalLinkCheckError: null, keywordQuery: '', keywordCountry: 'US', keywordLanguage: 'en', isKeywordLoading: false, keywordError: null, domainQuery: '', domainCountry: 'US', domainLanguage: 'en', domainOverview: null, isDomainLoading: false, domainError: null, backlinkQuery: '', backlinkProfile: null, backlinkProfileHistory: [], isBacklinkLoading: false, backlinkError: null, backlinkGapCompetitors: [], backlinkGapIncludeSubdomains: true, backlinkGapReport: null, isBacklinkGapLoading: false, backlinkGapError: null, aiBrandQuery: '', aiBrandDomain: '', aiBrandReport: null, aiBrandHistory: [], isAiBrandLoading: false, aiBrandError: null, aiSearchPrompt: '', aiPromptComparison: null, aiPromptHistory: [], isAiPromptLoading: false, aiPromptError: null, gscClientId: '', gscClientSecret: '', gscProperties: [], gscProperty: '', gscFilters: { ...DEFAULT_GSC_FILTERS }, isGscConnected: false, gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, isGscLoading: false, gscError: null, keywordResults: [], keywordResultsSource: null, domainComparison: null, domainComparisonHistory: [], domainComparisonTargets: [], isDomainComparisonLoading: false, domainComparisonError: null });
    const storedGscClientId = readStorage(gscClientIdKey(projectId)) || '';
    // The browser preview has no native credential store. Avoid an extra
    // promise turn there so project hydration remains deterministic for the
    // WebView and keeps all secrets desktop-only.
    const desktop = isTauriEnvironment();
    const storedGscClientSecret = desktop
      ? await services.secureValue(gscClientSecretKey(projectId)).catch(() => '')
      : '';
    if (desktop && !isCurrentHydration()) return;
    const storedGscProperty = readStorage(gscPropertyKey(projectId)) || '';
    const backlinkGapSettings = loadBacklinkGapSettings(projectId);
    const projectRootUrl = useProjectStore.getState().projects.find((project) => project.id === projectId)?.rootUrl || '';
    migrateLegacyToolData(projectId);
    set({ aiResearchSettings: normalizeAiResearchSettings(readProjectResearch(aiResearchSettingsKey, projectId)), savedKeywords: loadSavedKeywords(), trackedRanks: loadTrackedRanks(), rankTrackingDraft: loadRankTrackingDraft(projectId), isRankLoading: false, rankError: null, crawlResult: null, crawlRuns: [], isCrawling: false, isCrawlPaused: false, crawlProgress: 0, activeCrawlRunId: null, crawlError: null, crawlPersistenceError: null, crawlPersistenceNotice: null, crawlPersistenceCompacted: false, isRetryingCrawlPersistence: false, crawlProgressDetail: null, interruptedCrawl: readInterruptedCrawl(projectId), selectedTagFilter: null, crawlUrl: '', crawlLimit: 25, crawlConfig: CrawlConfigSchema.parse(DEFAULT_CRAWL_CONFIG), crawlRequestProfiles: loadCrawlRequestProfiles(), selectedCrawlRunId: null, isSavingCrawlRequestProfile: false, isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null, crawlExternalLinkCheckError: null, keywordQuery: loadKeywordQuery(projectId), keywordCountry: loadKeywordCountry(projectId), keywordLanguage: loadKeywordLanguage(projectId), isKeywordLoading: false, keywordError: null, domainQuery: loadProjectQuery(domainQueryKey, projectId), domainCountry: loadDomainCountry(projectId), domainLanguage: loadDomainLanguage(projectId), backlinkQuery: loadProjectQuery(backlinkQueryKey, projectId), backlinkGapCompetitors: backlinkGapSettings.competitors, backlinkGapIncludeSubdomains: backlinkGapSettings.includeSubdomains, backlinkGapReport: loadBacklinkGapReport(projectId), isBacklinkGapLoading: false, backlinkGapError: null, domainOverview: loadDomainOverview(projectId), isDomainLoading: false, domainError: null, backlinkProfile: loadBacklinkProfile(projectId), backlinkProfileHistory: loadBacklinkProfileHistory(projectId), isBacklinkLoading: false, backlinkError: null, domainComparison: loadLatestDomainComparison(projectId), domainComparisonHistory: loadDomainComparisonHistory(projectId), domainComparisonTargets: loadDomainComparisonTargets(projectId), isDomainComparisonLoading: false, domainComparisonError: null,
      aiBrandQuery: '', aiBrandDomain: '', aiBrandReport: null, aiBrandHistory: [], aiBrandError: null, isAiBrandLoading: false,
      aiSearchPrompt: '', aiPromptComparison: null, aiPromptHistory: [], aiPromptError: null, isAiPromptLoading: false,
      gscClientId: storedGscClientId, gscClientSecret: storedGscClientSecret, gscProperty: storedGscProperty, gscFilters: readGscFilters(projectId), gscProperties: [], isGscConnected: false, gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, isGscLoading: false, gscError: null, keywordResults: [], keywordResultsSource: null });
    let crawlRuns: CrawlRunRecord[] = [];
    let persistenceError: string | null = null;
    let persistenceNotice: string | null = null;
    try {
      crawlRuns = (await services.loadCrawlRuns(projectId)).filter((item): item is CrawlRunRecord => Boolean(item?.id && item?.result?.start_url));
    } catch (error) {
      persistenceError = isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.historyReadFailed');
    }
    if (!isCurrentHydration()) return;
    // Migrate legacy WebView storage once; oversized snapshots used to exhaust
    // localStorage and make a completed crawl appear to have failed.
    if (!crawlRuns.length) {
      const parsed = readJsonStorage(crawlRunsKey(projectId), []);
      crawlRuns = parseCrawlRuns(parsed);
      if (!crawlRuns.length) {
        const legacyResult = parseSiteCrawlResult(readJsonStorage(crawlResultKey(projectId), null));
        if (legacyResult?.start_url) crawlRuns = [{ id: `legacy-${Date.now()}`, completedAt: new Date().toISOString(), startUrl: legacyResult.start_url, config: { ...DEFAULT_CRAWL_CONFIG, maxPages: legacyResult.pages_crawled }, result: legacyResult }];
      }
      if (crawlRuns.length && !persistenceError) {
        try {
          const saveResult = await services.saveCrawlRuns(projectId, crawlRuns);
          if (saveResult.prunedRuns > 0) {
            crawlRuns = crawlRuns.slice(0, crawlRuns.length - saveResult.prunedRuns);
            persistenceNotice = formatCrawlPersistenceNotice(saveResult, crawlRuns.length);
          }
          if (saveResult.compactedRuns) persistenceNotice = formatCrawlPersistenceNotice(saveResult, crawlRuns.length);
          if (usesDedicatedCrawlStorage()) {
            removeStorage(crawlRunsKey(projectId));
            removeStorage(crawlResultKey(projectId));
          }
        } catch (error) {
          persistenceError = isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.historyMoveFailed');
        }
      }
    }
    if (!isCurrentHydration()) return;
    const parsedSettings = z.object({ url: z.string(), limit: z.number().finite().int().min(1).max(5000),
      config: z.preprocess(parseCrawlConfig, CrawlConfigSchema),
    }).safeParse(readJsonStorage(crawlSettingsKey(projectId), null));
    const crawlSettings = parsedSettings.success ? parsedSettings.data : null;
    // A project's root URL is the first crawl target. Keep an explicitly
    // saved crawl URL (including an intentional empty value) authoritative.
    const hydratedCrawlUrl = crawlSettings && typeof crawlSettings.url === 'string'
      ? crawlSettings.url
      : projectRootUrl;
    // Read both the new history arrays and the earlier single-result format.
    // Keep the migration in memory until the next successful run writes v1 history.
    const aiBrandHistory = parseResearchHistory(readProjectResearch(aiBrandReportKey, projectId), parseBrandAiReport);
    const aiPromptHistory = parseResearchHistory(readProjectResearch(aiPromptComparisonKey, projectId), parseAiPromptComparison);
    const savedBrandSelection = readProjectResearch(aiBrandSelectionKey, projectId);
    const savedPromptSelection = readProjectResearch(aiPromptSelectionKey, projectId);
    const aiBrandReport = aiBrandHistory.find((item) => item.timestamp === savedBrandSelection) || aiBrandHistory[0] || null;
    const aiPromptComparison = aiPromptHistory.find((item) => item.captured_at === savedPromptSelection) || aiPromptHistory[0] || null;
    const aiResearchInputs = parseAiResearchInputs(readProjectResearch(aiResearchInputsKey, projectId));
    const hydratedCompacted = Boolean(crawlRuns[0]?.storage_compacted);
    if (hydratedCompacted && !persistenceNotice) persistenceNotice = i18n.t('runtimeErrors.tools.hydratedCompacted');
    const localInterruptedCrawl = readInterruptedCrawl(projectId);
    let hydratedInterruptedCrawl = localInterruptedCrawl;
    if (isTauriEnvironment()) {
      try {
        const nativeCheckpoint = await services.invoke<unknown>('load_project_crawl_checkpoint', { projectId });
        hydratedInterruptedCrawl = newestInterruptedCrawl(
          localInterruptedCrawl,
          normalizeInterruptedCrawl(nativeCheckpoint),
        );
      } catch {
        // Keep the local compatibility copy when the native checkpoint is not
        // available while upgrading from an older release.
      }
    }
    if (!isCurrentHydration()) return;
    set({ crawlResult: crawlRuns[0]?.result || null, crawlRuns, crawlPersistenceError: persistenceError, crawlPersistenceNotice: persistenceNotice, crawlPersistenceCompacted: hydratedCompacted, interruptedCrawl: hydratedInterruptedCrawl, crawlUrl: hydratedCrawlUrl, crawlLimit: crawlSettings?.limit || 25, crawlConfig: CrawlConfigSchema.parse({ ...DEFAULT_CRAWL_CONFIG, ...crawlSettings?.config }), selectedCrawlRunId: crawlRuns[0]?.id || null,
      aiBrandQuery: aiResearchInputs.brand ?? aiBrandReport?.brand ?? '', aiBrandDomain: aiResearchInputs.domain ?? aiBrandReport?.domain ?? '', aiBrandReport, aiBrandHistory, isAiBrandLoading: false, aiBrandError: null,
      aiSearchPrompt: aiResearchInputs.prompt ?? aiPromptComparison?.prompt ?? '', aiPromptComparison, aiPromptHistory, isAiPromptLoading: false, aiPromptError: null });
  }
});
