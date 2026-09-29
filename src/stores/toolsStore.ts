import { create } from 'zustand';
import {
  KeywordIdea,
  SavedKeywordItem,
  TrackedRankItem,
  DomainOverviewData,
  DomainComparisonData,
  DomainComparisonHistory,
  BacklinkProfileData,
  BacklinkProfileHistory,
  BacklinkProfileSnapshot,
  BacklinkGapReport,
  SiteCrawlResult,
  CrawlConfig,
  CrawlProgress,
  CrawlRunRecord,
  CrawlEnvironment,
  CrawlRequestProfile,
  AiProvider,
  BrandAiVisibilityReport,
  AiPromptComparison,
  GscPerformanceData,
  GscPerformanceFilters,
  GscSiteProperty,
  ExternalLinkCheckBatchResult,
  ExternalLinkCheckProgress,
} from '@/types';
import { getSecureValue, invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { isStorageQuotaError, loadCrawlRuns, saveCrawlRuns, usesDedicatedCrawlStorage } from '@/services/crawlPersistence';
import { notifyCrawlCompleted } from '@/services/desktopNotifications';
import { createId } from '@/services/ids';
import { isStorageAvailable, readJsonStorage, readStorage, removeStorage, writeJsonStorage, writeStorage } from '@/services/storage';
import { DataForSEOClient, dataForSeoLanguage, dataForSeoMarket, normalizeDataForSeoDomain, requireDataForSeoMarket, resolveDataForSeoMarket } from '@/services/dataforseo';
import { useSettingsStore } from './settingsStore';
import { useAuthStore } from './authStore';
import { useProjectStore } from './projectStore';
import i18n from '@/i18n';

interface ToolsState {
  // Keyword Research
  keywordQuery: string;
  keywordCountry: string;
  keywordLanguage: string;
  keywordResults: KeywordIdea[];
  keywordResultsSource: { seedKeyword: string; countryCode: string; locationCode: number; languageCode: string; retrievedAt: string } | null;
  isKeywordLoading: boolean;
  keywordError: string | null;

  // Saved Keywords
  savedKeywords: SavedKeywordItem[];
  selectedTagFilter: string | null;

  // Rank Tracking
  trackedRanks: TrackedRankItem[];
  rankTrackingDraft: RankTrackingDraft;
  isRankLoading: boolean;
  rankError: string | null;

  // Domain Overview
  domainQuery: string;
  domainCountry: string;
  domainLanguage: string;
  domainOverview: DomainOverviewData | null;
  isDomainLoading: boolean;
  domainError: string | null;
  domainComparison: DomainComparisonData | null;
  domainComparisonHistory: DomainComparisonHistory;
  domainComparisonTargets: string[];
  isDomainComparisonLoading: boolean;
  domainComparisonError: string | null;

  // Backlinks
  backlinkQuery: string;
  backlinkProfile: BacklinkProfileData | null;
  backlinkProfileHistory: BacklinkProfileHistory;
  isBacklinkLoading: boolean;
  backlinkError: string | null;
  backlinkGapCompetitors: string[];
  backlinkGapIncludeSubdomains: boolean;
  backlinkGapReport: BacklinkGapReport | null;
  isBacklinkGapLoading: boolean;
  backlinkGapError: string | null;

  // Site Audit Crawler
  crawlUrl: string;
  crawlLimit: number;
  crawlResult: SiteCrawlResult | null;
  crawlRuns: CrawlRunRecord[];
  isCrawling: boolean;
  isCrawlPaused: boolean;
  crawlProgress: number; // 0-100
  crawlProgressDetail: CrawlProgress | null;
  interruptedCrawl: InterruptedCrawl | null;
  crawlConfig: CrawlConfig;
  crawlRequestProfiles: CrawlRequestProfile[];
  isSavingCrawlRequestProfile: boolean;
  isCheckingCrawlExternalLinks: boolean;
  crawlExternalLinkCheckProgress: ExternalLinkCheckProgress | null;
  crawlExternalLinkCheckError: string | null;
  activeCrawlRunId: string | null;
  selectedCrawlRunId: string | null;
  crawlError: string | null;
  crawlPersistenceError: string | null;
  crawlPersistenceNotice: string | null;
  /** True when the durable history is a bounded quota-recovery snapshot. */
  crawlPersistenceCompacted: boolean;
  isRetryingCrawlPersistence: boolean;

  // AI Brand Visibility (GEO)
  aiBrandQuery: string;
  aiBrandDomain: string;
  aiBrandReport: BrandAiVisibilityReport | null;
  aiBrandHistory: BrandAiVisibilityReport[];
  isAiBrandLoading: boolean;
  aiBrandError: string | null;

  // AI Search Prompts Explorer
  aiSearchPrompt: string;
  aiPromptComparison: AiPromptComparison | null;
  aiPromptHistory: AiPromptComparison[];
  isAiPromptLoading: boolean;
  aiPromptError: string | null;

  // Google Search Console
  isGscConnected: boolean;
  gscClientId: string;
  gscClientSecret: string;
  gscProperties: GscSiteProperty[];
  gscProperty: string;
  gscFilters: GscPerformanceFilters;
  gscData: GscPerformanceData | null;
  gscDataFetchedAt: string | null;
  gscInspectionResult: Record<string, unknown> | null;
  isGscLoading: boolean;
  gscError: string | null;

  // MCP client configuration UI
  mcpClientTab: 'claude' | 'cursor' | 'codex' | 'gemini';

  // Actions - Keywords
  setKeywordQuery: (q: string) => void;
  setKeywordCountry: (c: string) => void;
  setKeywordLanguage: (language: string) => void;
  searchKeywords: (query?: string, country?: string, language?: string) => Promise<void>;
  addSavedKeyword: (item: Omit<SavedKeywordItem, 'id' | 'addedAt'>) => void;
  removeSavedKeyword: (id: string) => void;
  updateKeywordTags: (id: string, tags: string[]) => void;
  setSelectedTagFilter: (tag: string | null) => void;

  // Actions - Rank Tracking
  setRankTrackingDraft: (patch: Partial<RankTrackingDraft>) => void;
  addTrackedRank: (keyword: string, domain: string, targetUrl?: string, location?: string, languageCode?: string) => void;
  removeTrackedRank: (id: string) => void;
  refreshAllRanks: () => Promise<void>;

  // Actions - Domain
  setDomainQuery: (d: string) => void;
  setDomainCountry: (country: string) => void;
  setDomainLanguage: (language: string) => void;
  analyzeDomain: (domain?: string, country?: string, language?: string) => Promise<void>;
  setDomainComparisonTargets: (targets: string[]) => void;
  compareDomains: (targets?: string[], country?: string, language?: string) => Promise<void>;

  // Actions - Backlinks
  setBacklinkQuery: (d: string) => void;
  analyzeBacklinks: (domain?: string) => Promise<void>;
  loadMoreBacklinks: () => Promise<void>;
  loadMoreBacklinkAnchors: () => Promise<void>;
  setBacklinkGapCompetitors: (competitors: string[]) => void;
  setBacklinkGapIncludeSubdomains: (include: boolean) => void;
  analyzeBacklinkGap: (target?: string, competitors?: string[], includeSubdomains?: boolean) => Promise<void>;
  loadMoreBacklinkGap: () => Promise<void>;

  // Actions - Site Audit Crawler
  setCrawlUrl: (u: string) => void;
  setCrawlLimit: (limit: number) => void;
  setCrawlConfig: (patch: Partial<CrawlConfig>) => void;
  saveCrawlRequestProfile: (input: { id?: string; name: string; userAgent: string; headers: Array<{ name: string; value: string }>; cookie: string; proxyUrl: string }) => Promise<CrawlRequestProfile>;
  deleteCrawlRequestProfile: (id: string) => Promise<void>;
  startSiteCrawl: (url?: string, limit?: number, configPatch?: Partial<CrawlConfig>, environment?: CrawlEnvironment, notifyCompletion?: boolean, resumeBaseResult?: SiteCrawlResult) => Promise<SiteCrawlResult | null>;
  cancelSiteCrawl: () => Promise<void>;
  pauseSiteCrawl: () => Promise<void>;
  resumeSiteCrawl: () => Promise<void>;
  resumeInterruptedCrawl: () => Promise<SiteCrawlResult | null>;
  importScheduledCrawlResult: (result: unknown, identity?: string) => Promise<boolean>;
  discardInterruptedCrawl: () => void;
  retryCrawlPersistence: () => Promise<void>;
  selectCrawlRun: (id: string) => void;
  deleteCrawlRun: (id: string) => Promise<void>;
  checkCrawlExternalLinks: (runId: string, maxUrls: number, force?: boolean) => Promise<void>;

  // Actions - AI Visibility
  setAiBrandQuery: (brand: string) => void;
  setAiBrandDomain: (domain: string) => void;
  analyzeAiBrandVisibility: (brand?: string, domain?: string) => Promise<void>;
  selectAiBrandReport: (timestamp: string) => void;

  // Actions - AI Prompts Explorer
  setAiSearchPrompt: (p: string) => void;
  runAiPromptComparison: (prompt?: string) => Promise<void>;
  selectAiPromptComparison: (capturedAt: string) => void;

  // Actions - GSC
  setGscProperty: (property: string) => void;
  setGscFilters: (filters: GscPerformanceFilters) => void;
  resumeGsc: () => Promise<void>;
  connectGsc: (clientId: string, clientSecret?: string) => Promise<void>;
  disconnectGsc: () => Promise<void>;
  refreshGscData: (range?: { startDate: string; endDate: string }, filters?: GscPerformanceFilters) => Promise<void>;
  inspectGscUrl: (url: string) => Promise<void>;

  // Actions - MCP
  setMcpClientTab: (tab: 'claude' | 'cursor' | 'codex' | 'gemini') => void;
  hydrateProject: (projectId: string | null) => Promise<void>;
}

export interface RankTrackingDraft {
  keyword: string;
  domain: string;
  targetUrl: string;
  location: string;
  language: string;
}

const savedKeywordsKey = (projectId: string) => `seomi_project_${projectId}_saved_keywords`;
const trackedRanksKey = (projectId: string) => `seomi_project_${projectId}_tracked_ranks`;
const rankTrackingDraftKey = (projectId: string) => `seomi_project_${projectId}_rank_tracking_draft_v1`;
const crawlResultKey = (projectId: string) => `seomi_project_${projectId}_crawl_result`;
const crawlRunsKey = (projectId: string) => `seomi_project_${projectId}_crawl_runs`;
const crawlSettingsKey = (projectId: string) => `seomi_project_${projectId}_crawl_settings`;
const crawlRequestProfilesKey = (projectId: string) => `seomi_project_${projectId}_crawl_request_profiles_v1`;
const interruptedCrawlKey = (projectId: string) => `seomi_project_${projectId}_crawl_interrupted_v1`;
const domainComparisonKey = (projectId: string) => `seomi_project_${projectId}_domain_comparison_v1`;
const domainComparisonHistoryKey = (projectId: string) => `seomi_project_${projectId}_domain_comparison_history_v1`;
const domainComparisonTargetsKey = (projectId: string) => `seomi_project_${projectId}_domain_comparison_targets_v1`;
const domainOverviewKey = (projectId: string) => `seomi_project_${projectId}_domain_overview_v1`;
const domainQueryKey = (projectId: string) => `seomi_project_${projectId}_domain_query_v1`;
const domainCountryKey = (projectId: string) => `seomi_project_${projectId}_domain_country_v1`;
const domainLanguageKey = (projectId: string) => `seomi_project_${projectId}_domain_language_v1`;
const backlinkQueryKey = (projectId: string) => `seomi_project_${projectId}_backlink_query_v1`;
const backlinkProfileKey = (projectId: string) => `seomi_project_${projectId}_backlink_profile_v1`;
const backlinkProfileHistoryKey = (projectId: string) => `seomi_project_${projectId}_backlink_profile_history_v1`;
const backlinkGapReportKey = (projectId: string) => `seomi_project_${projectId}_backlink_gap_report_v1`;
const keywordQueryKey = (projectId: string) => `seomi_project_${projectId}_keyword_query_v1`;
const keywordCountryKey = (projectId: string) => `seomi_project_${projectId}_keyword_country_v1`;
const keywordLanguageKey = (projectId: string) => `seomi_project_${projectId}_keyword_language_v1`;
/** Prefer the durable key, but keep the active in-memory project authoritative
 * when a locked-down WebView rejects localStorage access. */
const activeProjectId = () => readStorage('seomi_active_project_v1') || useProjectStore.getState().activeProjectId;
const aiBrandReportKey = (projectId: string) => `seomi_project_${projectId}_ai_brand_report_v1`;
const aiPromptComparisonKey = (projectId: string) => `seomi_project_${projectId}_ai_prompt_comparison_v1`;
const aiResearchInputsKey = (projectId: string) => `seomi_project_${projectId}_ai_research_inputs_v1`;
const aiBrandSelectionKey = (projectId: string) => `seomi_project_${projectId}_ai_brand_selection_v1`;
const aiPromptSelectionKey = (projectId: string) => `seomi_project_${projectId}_ai_prompt_selection_v1`;
const localSubscriptionProviders = (): AiProvider[] => {
  const auth = useAuthStore.getState();
  return (['openai', 'claude', 'gemini'] as AiProvider[]).filter((provider) => auth.connectionMethod[provider] === 'local_cli' && auth.isProviderConnected(provider));
};
const toolRequestTokens = new Map<string, string>();
const beginToolRequest = (kind: string): string => {
  const token = createId(`tool-${kind}`);
  toolRequestTokens.set(kind, token);
  return token;
};
const isLatestToolRequest = (kind: string, token: string): boolean => toolRequestTokens.get(kind) === token;

const formatCrawlPersistenceNotice = (saveResult: { prunedRuns: number; compactedRuns?: number }, retainedRuns: number): string | null => {
  const messages: string[] = [];
  if (saveResult.prunedRuns > 0) {
    messages.push(i18n.t('runtimeErrors.tools.quotaLimit', { retained: retainedRuns, removed: saveResult.prunedRuns }));
  }
  if ((saveResult.compactedRuns || 0) > 0) {
    messages.push(i18n.t('runtimeErrors.tools.quotaCompacted'));
  }
  return messages.length ? messages.join(' ') : null;
};

/**
 * Native IPC and WebView storage can surface the same quota failure as either
 * a DOMException, a plain string, or an OS error. Never leak that
 * implementation-level message into the crawler UI: the interrupted
 * checkpoint remains resumable and the user gets the localized recovery
 * guidance instead.
 */
const formatCrawlRuntimeError = (error: unknown): string => {
  if (isStorageQuotaError(error)) {
    return i18n.t(isTauriEnvironment() ? 'runtimeErrors.persistence.diskQuota' : 'runtimeErrors.persistence.localQuota');
  }
  return error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.externalCheckFailed');
};
const saveProjectResearch = (key: (projectId: string) => string, value: unknown, projectId = activeProjectId()) => {
  if (!projectId) return;
  writeJsonStorage(key(projectId), value);
};
const readProjectResearch = <T,>(key: (projectId: string) => string, projectId: string): T | null => {
  return readJsonStorage<T | null>(key(projectId), null);
};
const loadDomainComparisonTargets = (projectId: string): string[] => {
  const value = readProjectResearch<unknown>(domainComparisonTargetsKey, projectId);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 5) : [];
};
const loadDomainComparison = (projectId: string): DomainComparisonData | null => {
  const value = readProjectResearch<DomainComparisonData>(domainComparisonKey, projectId);
  if (!value || value.source !== 'dataforseo' || typeof value.target !== 'string' || !Array.isArray(value.rows)) return null;
  return value;
};
const normalizeDomainComparisonHistory = (value: unknown): DomainComparisonHistory => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is DomainComparisonData => Boolean(
      item
      && typeof item === 'object'
      && (item as DomainComparisonData).source === 'dataforseo'
      && typeof (item as DomainComparisonData).target === 'string'
      && Array.isArray((item as DomainComparisonData).rows)
      && typeof (item as DomainComparisonData).retrieved_at === 'string',
    ))
    .slice(-12);
};
const loadDomainComparisonHistory = (projectId: string): DomainComparisonHistory => {
  const stored = readProjectResearch<unknown>(domainComparisonHistoryKey, projectId);
  const history = normalizeDomainComparisonHistory(stored);
  if (history.length) return history;
  const current = loadDomainComparison(projectId);
  return current ? [current] : [];
};
const loadLatestDomainComparison = (projectId: string): DomainComparisonData | null => {
  const current = loadDomainComparison(projectId);
  if (current) return current;
  const history = loadDomainComparisonHistory(projectId);
  return history[history.length - 1] || null;
};
const loadDomainOverview = (projectId: string): DomainOverviewData | null => {
  const value = readProjectResearch<DomainOverviewData>(domainOverviewKey, projectId);
  if (!value || typeof value.domain !== 'string' || !Array.isArray(value.top_keywords) || !Array.isArray(value.top_pages) || !Array.isArray(value.competitors)) return null;
  return value;
};
const loadBacklinkProfile = (projectId: string): BacklinkProfileData | null => {
  const value = readProjectResearch<BacklinkProfileData>(backlinkProfileKey, projectId);
  if (!value || typeof value.domain !== 'string' || !Array.isArray(value.anchors) || !Array.isArray(value.backlinks)) return null;
  return value;
};
const normalizeBacklinkProfileHistory = (value: unknown): BacklinkProfileHistory => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is BacklinkProfileSnapshot => Boolean(
      item
      && typeof item === 'object'
      && typeof (item as BacklinkProfileSnapshot).domain === 'string'
      && typeof (item as BacklinkProfileSnapshot).retrieved_at === 'string'
      && (typeof (item as BacklinkProfileSnapshot).total_backlinks === 'number' || (item as BacklinkProfileSnapshot).total_backlinks === null)
      && (typeof (item as BacklinkProfileSnapshot).referring_domains === 'number' || (item as BacklinkProfileSnapshot).referring_domains === null)
      && (typeof (item as BacklinkProfileSnapshot).domain_rank === 'number' || (item as BacklinkProfileSnapshot).domain_rank === null)
      && (typeof (item as BacklinkProfileSnapshot).dofollow_ratio === 'number' || (item as BacklinkProfileSnapshot).dofollow_ratio === null),
    ))
    .slice(-12);
};
const loadBacklinkProfileHistory = (projectId: string): BacklinkProfileHistory => normalizeBacklinkProfileHistory(
  readProjectResearch<unknown>(backlinkProfileHistoryKey, projectId),
);
const saveBacklinkProfileSnapshot = (
  projectId: string,
  profile: BacklinkProfileData,
  history: BacklinkProfileHistory,
): BacklinkProfileHistory => {
  const snapshot: BacklinkProfileSnapshot = {
    domain: profile.domain,
    retrieved_at: new Date().toISOString(),
    total_backlinks: Number.isFinite(profile.total_backlinks) ? profile.total_backlinks : null,
    referring_domains: Number.isFinite(profile.referring_domains) ? profile.referring_domains : null,
    domain_rank: Number.isFinite(profile.domain_rank) ? profile.domain_rank : null,
    dofollow_ratio: Number.isFinite(profile.dofollow_ratio) ? profile.dofollow_ratio : null,
  };
  const next = [...history, snapshot].slice(-12);
  writeJsonStorage(backlinkProfileHistoryKey(projectId), next);
  return next;
};
const loadBacklinkGapReport = (projectId: string): BacklinkGapReport | null => {
  const value = readProjectResearch<BacklinkGapReport>(backlinkGapReportKey, projectId);
  if (!value || typeof value.target !== 'string' || !Array.isArray(value.competitors) || !Array.isArray(value.opportunities)) return null;
  return value;
};
const saveDomainComparison = (projectId: string, comparison: DomainComparisonData | null, targets: string[]) => {
  if (comparison) writeJsonStorage(domainComparisonKey(projectId), comparison);
  writeJsonStorage(domainComparisonTargetsKey(projectId), targets.slice(0, 5));
};
const saveDomainComparisonSnapshot = (projectId: string, comparison: DomainComparisonData, targets: string[], history: DomainComparisonHistory) => {
  const nextHistory = [...history.filter((item) => item.retrieved_at !== comparison.retrieved_at), comparison].slice(-12);
  saveDomainComparison(projectId, comparison, targets);
  writeJsonStorage(domainComparisonHistoryKey(projectId), nextHistory);
  return nextHistory;
};
const researchHistory = <T,>(value: T[] | T | null): T[] => !value ? [] : Array.isArray(value) ? value : [value];
const errorMessage = (error: unknown, fallback: string): string => error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;
const redactLocalContext = (value: string): string => value
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
  .replace(/(?:\/Users\/|\/home\/|C:\\Users\\)[^\s'"`]+/g, '[redacted local path]')
  .replace(/(?:^|\s)~\/[^\s'"`]+/g, ' [redacted local path]');
const hasAiBrandEvidence = (response: string, brand: string, domain: string, query: string): boolean => {
  const brandNeedle = brand.toLocaleLowerCase();
  const domainNeedle = domain.toLocaleLowerCase();
  const refusal = /\b(i\s*(do not|don't|cannot|can't|am unable)|unable to|could not|no sources?|websearch|webfetch|not enough information|not determine|not known)\b/i;
  return response.split(/(?<=[.!?])\s+/).some((sentence) => {
    const normalized = sentence.trim().toLocaleLowerCase();
    if (!normalized || normalized === query.trim().toLocaleLowerCase() || normalized.startsWith(`what is ${brandNeedle}`)) return false;
    const mentions = normalized.includes(brandNeedle) || Boolean(domainNeedle && normalized.includes(domainNeedle));
    if (!mentions) return false;
    return !refusal.test(sentence) || /https?:\/\//i.test(sentence);
  });
};
const backlinkGapSettingsKey = (projectId: string) => `seomi_backlink_gap_settings_${projectId}`;
const gscClientIdKey = (projectId: string) => `seomi_gsc_client_id_${projectId}`;
const gscClientSecretKey = (projectId: string) => `gsc_client_secret_${projectId}`;
const gscPropertyKey = (projectId: string) => `seomi_gsc_property_${projectId}`;
const gscFiltersKey = (projectId: string) => `seomi_gsc_filters_${projectId}_v1`;
const DEFAULT_GSC_FILTERS: GscPerformanceFilters = {};
const readGscFilters = (projectId: string): GscPerformanceFilters => {
  const stored = readJsonStorage<unknown>(gscFiltersKey(projectId), null);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_GSC_FILTERS };
  const value = stored as Record<string, unknown>;
  return {
    ...(typeof value.search_type === 'string' ? { search_type: value.search_type as GscPerformanceFilters['search_type'] } : {}),
    ...(typeof value.device === 'string' ? { device: value.device as GscPerformanceFilters['device'] } : {}),
    ...(typeof value.country === 'string' ? { country: value.country.toLowerCase().slice(0, 3) } : {}),
  };
};

const projectRootDomain = (projectId: string): string => {
  const rootUrl = useProjectStore.getState().projects.find((project) => project.id === projectId)?.rootUrl || '';
  if (!rootUrl.trim()) return '';
  try {
    return normalizeDataForSeoDomain(rootUrl);
  } catch {
    // Project validation already guards normal project URLs. Preserve a
    // readable value if an older project record cannot be normalized.
    return rootUrl.trim();
  }
};

const projectDefaultMarket = (projectId: string): string => {
  const domain = projectRootDomain(projectId).toLowerCase();
  const candidates = domain.split('.');
  const suffix = candidates.length > 1 ? candidates[candidates.length - 1] : '';
  const byTld = resolveDataForSeoMarket(suffix);
  return byTld?.code || 'US';
};

const loadProjectQuery = (key: (projectId: string) => string, projectId: string): string => {
  const stored = readStorage(key(projectId));
  // An empty string is intentional (the user may clear the field), therefore
  // only a missing key falls back to the project's root domain.
  return stored === null ? projectRootDomain(projectId) : stored;
};

const saveProjectQuery = (key: (projectId: string) => string, value: string, projectId = activeProjectId()): void => {
  if (projectId) writeStorage(key(projectId), value.trim());
};

const loadKeywordQuery = (projectId: string): string => readStorage(keywordQueryKey(projectId)) ?? '';
const loadKeywordCountry = (projectId: string): string => {
  const stored = readStorage(keywordCountryKey(projectId));
  return stored ? (resolveDataForSeoMarket(stored)?.code || projectDefaultMarket(projectId)) : projectDefaultMarket(projectId);
};
const loadKeywordLanguage = (projectId: string): string => {
  const country = loadKeywordCountry(projectId);
  return dataForSeoLanguage(country, readStorage(keywordLanguageKey(projectId)) || undefined);
};
const loadDomainCountry = (projectId: string): string => {
  const stored = readStorage(domainCountryKey(projectId));
  return stored ? (resolveDataForSeoMarket(stored)?.code || projectDefaultMarket(projectId)) : projectDefaultMarket(projectId);
};
const loadDomainLanguage = (projectId: string): string => {
  const country = loadDomainCountry(projectId);
  return dataForSeoLanguage(country, readStorage(domainLanguageKey(projectId)) || undefined);
};
const normalizeCrawlLinkUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
};
const loadBacklinkGapSettings = (projectId: string): { competitors: string[]; includeSubdomains: boolean } => {
  const value = readJsonStorage<unknown>(backlinkGapSettingsKey(projectId), null) as { competitors?: unknown; includeSubdomains?: unknown } | null;
  return {
    competitors: Array.isArray(value?.competitors) ? value.competitors.filter((domain: unknown): domain is string => typeof domain === 'string').slice(0, 19) : [],
    includeSubdomains: typeof value?.includeSubdomains === 'boolean' ? value.includeSubdomains : true,
  };
};
const saveBacklinkGapSettings = (competitors: string[], includeSubdomains: boolean) => {
  const projectId = activeProjectId();
  if (!projectId) return;
  writeJsonStorage(backlinkGapSettingsKey(projectId), { competitors: competitors.slice(0, 19), includeSubdomains });
};
const LEGACY_SAVED_KEYWORDS_KEY = 'seomi_saved_keywords';
const LEGACY_TRACKED_RANKS_KEY = 'seomi_tracked_ranks';
const LEGACY_TOOLS_MIGRATED_KEY = 'seomi_legacy_tools_migrated_v1';

interface CrawlProjectSettings {
  url: string;
  limit: number;
  config: CrawlConfig;
}

interface InterruptedCrawl {
  url: string;
  limit: number;
  config: CrawlConfig;
  environment: CrawlEnvironment;
  startedAt: string;
  /** Monotonic freshness marker used to reconcile WebView and native copies. */
  updatedAt: string;
  completedUrls?: string[];
  frontierUrls?: string[];
  baseRunId?: string;
}

const normalizeInterruptedCrawl = (value: unknown): InterruptedCrawl | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<InterruptedCrawl>;
  if (typeof candidate.url !== 'string' || !candidate.url.trim() || typeof candidate.limit !== 'number' || !Number.isFinite(candidate.limit) || !candidate.config || typeof candidate.config !== 'object') return null;
  const environment = candidate.environment === 'staging' || candidate.environment === 'production' ? candidate.environment : 'default';
  const startedAt = typeof candidate.startedAt === 'string' && Number.isFinite(Date.parse(candidate.startedAt))
    ? candidate.startedAt
    : new Date(0).toISOString();
  const updatedAt = typeof candidate.updatedAt === 'string' && Number.isFinite(Date.parse(candidate.updatedAt))
    ? candidate.updatedAt
    : startedAt;
  return {
    url: candidate.url,
    limit: Math.max(1, Math.min(5000, Math.floor(candidate.limit))),
    config: candidate.config as CrawlConfig,
    environment,
    startedAt,
    updatedAt,
    completedUrls: Array.isArray(candidate.completedUrls) ? candidate.completedUrls.filter((item): item is string => typeof item === 'string').slice(0, 20_000) : undefined,
    frontierUrls: Array.isArray(candidate.frontierUrls) ? candidate.frontierUrls.filter((item): item is string => typeof item === 'string').slice(0, 20_000) : undefined,
    baseRunId: typeof candidate.baseRunId === 'string' ? candidate.baseRunId : undefined,
  };
};

const interruptedCrawlTimestamp = (value: InterruptedCrawl): number => {
  const timestamp = Date.parse(value.updatedAt || value.startedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const newestInterruptedCrawl = (...values: Array<InterruptedCrawl | null>): InterruptedCrawl | null => values
  .filter((value): value is InterruptedCrawl => Boolean(value))
  .sort((left, right) => interruptedCrawlTimestamp(right) - interruptedCrawlTimestamp(left))[0] || null;

const readInterruptedCrawl = (projectId: string): InterruptedCrawl | null => normalizeInterruptedCrawl(
  readJsonStorage<Partial<InterruptedCrawl> | null>(interruptedCrawlKey(projectId), null),
);

const interruptedCrawlWrites = new Map<string, Promise<void>>();
const activeCrawlRuns = new Map<string, string>();

const persistInterruptedCrawl = (projectId: string, value: InterruptedCrawl | null): void => {
  if (value) writeJsonStorage(interruptedCrawlKey(projectId), value);
  else removeStorage(interruptedCrawlKey(projectId));

  // Keep a native copy as well. Desktop WebViews can reject localStorage or
  // evict it under pressure, while the project crawl directory is already the
  // durable home for crawl history. Queue writes per project so a final clear
  // can never overtake the checkpoint created at crawl start.
  if (!isTauriEnvironment()) return;
  const previous = interruptedCrawlWrites.get(projectId) || Promise.resolve();
  const next = previous.then(async () => {
    try {
      if (value) {
        await invokeTauriCommand('save_project_crawl_checkpoint', { projectId, checkpoint: value });
      } else {
        await invokeTauriCommand('delete_project_crawl_checkpoint', { projectId });
      }
    } catch {
      // localStorage remains the compatibility fallback; the crawl itself must
      // not be marked failed solely because checkpoint backup is unavailable.
    }
  });
  interruptedCrawlWrites.set(projectId, next);
  void next.then(() => {
    if (interruptedCrawlWrites.get(projectId) === next) interruptedCrawlWrites.delete(projectId);
  });
};

const checkpointUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
};

const buildCrawlCheckpoint = (result: SiteCrawlResult): Pick<InterruptedCrawl, 'completedUrls' | 'frontierUrls'> => {
  const completed = new Set(
    result.pages
      .flatMap((page) => [page.url, page.final_url])
      .filter(Boolean)
      .map(checkpointUrl),
  );
  const frontier = new Set<string>();
  for (const url of result.sitemap_urls || []) frontier.add(checkpointUrl(url));
  for (const page of result.pages) {
    for (const link of page.links || []) frontier.add(checkpointUrl(link.target_url));
  }
  frontier.delete('');
  for (const url of completed) frontier.delete(url);
  return {
    completedUrls: [...completed].slice(0, 20_000),
    frontierUrls: [...frontier].slice(0, 20_000),
  };
};

const mergeCrawlResults = (base: SiteCrawlResult, fresh: SiteCrawlResult): SiteCrawlResult => {
  const pagesByUrl = new Map<string, SiteCrawlResult['pages'][number]>();
  for (const page of base.pages) pagesByUrl.set(checkpointUrl(page.final_url || page.url), page);
  for (const page of fresh.pages) pagesByUrl.set(checkpointUrl(page.final_url || page.url), page);
  const pages = [...pagesByUrl.values()];
  const criticalCount = pages.flatMap((page) => page.issues || []).filter((issue) => issue.severity === 'Critical').length;
  const warningCount = pages.flatMap((page) => page.issues || []).filter((issue) => issue.severity === 'Warning').length;
  const noticeCount = pages.flatMap((page) => page.issues || []).filter((issue) => issue.severity === 'Info').length;
  const healthScore = Math.max(20, 100 - Math.min(80, criticalCount * 15 + warningCount * 5));
  const sitemapUrls = [...new Set([...(base.sitemap_urls || []), ...(fresh.sitemap_urls || [])])];
  const rejected = new Map<string, { url: string; reason: string }>();
  for (const item of [...(base.rejected_urls || []), ...(fresh.rejected_urls || [])]) rejected.set(`${item.url}\n${item.reason}`, item);
  const resources = new Map<string, NonNullable<SiteCrawlResult['resources']>[number]>();
  for (const resource of [...(base.resources || []), ...(fresh.resources || [])]) resources.set(checkpointUrl(resource.url), resource);
  return {
    ...fresh,
    start_url: base.start_url || fresh.start_url,
    pages_crawled: pages.length,
    health_score: healthScore,
    critical_count: criticalCount,
    warning_count: warningCount,
    notice_count: noticeCount,
    pages,
    duration_ms: base.duration_ms + fresh.duration_ms,
    sitemap_urls_discovered: sitemapUrls.length,
    sitemap_urls: sitemapUrls,
    rejected_urls: [...rejected.values()],
    resources: [...resources.values()],
    resource_limit_reached: Boolean(base.resource_limit_reached || fresh.resource_limit_reached),
  };
};

const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  crawlMode: 'http',
  renderWaitForSelector: '',
  renderWaitDelayMs: 0,
  renderLazyScrollCycles: 0,
  includePatterns: [],
  excludePatterns: [],
  allowSubdomains: false,
  allowedHosts: [],
  scopePath: undefined,
  keepQueryStrings: false,
  respectRobots: true,
  respectCrawlDelay: true,
  discoverSitemaps: true,
  maxRedirects: 10,
  followNofollow: false,
  maxResponseBytes: 5_000_000,
  maxRunSeconds: 300,
  requestTimeoutSecs: undefined,
  verifySsl: true,
  seedUrls: [],
  listMode: false,
  userAgent: '',
  requestProfileId: undefined,
  trimTrailingSlash: false,
  lowercasePath: false,
  stripTrackingParameters: false,
  allowedQueryParameters: [],
  deniedQueryParameters: [],
  customSearches: [],
  focusPhrase: '',
  crawlImages: false,
  crawlStylesheets: false,
  crawlScripts: false,
  crawlOtherResources: false,
  maxResourceRequests: 250,
  maxConcurrentRequests: 4,
};

const loadCrawlRequestProfiles = (): CrawlRequestProfile[] => {
  const projectId = activeProjectId();
  if (!projectId) return [];
  const raw = readJsonStorage<unknown>(crawlRequestProfilesKey(projectId), []);
  return Array.isArray(raw)
    ? raw.filter((profile): profile is CrawlRequestProfile => Boolean(
      profile && typeof profile.id === 'string' && typeof profile.name === 'string' && typeof profile.userAgent === 'string'
        && typeof profile.createdAt === 'string' && typeof profile.updatedAt === 'string',
    )).map((profile) => ({
      ...profile,
      hasProxy: Boolean(profile.hasProxy),
      hasHeaders: Boolean(profile.hasHeaders),
      hasCookie: Boolean(profile.hasCookie),
    }))
    : [];
};

const persistCrawlRequestProfiles = (profiles: CrawlRequestProfile[]) => {
  const projectId = activeProjectId();
  if (projectId) writeJsonStorage(crawlRequestProfilesKey(projectId), profiles);
};

const persistCrawlSettings = (settings: CrawlProjectSettings) => {
  const projectId = activeProjectId();
  if (projectId) writeJsonStorage(crawlSettingsKey(projectId), settings);
};

const loadSavedKeywords = (): SavedKeywordItem[] => {
  const projectId = activeProjectId();
  if (!projectId) return [];
  const value = readJsonStorage<unknown>(savedKeywordsKey(projectId), []);
  return Array.isArray(value) ? value as SavedKeywordItem[] : [];
};

const loadTrackedRanks = (): TrackedRankItem[] => {
  const projectId = activeProjectId();
  if (!projectId) return [];
  const value = readJsonStorage<unknown>(trackedRanksKey(projectId), []);
  if (!Array.isArray(value)) return [];

  // Older project snapshots stored a display name (for example
  // "United States") and did not always include language_code. Normalize the
  // persisted draft once so every subsequent provider request receives the
  // canonical ISO location and a language supported by that location.
  const normalized = value.flatMap((candidate): TrackedRankItem[] => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const raw = candidate as Partial<TrackedRankItem>;
    if (typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.keyword !== 'string') return [];
    const domain = typeof raw.domain === 'string' ? raw.domain : '';
    const locationInput = typeof raw.location === 'string' && raw.location.trim() ? raw.location : 'US';
    const location = dataForSeoMarket(locationInput).code;
    const history = Array.isArray(raw.history)
      ? raw.history.filter((point): point is { date: string; rank: number } => Boolean(
        point && typeof point === 'object' && typeof (point as { date?: unknown }).date === 'string'
          && typeof (point as { rank?: unknown }).rank === 'number' && Number.isFinite((point as { rank: number }).rank),
      )).slice(-500)
      : [];
    return [{
      id: raw.id,
      keyword: raw.keyword,
      domain,
      target_url: typeof raw.target_url === 'string' ? raw.target_url : (domain ? `https://${domain}` : ''),
      location,
      language_code: dataForSeoLanguage(location, typeof raw.language_code === 'string' ? raw.language_code : undefined),
      current_rank: typeof raw.current_rank === 'number' && Number.isFinite(raw.current_rank) ? raw.current_rank : null,
      previous_rank: typeof raw.previous_rank === 'number' && Number.isFinite(raw.previous_rank) ? raw.previous_rank : null,
      delta: typeof raw.delta === 'number' && Number.isFinite(raw.delta) ? raw.delta : null,
      best_rank: typeof raw.best_rank === 'number' && Number.isFinite(raw.best_rank) ? raw.best_rank : null,
      history,
      last_checked: typeof raw.last_checked === 'string' ? raw.last_checked : '',
    }];
  });
  if (JSON.stringify(normalized) !== JSON.stringify(value)) writeJsonStorage(trackedRanksKey(projectId), normalized);
  return normalized;
};

const defaultRankTrackingDraft = (): RankTrackingDraft => ({
  keyword: '',
  domain: '',
  targetUrl: '',
  location: 'US',
  language: 'en',
});

const loadRankTrackingDraft = (projectId: string | null = activeProjectId()): RankTrackingDraft => {
  if (!projectId) return defaultRankTrackingDraft();
  const stored = readJsonStorage<unknown>(rankTrackingDraftKey(projectId), null);
  if (!stored || typeof stored !== 'object') return defaultRankTrackingDraft();
  const value = stored as Partial<RankTrackingDraft>;
  const location = dataForSeoMarket(typeof value.location === 'string' ? value.location : 'US').code;
  return {
    keyword: typeof value.keyword === 'string' ? value.keyword : '',
    domain: typeof value.domain === 'string' ? value.domain : '',
    targetUrl: typeof value.targetUrl === 'string' ? value.targetUrl : '',
    location,
    language: dataForSeoLanguage(location, typeof value.language === 'string' ? value.language : undefined),
  };
};

/** Move only real, formerly persisted records to the first selected project.
 * Old versions did not persist keyword-search, GSC, AI or domain responses,
 * so there is intentionally nothing fabricated for those transient views. */
const migrateLegacyToolData = (projectId: string) => {
  if (!isStorageAvailable()) return;
  if (readStorage(LEGACY_TOOLS_MIGRATED_KEY)) return;

  let malformedLegacyRecord = false;
  const migrateArray = (legacyKey: string, destinationKey: string) => {
    if (readStorage(destinationKey)) return;
    const raw = readStorage(legacyKey);
    if (!raw) return;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      malformedLegacyRecord = true;
      return;
    }
    if (Array.isArray(parsed)) writeJsonStorage(destinationKey, parsed);
  };

  migrateArray(LEGACY_SAVED_KEYWORDS_KEY, savedKeywordsKey(projectId));
  migrateArray(LEGACY_TRACKED_RANKS_KEY, trackedRanksKey(projectId));
  if (malformedLegacyRecord) return;
  removeStorage(LEGACY_SAVED_KEYWORDS_KEY);
  removeStorage(LEGACY_TRACKED_RANKS_KEY);
  writeStorage(LEGACY_TOOLS_MIGRATED_KEY, 'true');
};

export const useToolsStore = create<ToolsState>((set, get) => ({
  // Keywords
  keywordQuery: activeProjectId() ? loadKeywordQuery(activeProjectId()!) : '',
  keywordCountry: activeProjectId() ? loadKeywordCountry(activeProjectId()!) : 'US',
  keywordLanguage: activeProjectId() ? loadKeywordLanguage(activeProjectId()!) : 'en',
  keywordResults: [],
  keywordResultsSource: null,
  isKeywordLoading: false,
  keywordError: null,

  savedKeywords: loadSavedKeywords(),
  selectedTagFilter: null,

  // Rank Tracking
  trackedRanks: loadTrackedRanks(),
  rankTrackingDraft: loadRankTrackingDraft(),
  isRankLoading: false,
  rankError: null,

  // Domain Overview
  domainQuery: activeProjectId() ? loadProjectQuery(domainQueryKey, activeProjectId()!) : '',
  domainCountry: activeProjectId() ? loadDomainCountry(activeProjectId()!) : 'US',
  domainLanguage: activeProjectId() ? loadDomainLanguage(activeProjectId()!) : 'en',
  domainOverview: activeProjectId() ? loadDomainOverview(activeProjectId()!) : null,
  isDomainLoading: false,
  domainError: null,
  domainComparison: activeProjectId() ? loadLatestDomainComparison(activeProjectId()!) : null,
  domainComparisonHistory: activeProjectId() ? loadDomainComparisonHistory(activeProjectId()!) : [],
  domainComparisonTargets: activeProjectId() ? loadDomainComparisonTargets(activeProjectId()!) : [],
  isDomainComparisonLoading: false,
  domainComparisonError: null,

  // Backlinks
  backlinkQuery: activeProjectId() ? loadProjectQuery(backlinkQueryKey, activeProjectId()!) : '',
  backlinkProfile: activeProjectId() ? loadBacklinkProfile(activeProjectId()!) : null,
  backlinkProfileHistory: activeProjectId() ? loadBacklinkProfileHistory(activeProjectId()!) : [],
  isBacklinkLoading: false,
  backlinkError: null,
  backlinkGapCompetitors: activeProjectId() ? loadBacklinkGapSettings(activeProjectId()!).competitors : [],
  backlinkGapIncludeSubdomains: activeProjectId() ? loadBacklinkGapSettings(activeProjectId()!).includeSubdomains : true,
  backlinkGapReport: activeProjectId() ? loadBacklinkGapReport(activeProjectId()!) : null,
  isBacklinkGapLoading: false,
  backlinkGapError: null,

  // Crawler
  crawlUrl: '',
  crawlLimit: 25,
  crawlResult: null,
  crawlRuns: [],
  isCrawling: false,
  isCrawlPaused: false,
  crawlProgress: 0,
  crawlProgressDetail: null,
  interruptedCrawl: null,
  crawlConfig: DEFAULT_CRAWL_CONFIG,
  crawlRequestProfiles: loadCrawlRequestProfiles(),
  isSavingCrawlRequestProfile: false,
  isCheckingCrawlExternalLinks: false,
  crawlExternalLinkCheckProgress: null,
  crawlExternalLinkCheckError: null,
  activeCrawlRunId: null,
  selectedCrawlRunId: null,
  crawlError: null,
  crawlPersistenceError: null,
  crawlPersistenceNotice: null,
  crawlPersistenceCompacted: false,
  isRetryingCrawlPersistence: false,

  // AI Brand Visibility
  aiBrandQuery: '',
  aiBrandDomain: '',
  aiBrandReport: null,
  aiBrandHistory: [],
  isAiBrandLoading: false,
  aiBrandError: null,

  // AI Prompt Comparison
  aiSearchPrompt: '',
  aiPromptComparison: null,
  aiPromptHistory: [],
  isAiPromptLoading: false,
  aiPromptError: null,

  // GSC
  isGscConnected: false,
  gscClientId: activeProjectId() ? readStorage(gscClientIdKey(activeProjectId()!)) || '' : '',
  gscClientSecret: '',
  gscProperties: [],
  gscProperty: activeProjectId() ? readStorage(gscPropertyKey(activeProjectId()!)) || '' : '',
  gscFilters: activeProjectId() ? readGscFilters(activeProjectId()!) : { ...DEFAULT_GSC_FILTERS },
  gscData: null,
  gscDataFetchedAt: null,
  gscInspectionResult: null,
  isGscLoading: false,
  gscError: null,

  // MCP client configuration UI
  mcpClientTab: 'claude',

  // -------------------------------------------------------------
  // Keywords Actions
  // -------------------------------------------------------------
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
    set({ keywordCountry: country, keywordLanguage: language });
  },
  setKeywordLanguage: (language) => {
    const country = get().keywordCountry;
    const normalized = dataForSeoLanguage(country, language);
    const projectId = activeProjectId();
    if (projectId) writeStorage(keywordLanguageKey(projectId), normalized);
    set({ keywordLanguage: normalized });
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
      const keywordResults = await new DataForSEOClient(login, password).getKeywordIdeas(
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
  },

  addSavedKeyword: (item) => {
    const existing = get().savedKeywords;
    if (existing.some((k) => k.keyword.toLowerCase() === item.keyword.toLowerCase())) {
      return;
    }
    const newItem: SavedKeywordItem = {
      ...item,
      id: createId('k'),
      addedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...existing];
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(savedKeywordsKey(projectId), updated);
    set({ savedKeywords: updated });
  },

  removeSavedKeyword: (id) => {
    const updated = get().savedKeywords.filter((k) => k.id !== id);
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(savedKeywordsKey(projectId), updated);
    set({ savedKeywords: updated });
  },

  updateKeywordTags: (id, tags) => {
    const updated = get().savedKeywords.map((k) => (k.id === id ? { ...k, tags } : k));
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(savedKeywordsKey(projectId), updated);
    set({ savedKeywords: updated });
  },

  // -------------------------------------------------------------
  // Rank Tracking Actions
  // -------------------------------------------------------------
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
      id: `r-${Date.now()}`,
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
      const client = new DataForSEOClient(login, password);
      const date = new Date().toISOString().slice(0, 10);
      const attempts = await Promise.allSettled(trackedRanks.map(async (item) => {
        const languageCode = dataForSeoLanguage(item.location, item.language_code);
        const rows = await client.getSerpCompetitors(item.keyword, requireDataForSeoMarket(item.location).locationCode, languageCode);
        const found = rows.find((row) => row.domain === item.domain || row.domain.endsWith(`.${item.domain}`));
        const currentRank = found ? (found.rank_absolute > 100 ? 101 : found.rank_absolute) : null;
        return {
          ...item,
          language_code: languageCode,
          previous_rank: item.current_rank,
          current_rank: currentRank,
          delta: item.current_rank !== null && currentRank !== null ? item.current_rank - currentRank : null,
          best_rank: item.best_rank !== null && currentRank !== null && currentRank <= 100 ? Math.min(item.best_rank, currentRank) : (currentRank !== null && currentRank <= 100 ? currentRank : item.best_rank),
          history: currentRank !== null ? [...item.history, { date, rank: currentRank }].slice(-90) : item.history,
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
  },

  // -------------------------------------------------------------
  // Domain Overview Actions
  // -------------------------------------------------------------
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
    set({ domainCountry: normalized, domainLanguage: language });
  },
  setDomainLanguage: (language) => {
    const normalized = dataForSeoLanguage(get().domainCountry, language);
    const projectId = activeProjectId();
    if (projectId) writeStorage(domainLanguageKey(projectId), normalized);
    set({ domainLanguage: normalized });
  },
  analyzeDomain: async (domain, country, language) => {
    const projectIdAtStart = activeProjectId();
    const target = (domain ?? get().domainQuery).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!target) return;

    if (country) get().setDomainCountry(country);
    if (language) get().setDomainLanguage(language);
    const selectedCountry = country || get().domainCountry;
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
      const domainOverview = await new DataForSEOClient(login, password).getDomainOverview(target, requireDataForSeoMarket(selectedCountry).locationCode, selectedLanguage);
      if (!domainOverview) throw new Error(i18n.t('runtimeErrors.tools.domainNoOverview'));
      if (activeProjectId() !== projectIdAtStart || !isLatestToolRequest('domain-overview', requestToken)) return;
      saveProjectResearch(domainOverviewKey, domainOverview, projectIdAtStart);
      set({ domainOverview, isDomainLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : i18n.t('runtimeErrors.tools.domainNoOverview');
      if (activeProjectId() === projectIdAtStart && isLatestToolRequest('domain-overview', requestToken)) set({ domainError: msg, isDomainLoading: false });
    }
  },

  setDomainComparisonTargets: (targets) => {
    const normalized = Array.from(new Set(targets.map((value) => value.trim()).filter(Boolean))).slice(0, 5);
    const projectId = activeProjectId();
    if (projectId) saveDomainComparison(projectId, get().domainComparison, normalized);
    set({ domainComparisonTargets: normalized });
  },

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
      const client = new DataForSEOClient(login, password);
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
      if (!rows.length) throw new Error(failed[0]?.reason instanceof Error ? failed[0].reason.message : i18n.t('runtimeErrors.tools.dataforseoNoComparison'));
      const comparison: DomainComparisonData = {
        target: normalizedTargets[0], rows, location_code: requireDataForSeoMarket(selectedCountry).locationCode, language_code: selectedLanguage, retrieved_at: retrievedAt, source: 'dataforseo',
      };
      if (activeProjectId() !== projectId || !isLatestToolRequest('domain-comparison', requestToken)) return;
      const nextHistory = saveDomainComparisonSnapshot(projectId, comparison, normalizedTargets, loadDomainComparisonHistory(projectId));
      set({ domainComparison: comparison, domainComparisonHistory: nextHistory, domainComparisonTargets: normalizedTargets, domainComparisonError: failed.length ? i18n.t('runtimeErrors.tools.comparisonPartial', { rows: rows.length, total: normalizedTargets.length, failed: failed.length }) : null, isDomainComparisonLoading: false });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('domain-comparison', requestToken)) set({ domainComparisonError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.comparisonFailed'), isDomainComparisonLoading: false });
    }
  },

  // -------------------------------------------------------------
  // Backlink Actions
  // -------------------------------------------------------------
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
      const backlinkProfile = await new DataForSEOClient(login, password).getBacklinkProfile(target);
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
      const page = await new DataForSEOClient(login, password).getBacklinksPage(profile.domain, profile.backlinks.length);
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
      const page = await new DataForSEOClient(login, password).getBacklinkAnchorsPage(profile.domain, profile.anchors.length, 100, profile.total_backlinks);
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
      const client = new DataForSEOClient(login, password);
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
      const page = await new DataForSEOClient(login, password).getBacklinkGapPage(report.target, report.competitors, report.rows_scanned, 100, report.include_subdomains);
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
  },

  // -------------------------------------------------------------
  // Site Audit Crawler Actions
  // -------------------------------------------------------------
  setCrawlUrl: (u) => {
    set({ crawlUrl: u });
    persistCrawlSettings({ url: u, limit: get().crawlLimit, config: get().crawlConfig });
  },
  setCrawlLimit: (limit) => {
    set({ crawlLimit: limit });
    persistCrawlSettings({ url: get().crawlUrl, limit, config: get().crawlConfig });
  },
  setCrawlConfig: (patch) => {
    const config = { ...get().crawlConfig, ...patch };
    set({ crawlConfig: config });
    persistCrawlSettings({ url: get().crawlUrl, limit: get().crawlLimit, config });
  },
  saveCrawlRequestProfile: async ({ id, name, userAgent, headers, cookie, proxyUrl }) => {
    const projectId = activeProjectId();
    if (!projectId) throw new Error(i18n.t('runtimeErrors.tools.profileProject'));
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error(i18n.t('runtimeErrors.tools.profileName'));
    if (normalizedName.length > 80) throw new Error(i18n.t('runtimeErrors.tools.profileNameLength'));
    if (userAgent.length > 1024) throw new Error(i18n.t('runtimeErrors.tools.userAgentLength'));
    const profileId = id || createId('profile');
    const previous = get().crawlRequestProfiles.find((profile) => profile.id === profileId);
    set({ isSavingCrawlRequestProfile: true });
    try {
      await invokeTauriCommand('save_crawl_auth_profile', { projectId, profileId, headers, cookie: cookie || null, proxyUrl: proxyUrl || null });
      const now = new Date().toISOString();
      const profile: CrawlRequestProfile = {
        id: profileId,
        name: normalizedName,
        userAgent: userAgent.trim(),
        hasProxy: Boolean(proxyUrl.trim()),
        hasHeaders: headers.length > 0,
        hasCookie: Boolean(cookie.trim()),
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      };
      // The native write belongs to the originating project, but a project
      // switch during the request must not hydrate that project's UI with the
      // old profile or persist settings under the newly active project.
      if (activeProjectId() !== projectId) return profile;
      const crawlRequestProfiles = [profile, ...get().crawlRequestProfiles.filter((candidate) => candidate.id !== profileId)];
      persistCrawlRequestProfiles(crawlRequestProfiles);
      const crawlConfig = { ...get().crawlConfig, requestProfileId: profile.id, userAgent: profile.userAgent };
      persistCrawlSettings({ url: get().crawlUrl, limit: get().crawlLimit, config: crawlConfig });
      set({ crawlRequestProfiles, crawlConfig });
      return profile;
    } finally {
      if (activeProjectId() === projectId) set({ isSavingCrawlRequestProfile: false });
    }
  },
  deleteCrawlRequestProfile: async (id) => {
    const projectId = activeProjectId();
    if (!projectId) throw new Error(i18n.t('runtimeErrors.tools.profileDeleteProject'));
    await invokeTauriCommand('delete_crawl_auth_profile', { projectId, profileId: id });
    if (activeProjectId() !== projectId) return;
    const crawlRequestProfiles = get().crawlRequestProfiles.filter((profile) => profile.id !== id);
    persistCrawlRequestProfiles(crawlRequestProfiles);
    const crawlConfig = get().crawlConfig.requestProfileId === id
      ? { ...get().crawlConfig, requestProfileId: undefined }
      : get().crawlConfig;
    persistCrawlSettings({ url: get().crawlUrl, limit: get().crawlLimit, config: crawlConfig });
    set({ crawlRequestProfiles, crawlConfig });
  },

  startSiteCrawl: async (url, limit, configPatch, environment = 'default', notifyCompletion = true, resumeBaseResult) => {
    const targetUrl = (url ?? get().crawlUrl).trim();
    const maxLimit = limit ?? get().crawlLimit;
    if (!targetUrl) return null;
    const projectIdAtStart = activeProjectId();
    const previousRun = projectIdAtStart
      ? get().crawlRuns.find((run) => run.startUrl === targetUrl)
      : undefined;

    const effectiveCrawlConfig: CrawlConfig = {
      ...get().crawlConfig,
      ...(configPatch || {}),
      maxPages: maxLimit,
    };
    const appConfig = useSettingsStore.getState().config;
    effectiveCrawlConfig.maxRedirects = effectiveCrawlConfig.maxRedirects ?? appConfig.max_redirects;
    effectiveCrawlConfig.userAgent = effectiveCrawlConfig.userAgent?.trim() || appConfig.default_user_agent;
    effectiveCrawlConfig.requestTimeoutSecs = appConfig.request_timeout_secs;
    effectiveCrawlConfig.verifySsl = appConfig.verify_ssl;
    // Resume arrays are execution-only checkpoint inputs. Keep them out of
    // the durable crawl history/configuration so a large frontier cannot
    // consume the same storage quota that caused the interruption.
    const persistedCrawlConfig: CrawlConfig = {
      ...effectiveCrawlConfig,
      resumeCompletedUrls: undefined,
      resumeFrontierUrls: undefined,
    };
    const interruptedCrawl: InterruptedCrawl = {
      url: targetUrl,
      limit: Math.max(1, Math.min(5000, Math.floor(maxLimit))),
      config: persistedCrawlConfig,
      environment,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const runId = createId('crawl');
    const isCurrentCrawlRun = () => activeProjectId() === projectIdAtStart && get().activeCrawlRunId === runId;
    if (projectIdAtStart) activeCrawlRuns.set(projectIdAtStart, runId);
    let unlisten: (() => void) | undefined;
    if (projectIdAtStart) persistInterruptedCrawl(projectIdAtStart, interruptedCrawl);
    set({ isCrawling: true, isCrawlPaused: false, interruptedCrawl: null, crawlProgress: 0, crawlProgressDetail: { runId, discovered: 1, completed: 0, queued: 1, cancelled: false, paused: false, elapsedMs: 0, pagesPerSecond: 0 }, activeCrawlRunId: runId, crawlError: null, crawlPersistenceError: null, crawlPersistenceNotice: null, crawlPersistenceCompacted: false, isRetryingCrawlPersistence: false });
    try {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<CrawlProgress>('crawl-progress', (event) => {
          const progress = event.payload;
          if (progress.runId !== runId) return;
          // A crawl keeps running for its originating project even when the
          // user navigates to another workspace. Do not let its telemetry
          // overwrite the newly selected project's progress state.
          if (!isCurrentCrawlRun()) return;
          const known = Math.max(progress.discovered, 1);
          set({ crawlProgressDetail: progress, crawlProgress: Math.floor((progress.completed / known) * 100) });
        });
      }
      const freshCrawlResult = await invokeTauriCommand<SiteCrawlResult>('crawl_site', { startUrl: targetUrl, maxPages: maxLimit, runId, projectId: projectIdAtStart || undefined, config: effectiveCrawlConfig });
      if (!freshCrawlResult.pages.length && !freshCrawlResult.cancelled && !resumeBaseResult) throw new Error(i18n.t('runtimeErrors.tools.crawlerNoPages'));
      const crawlResult = resumeBaseResult ? mergeCrawlResults(resumeBaseResult, freshCrawlResult) : freshCrawlResult;
      const run: CrawlRunRecord = { id: runId, completedAt: new Date().toISOString(), startUrl: targetUrl, config: persistedCrawlConfig, result: crawlResult, environment };
      const crawlRuns = [run, ...get().crawlRuns.filter((item) => item.id !== run.id)].slice(0, 50);
      const projectId = projectIdAtStart;
      const canResume = Boolean(freshCrawlResult.cancelled || freshCrawlResult.timed_out);
      const checkpoint = canResume ? buildCrawlCheckpoint(crawlResult) : null;
      const pendingCrawl = canResume ? { ...interruptedCrawl, ...(checkpoint || {}), baseRunId: runId } : null;
      if (projectId && activeCrawlRuns.get(projectId) === runId) persistInterruptedCrawl(projectId, pendingCrawl);
      if (isCurrentCrawlRun()) {
        set({ crawlResult, crawlRuns, isCrawling: false, isCrawlPaused: false, interruptedCrawl: pendingCrawl, crawlProgress: 100, activeCrawlRunId: null, selectedCrawlRunId: runId });
      }
      if (projectId) {
        try {
          const saveResult = await saveCrawlRuns(projectId, crawlRuns);
          const retainedRuns = crawlRuns.slice(0, crawlRuns.length - saveResult.prunedRuns);
          if (usesDedicatedCrawlStorage()) {
            removeStorage(crawlResultKey(projectId));
            removeStorage(crawlRunsKey(projectId));
          }
          if (activeProjectId() === projectId) set({ crawlRuns: retainedRuns, crawlPersistenceError: null, crawlPersistenceNotice: formatCrawlPersistenceNotice(saveResult, retainedRuns.length), crawlPersistenceCompacted: Boolean(saveResult.compactedRuns) });
        } catch (error) {
          if (activeProjectId() === projectId) set({ crawlPersistenceError: isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.crawlHistorySaveFailed') });
        }
      }
      if (projectId && notifyCompletion) {
        void notifyCrawlCompleted(projectId, crawlResult, previousRun?.result.health_score);
      }
      return crawlResult;
    } catch (err: unknown) {
      const msg = formatCrawlRuntimeError(err);
      if (projectIdAtStart && activeCrawlRuns.get(projectIdAtStart) === runId) persistInterruptedCrawl(projectIdAtStart, interruptedCrawl);
      if (isCurrentCrawlRun()) {
        set({ crawlError: msg, interruptedCrawl, isCrawling: false, isCrawlPaused: false, activeCrawlRunId: null });
      }
      return null;
    } finally {
      unlisten?.();
    }
  },

  cancelSiteCrawl: async () => {
    const projectIdAtStart = activeProjectId();
    const runId = get().activeCrawlRunId;
    if (!runId) return;
    try {
      await invokeTauriCommand('cancel_site_crawl', { runId });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && get().activeCrawlRunId === runId) {
        set({ crawlError: formatCrawlRuntimeError(error) });
      }
    }
  },
  pauseSiteCrawl: async () => {
    const projectIdAtStart = activeProjectId();
    const runId = get().activeCrawlRunId;
    if (!runId || !get().isCrawling || get().isCrawlPaused) return;
    try {
      await invokeTauriCommand('pause_site_crawl', { runId });
      if (activeProjectId() !== projectIdAtStart || get().activeCrawlRunId !== runId) return;
      const progress = get().crawlProgressDetail;
      set({ isCrawlPaused: true, crawlProgressDetail: progress ? { ...progress, paused: true } : null });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && get().activeCrawlRunId === runId) {
        set({ crawlError: formatCrawlRuntimeError(error) });
      }
    }
  },
  resumeSiteCrawl: async () => {
    const projectIdAtStart = activeProjectId();
    const runId = get().activeCrawlRunId;
    if (!runId || !get().isCrawling || !get().isCrawlPaused) return;
    try {
      await invokeTauriCommand('resume_site_crawl', { runId });
      if (activeProjectId() !== projectIdAtStart || get().activeCrawlRunId !== runId) return;
      const progress = get().crawlProgressDetail;
      set({ isCrawlPaused: false, crawlProgressDetail: progress ? { ...progress, paused: false } : null });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && get().activeCrawlRunId === runId) {
        set({ crawlError: formatCrawlRuntimeError(error) });
      }
    }
  },
  resumeInterruptedCrawl: async () => {
    const pending = get().interruptedCrawl;
    if (!pending || get().isCrawling) return null;
    const baseRun = pending.baseRunId ? get().crawlRuns.find((run) => run.id === pending.baseRunId) : undefined;
    const config = baseRun && pending.completedUrls?.length
      ? { ...pending.config, resumeCompletedUrls: pending.completedUrls, resumeFrontierUrls: pending.frontierUrls || [] }
      : pending.config;
    return get().startSiteCrawl(pending.url, pending.limit, config, pending.environment, true, baseRun?.result);
  },
  importScheduledCrawlResult: async (result, identity) => {
    if (!result || typeof result !== 'object') return false;
    const candidate = result as Partial<SiteCrawlResult>;
    if (typeof candidate.start_url !== 'string' || !Array.isArray(candidate.pages)) return false;
    const projectId = activeProjectId();
    if (!projectId) return false;
    const crawlResult = result as SiteCrawlResult;
    const safeIdentity = identity?.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
    const run: CrawlRunRecord = {
      id: safeIdentity ? `scheduled-crawl-${safeIdentity}` : createId('scheduled-crawl'),
      completedAt: new Date().toISOString(),
      startUrl: crawlResult.start_url,
      config: { ...get().crawlConfig, maxPages: crawlResult.pages_crawled },
      result: crawlResult,
      environment: 'default',
    };
    // The handoff identity is stable for one native execution, so it is the
    // only deduplication key we need here. Do not collapse older snapshots
    // merely because they crawled the same URL: scheduled runs must remain
    // available for trend/diff history and must not overwrite manual runs.
    const crawlRuns = [run, ...get().crawlRuns.filter((item) => item.id !== run.id)].slice(0, 50);
    try {
      const saveResult = await saveCrawlRuns(projectId, crawlRuns);
      const retainedRuns = crawlRuns.slice(0, crawlRuns.length - saveResult.prunedRuns);
      if (activeProjectId() !== projectId) return false;
      set({ crawlResult, crawlRuns: retainedRuns, selectedCrawlRunId: run.id, interruptedCrawl: null, crawlPersistenceError: null, crawlPersistenceNotice: formatCrawlPersistenceNotice(saveResult, retainedRuns.length), crawlPersistenceCompacted: Boolean(saveResult.compactedRuns) });
      return true;
    } catch (error) {
      if (activeProjectId() === projectId) set({ crawlResult, crawlPersistenceError: isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.crawlHistorySaveFailed') });
      return false;
    }
  },
  discardInterruptedCrawl: () => {
    const projectId = activeProjectId();
    if (projectId) persistInterruptedCrawl(projectId, null);
    set({ interruptedCrawl: null });
  },
  retryCrawlPersistence: async () => {
    const projectId = activeProjectId();
    const runs = get().crawlRuns;
    if (!projectId) {
      set({ crawlPersistenceError: i18n.t('runtimeErrors.tools.projectRequired') });
      return;
    }
    if (!runs.length) {
      set({ crawlPersistenceError: i18n.t('runtimeErrors.tools.noPendingCrawl') });
      return;
    }

    set({ isRetryingCrawlPersistence: true });
    try {
      const saveResult = await saveCrawlRuns(projectId, runs);
      const retainedRuns = runs.slice(0, runs.length - saveResult.prunedRuns);
      if (usesDedicatedCrawlStorage()) {
        // The dedicated store already contains the snapshot; legacy cleanup
        // is best effort and must not turn a successful retry into an error.
        removeStorage(crawlResultKey(projectId));
        removeStorage(crawlRunsKey(projectId));
      }
      if (activeProjectId() === projectId) {
        const retainedCompacted = Boolean(saveResult.compactedRuns) || Boolean(retainedRuns[0]?.storage_compacted);
        set({
          crawlRuns: retainedRuns,
          crawlPersistenceError: null,
          crawlPersistenceNotice: formatCrawlPersistenceNotice(saveResult, retainedRuns.length) || (retainedCompacted ? i18n.t('runtimeErrors.tools.boundedResave') : i18n.t('runtimeErrors.tools.historyResaved')),
          crawlPersistenceCompacted: retainedCompacted,
        });
      }
    } catch (error) {
      if (activeProjectId() === projectId) set({ crawlPersistenceError: isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.crawlHistoryResaveFailed'), crawlPersistenceCompacted: false });
    } finally {
      if (activeProjectId() === projectId) set({ isRetryingCrawlPersistence: false });
    }
  },
  selectCrawlRun: (id) => {
    const run = get().crawlRuns.find((item) => item.id === id);
    if (run) set({ crawlResult: run.result, crawlError: null, crawlExternalLinkCheckError: null, selectedCrawlRunId: id });
  },
  deleteCrawlRun: async (id) => {
    if (get().isCrawling) {
      set({ crawlPersistenceError: i18n.t('runtimeErrors.tools.activeCrawlDelete') });
      return;
    }
    const projectId = activeProjectId();
    const previousRuns = get().crawlRuns;
    const run = previousRuns.find((candidate) => candidate.id === id);
    if (!projectId || !run) {
      set({ crawlPersistenceError: !projectId ? i18n.t('runtimeErrors.tools.runDeleteProject') : i18n.t('runtimeErrors.tools.runUnavailable') });
      return;
    }

    const nextRuns = previousRuns.filter((candidate) => candidate.id !== id);
    const currentRunId = get().selectedCrawlRunId
      || previousRuns.find((candidate) => candidate.result === get().crawlResult)?.id
      || previousRuns[0]?.id;
    const selectedWasDeleted = currentRunId === id;
    const nextSelectedRun = selectedWasDeleted
      ? nextRuns[0]
      : nextRuns.find((candidate) => candidate.id === get().selectedCrawlRunId);
    const previousResult = get().crawlResult;
    const previousSelectedRunId = get().selectedCrawlRunId;
    if (activeProjectId() === projectId) {
      set({
        crawlRuns: nextRuns,
        crawlResult: selectedWasDeleted ? (nextSelectedRun?.result || null) : previousResult,
        selectedCrawlRunId: selectedWasDeleted ? (nextSelectedRun?.id || null) : previousSelectedRunId,
        crawlPersistenceError: null,
        crawlPersistenceNotice: null,
      });
    }

    try {
      await saveCrawlRuns(projectId, nextRuns);
      if (usesDedicatedCrawlStorage()) {
        removeStorage(crawlResultKey(projectId));
        removeStorage(crawlRunsKey(projectId));
      }
      if (activeProjectId() === projectId) {
        set({ crawlPersistenceError: null, crawlPersistenceNotice: i18n.t('runtimeErrors.tools.runDeleted', { count: nextRuns.length }), crawlPersistenceCompacted: false });
      }
    } catch (error) {
      if (activeProjectId() === projectId) {
        set({
          crawlRuns: previousRuns,
          crawlResult: previousResult,
          selectedCrawlRunId: previousSelectedRunId,
          crawlPersistenceError: isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.runDeleteFailed'),
        });
      }
    }
  },
  checkCrawlExternalLinks: async (runId, maxUrls, force = false) => {
    const projectId = activeProjectId();
    const sourceRuns = get().crawlRuns;
    const run = sourceRuns.find((candidate) => candidate.id === runId);
    if (!projectId || !run) {
      set({ crawlExternalLinkCheckError: i18n.t('runtimeErrors.tools.runRequired') });
      return;
    }
    if (get().isCheckingCrawlExternalLinks) return;

    const uncheckedUrls = [...new Set(run.result.pages.flatMap((page) => page.links
      .filter((link) => !link.is_internal && (force || !link.target_checked_at))
      .map((link) => normalizeCrawlLinkUrl(link.target_url))))];
    if (!uncheckedUrls.length) {
      set({ crawlExternalLinkCheckError: i18n.t('runtimeErrors.tools.externalCheckNoNew') });
      return;
    }

    const requestId = createId('external-links');
    const maxCount = Math.min(Math.max(Math.floor(maxUrls), 1), 1_000);
    const isCurrentExternalCheck = () => activeProjectId() === projectId && get().crawlExternalLinkCheckProgress?.requestId === requestId;
    let unlisten: (() => void) | undefined;
    set({
      isCheckingCrawlExternalLinks: true,
      crawlExternalLinkCheckProgress: { requestId, completed: 0, total: Math.min(uncheckedUrls.length, maxCount), currentUrl: '' },
      crawlExternalLinkCheckError: null,
    });
    try {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<ExternalLinkCheckProgress>('crawl-external-link-progress', (event) => {
          if (event.payload.requestId !== requestId) return;
          if (isCurrentExternalCheck()) set({ crawlExternalLinkCheckProgress: event.payload });
        });
      }
      const batch = await invokeTauriCommand<ExternalLinkCheckBatchResult>('check_external_crawl_links', {
        requestId,
        urls: uncheckedUrls,
        maxUrls: maxCount,
      });
      // Continue persisting to the originating project if the request
      // completed after navigation, but never let stale results mutate the
      // newly selected project's visible state.
      // Resolve the originating run again before applying a delayed response.
      // The user can delete a run or select another one while the external
      // requests are in flight. Never resurrect a deleted run from the stale
      // snapshot captured when the request started.
      const activeProjectAtResolution = activeProjectId();
      const latestRuns = activeProjectAtResolution === projectId
        ? get().crawlRuns
        : await loadCrawlRuns(projectId);
      const latestRun = latestRuns.find((candidate) => candidate.id === runId);
      if (!latestRun) {
        if (activeProjectAtResolution === projectId) {
          set({ crawlExternalLinkCheckError: i18n.t('runtimeErrors.tools.runUnavailable') });
        }
        return;
      }
      const selectedRunIdAtResolution = isCurrentExternalCheck()
        ? get().selectedCrawlRunId
        : null;
      const byUrl = new Map(batch.results.map((item) => [normalizeCrawlLinkUrl(item.url), item]));
      const checkedAtFallback = new Date().toISOString();
      const pages = latestRun.result.pages.map((page) => {
        const links = page.links.map((link) => {
          if (link.is_internal || (!force && link.target_checked_at)) return link;
          const check = byUrl.get(normalizeCrawlLinkUrl(link.target_url));
          if (!check) return link;
          return {
            ...link,
            target_http_status: check.httpStatus,
            target_response_time_ms: check.responseTimeMs,
            target_redirect_url: check.redirectUrl,
            target_request_error_kind: check.requestErrorKind,
            target_checked_at: check.checkedAt || checkedAtFallback,
          };
        });
        const existing = page.issues.filter((issue) => issue.code !== 'external-link-check');
        const failedTargets = new Set(links.filter((link) => !link.is_internal && (
          (link.target_http_status !== undefined && link.target_http_status >= 400)
          || ['dns', 'timeout', 'tls', 'connect', 'network'].includes(link.target_request_error_kind || '')
        )).map((link) => normalizeCrawlLinkUrl(link.target_url)));
        if (failedTargets.size) existing.push({
          severity: 'Warning',
          code: 'external-link-check',
          message: i18n.t('crawl.ui.externalLinkIssue', { count: failedTargets.size }),
        });
        return { ...page, links, issues: existing, issues_count: existing.length };
      });
      const criticalCount = pages.reduce((count, page) => count + page.issues.filter((issue) => issue.severity === 'Critical').length, 0);
      const warningCount = pages.reduce((count, page) => count + page.issues.filter((issue) => issue.severity === 'Warning').length, 0);
      const noticeCount = pages.reduce((count, page) => count + page.issues.filter((issue) => issue.severity === 'Info').length, 0);
      const healthScore = Math.max(20, 100 - Math.min(80, criticalCount * 15 + warningCount * 5));
      const result = { ...latestRun.result, pages, critical_count: criticalCount, warning_count: warningCount, notice_count: noticeCount, health_score: healthScore };
      const crawlRuns = latestRuns.map((candidate) => candidate.id === runId ? { ...candidate, result } : candidate);
      let persistenceError: string | null = null;
      let saveNotice: string | null = null;
      let persistenceCompacted = false;
      let persistedRuns = crawlRuns;
      try {
        const saveResult = await saveCrawlRuns(projectId, crawlRuns);
        persistedRuns = crawlRuns.slice(0, crawlRuns.length - saveResult.prunedRuns);
        saveNotice = formatCrawlPersistenceNotice(saveResult, persistedRuns.length);
        persistenceCompacted = Boolean(saveResult.compactedRuns) || Boolean(persistedRuns[0]?.storage_compacted);
        if (persistenceCompacted && !saveNotice) saveNotice = i18n.t('runtimeErrors.tools.boundedResave');
      } catch (error) { persistenceError = isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.externalCheckSaveFailed'); }
      const selectedResult = persistedRuns.find((candidate) => candidate.id === selectedRunIdAtResolution)?.result;
      if (isCurrentExternalCheck()) {
        set({
          crawlRuns: persistedRuns,
          crawlPersistenceError: persistenceError,
          crawlPersistenceNotice: saveNotice,
          crawlPersistenceCompacted: persistenceCompacted,
          ...(selectedResult ? { crawlResult: selectedResult } : {}),
          ...(selectedRunIdAtResolution === runId ? { crawlResult: result } : {}),
          crawlExternalLinkCheckError: batch.omitted > 0
            ? i18n.t('runtimeErrors.tools.externalCheckSummary', { checked: batch.checked, requested: batch.requested, omitted: batch.omitted })
            : null,
        });
      }
    } catch (error) {
      const quotaError = isStorageQuotaError(error);
      const message = formatCrawlRuntimeError(error);
      if (activeProjectId() === projectId) set({
        crawlExternalLinkCheckError: message,
        ...(quotaError ? { crawlPersistenceError: message } : {}),
      });
    } finally {
      unlisten?.();
      if (isCurrentExternalCheck()) set({ isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null });
    }
  },

  // -------------------------------------------------------------
  // AI Brand Visibility (GEO) Actions
  // -------------------------------------------------------------
  setAiBrandQuery: (brand) => {
    set({ aiBrandQuery: brand });
    const projectId = activeProjectId();
    if (projectId) saveProjectResearch(aiResearchInputsKey, { ...readProjectResearch<Record<string, string>>(aiResearchInputsKey, projectId), brand, domain: get().aiBrandDomain, prompt: get().aiSearchPrompt }, projectId);
  },
  setAiBrandDomain: (domain) => {
    set({ aiBrandDomain: domain });
    const projectId = activeProjectId();
    if (projectId) saveProjectResearch(aiResearchInputsKey, { ...readProjectResearch<Record<string, string>>(aiResearchInputsKey, projectId), brand: get().aiBrandQuery, domain, prompt: get().aiSearchPrompt }, projectId);
  },

  analyzeAiBrandVisibility: async (brand, domain) => {
    const b = (brand ?? get().aiBrandQuery).trim();
    const d = (domain ?? get().aiBrandDomain).trim();
    if (!b) return;
    const projectId = activeProjectId();
    if (!projectId) return set({ aiBrandError: i18n.t('runtimeErrors.tools.aiProject') });
    const requestToken = beginToolRequest('ai-brand');
    set({ isAiBrandLoading: true, aiBrandError: null });
    try {
      const providers = localSubscriptionProviders();
      if (!providers.length) throw new Error(i18n.t('runtimeErrors.tools.aiConnect'));
      const query = `Answer this impartial brand-research question: What is ${b}${d ? ` (${d})` : ''}? If uncertain, say so. When naming a source URL, include it exactly; do not invent URLs.`;
      const observations = await Promise.all(providers.map(async (provider) => {
        const capturedAt = new Date().toISOString();
        try {
          const rawResponse = await useAuthStore.getState().generateTextForProvider(provider, query);
          const response = redactLocalContext(rawResponse);
          const present = hasAiBrandEvidence(response, b, d, query);
          const citedSources = Array.from(new Set(response.match(/https?:\/\/[^\s),]+/g) || []));
          return { provider, capturedAt, response, present, citedSources, error: undefined as string | undefined };
        } catch (error) {
          return { provider, capturedAt, response: '', present: false, citedSources: [], error: error instanceof Error ? error.message : String(error) };
        }
      }));
      const successful = observations.filter((item) => !item.error);
      const mentioned = successful.filter((item) => item.present).length;
      const capturedAt = new Date().toISOString();
      const report: BrandAiVisibilityReport = {
        brand: b, domain: d, overall_score: successful.length ? Math.round(mentioned / successful.length * 100) : null, query_checked: query, timestamp: capturedAt,
        key_takeaways: successful.length ? [i18n.t('runtimeErrors.tools.aiTakeaway', { mentioned, successful: successful.length }), i18n.t('runtimeErrors.tools.aiLocalLimit', 'Local CLI responses do not include web browsing unless the connected client explicitly provides it.')] : [i18n.t('runtimeErrors.tools.aiNoResponse')],
        models: observations.map((item) => ({
          model_name: i18n.t('runtimeErrors.tools.aiProviderModel', { provider: item.provider }), model_id: null, provider: item.provider, connection_method: 'local_cli', captured_at: item.capturedAt,
          is_present: item.present, visibility_percentage: item.error ? 0 : item.present ? 100 : 0, sentiment: 'not_assessed',
          summary: item.error ? '' : item.response, cited_sources: item.citedSources, response_status: item.error ? 'error' : 'success', ...(item.error ? { error_message: item.error } : {}),
        })),
      };
      if (activeProjectId() !== projectId || !isLatestToolRequest('ai-brand', requestToken)) return;
      const history = [report, ...get().aiBrandHistory.filter((item) => item.timestamp !== report.timestamp)].slice(0, 50);
      set({ aiBrandQuery: b, aiBrandDomain: d, aiBrandReport: report, aiBrandHistory: history, isAiBrandLoading: false });
      saveProjectResearch(aiBrandReportKey, history, projectId);
      saveProjectResearch(aiBrandSelectionKey, report.timestamp, projectId);
      saveProjectResearch(aiResearchInputsKey, { ...readProjectResearch<Record<string, string>>(aiResearchInputsKey, projectId), brand: b, domain: d, prompt: get().aiSearchPrompt }, projectId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : i18n.t('runtimeErrors.tools.aiNoResponse');
      if (activeProjectId() === projectId && isLatestToolRequest('ai-brand', requestToken)) set({ aiBrandError: msg, isAiBrandLoading: false });
    }
  },
  selectAiBrandReport: (timestamp) => {
    const report = get().aiBrandHistory.find((item) => item.timestamp === timestamp);
    if (report) {
      set({ aiBrandReport: report, aiBrandQuery: report.brand, aiBrandDomain: report.domain });
      saveProjectResearch(aiBrandSelectionKey, report.timestamp);
    }
  },

  // -------------------------------------------------------------
  // AI Prompts Explorer Actions
  // -------------------------------------------------------------
  setAiSearchPrompt: (p) => {
    set({ aiSearchPrompt: p });
    const projectId = activeProjectId();
    if (projectId) saveProjectResearch(aiResearchInputsKey, { ...readProjectResearch<Record<string, string>>(aiResearchInputsKey, projectId), brand: get().aiBrandQuery, domain: get().aiBrandDomain, prompt: p }, projectId);
  },

  runAiPromptComparison: async (prompt) => {
    const p = (prompt ?? get().aiSearchPrompt).trim();
    if (!p) return;

    const projectId = activeProjectId();
    if (!projectId) return set({ aiPromptError: i18n.t('runtimeErrors.tools.projectRequired') });
    const requestToken = beginToolRequest('ai-prompt');
    set({ isAiPromptLoading: true, aiPromptError: null });
    try {
      const providers = localSubscriptionProviders();
      if (!providers.length) throw new Error(i18n.t('runtimeErrors.tools.aiConnect'));
      const query = `${p}\n\nWhen you provide source URLs, reproduce them exactly. Do not invent citations or imply that URLs have been independently verified.`;
      const results = await Promise.all(providers.map(async (provider) => {
        const capturedAt = new Date().toISOString();
        try {
          const responseText = await useAuthStore.getState().generateTextForProvider(provider, query);
          const citations = Array.from(new Set(responseText.match(/https?:\/\/[^\s),]+/g) || []));
          return { provider, capturedAt, responseText, citations, error: undefined as string | undefined };
        } catch (error) {
          return { provider, capturedAt, responseText: '', citations: [], error: error instanceof Error ? error.message : String(error) };
        }
      }));
      const comparison: AiPromptComparison = {
        prompt: p, captured_at: new Date().toISOString(),
        results: results.map((item) => ({
          provider: item.provider, connection_method: 'local_cli', captured_at: item.capturedAt,
          model_name: i18n.t('runtimeErrors.tools.aiProviderModel', { provider: item.provider }), response_text: item.responseText, brand_mentions: [], citations: item.citations,
          response_status: item.error ? 'error' : 'success', ...(item.error ? { error_message: item.error } : {}),
        })),
      };
      if (activeProjectId() !== projectId || !isLatestToolRequest('ai-prompt', requestToken)) return;
      const history = [comparison, ...get().aiPromptHistory.filter((item) => item.captured_at !== comparison.captured_at)].slice(0, 50);
      set({ aiSearchPrompt: p, aiPromptComparison: comparison, aiPromptHistory: history, isAiPromptLoading: false });
      saveProjectResearch(aiPromptComparisonKey, history, projectId);
      saveProjectResearch(aiPromptSelectionKey, comparison.captured_at, projectId);
      saveProjectResearch(aiResearchInputsKey, { ...readProjectResearch<Record<string, string>>(aiResearchInputsKey, projectId), brand: get().aiBrandQuery, domain: get().aiBrandDomain, prompt: p }, projectId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : i18n.t('runtimeErrors.tools.comparisonFailed');
      if (activeProjectId() === projectId && isLatestToolRequest('ai-prompt', requestToken)) set({ aiPromptError: msg, isAiPromptLoading: false });
    }
  },
  selectAiPromptComparison: (capturedAt) => {
    const comparison = get().aiPromptHistory.find((item) => item.captured_at === capturedAt);
    if (comparison) {
      set({ aiPromptComparison: comparison, aiSearchPrompt: comparison.prompt });
      saveProjectResearch(aiPromptSelectionKey, comparison.captured_at);
    }
  },

  // -------------------------------------------------------------
  // GSC Actions
  // -------------------------------------------------------------
  setGscProperty: (property) => {
    const projectId = activeProjectId();
    beginToolRequest('gsc-data');
    beginToolRequest('gsc-inspection');
    if (projectId) writeStorage(gscPropertyKey(projectId), property);
    set({ gscProperty: property, gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, gscError: null, isGscLoading: false });
  },

  setGscFilters: (filters) => {
    const projectId = activeProjectId();
    beginToolRequest('gsc-data');
    const normalized: GscPerformanceFilters = {
      ...(filters.search_type ? { search_type: filters.search_type } : {}),
      ...(filters.device ? { device: filters.device } : {}),
      ...(filters.country?.trim() ? { country: filters.country.trim().toLowerCase().slice(0, 3) } : {}),
    };
    if (projectId) writeJsonStorage(gscFiltersKey(projectId), normalized);
    set({ gscFilters: normalized, gscData: null, gscDataFetchedAt: null, gscError: null, isGscLoading: false });
  },

  resumeGsc: async () => {
    const projectId = activeProjectId();
    const clientId = get().gscClientId.trim();
    if (!projectId || !clientId) return;
    const requestToken = beginToolRequest('gsc-session');
    set({ isGscLoading: true, gscError: null });
    try {
      const properties = await invokeTauriCommand<GscSiteProperty[]>('list_search_console_properties', { projectId, clientId });
      const storedProperty = get().gscProperty;
      const selectedProperty = properties.some((item) => item.siteUrl === storedProperty) ? storedProperty : properties[0]?.siteUrl || '';
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-session', requestToken)) return;
      if (selectedProperty) writeStorage(gscPropertyKey(projectId), selectedProperty);
      set({ isGscConnected: true, gscProperties: properties, gscProperty: selectedProperty, isGscLoading: false });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscConnected: false, gscProperties: [], isGscLoading: false, gscError: errorMessage(error, i18n.t('runtimeErrors.tools.gscResumeFailed')) });
    } finally {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscLoading: false });
    }
  },

  connectGsc: async (clientId, clientSecret) => {
    const projectId = activeProjectId();
    if (!projectId) return set({ gscError: i18n.t('runtimeErrors.tools.gscProject') });
    const normalizedClientId = clientId.trim();
    if (!normalizedClientId) return set({ gscError: i18n.t('runtimeErrors.tools.gscClientId') });
    const requestToken = beginToolRequest('gsc-session');
    writeStorage(gscClientIdKey(projectId), normalizedClientId);
    const normalizedSecret = clientSecret?.trim() || get().gscClientSecret.trim();
    set({ isGscLoading: true, isGscConnected: false, gscProperties: [], gscData: null, gscDataFetchedAt: null, gscError: null });
    try {
      const connectArgs: Record<string, unknown> = { projectId, clientId: normalizedClientId };
      if (normalizedSecret) connectArgs.clientSecret = normalizedSecret;
      const properties = await invokeTauriCommand<GscSiteProperty[]>('connect_search_console', connectArgs);
      const storedProperty = get().gscProperty;
      const selectedProperty = properties.some((item) => item.siteUrl === storedProperty) ? storedProperty : properties[0]?.siteUrl || '';
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-session', requestToken)) return;
      if (selectedProperty) writeStorage(gscPropertyKey(projectId), selectedProperty);
      set({ gscClientId: normalizedClientId, gscClientSecret: normalizedSecret, isGscConnected: true, gscProperties: properties, gscProperty: selectedProperty });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscConnected: false, gscError: errorMessage(error, i18n.t('runtimeErrors.tools.gscConnectFailed')) });
    } finally { if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscLoading: false }); }
  },

  disconnectGsc: async () => {
    const projectId = activeProjectId();
    if (!projectId) return;
    const requestToken = beginToolRequest('gsc-session');
    set({ isGscLoading: true, gscError: null });
    try {
      const status = await invokeTauriCommand<string>('disconnect_search_console', { projectId });
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-session', requestToken)) return;
      set({ isGscConnected: false, gscClientSecret: '', gscProperties: [], gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, isGscLoading: false, gscError: status.startsWith(i18n.t('runtimeErrors.tools.providerTokenRemovedPrefix')) ? status : null });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscLoading: false, gscError: errorMessage(error, i18n.t('runtimeErrors.tools.gscDisconnectFailed')) });
    }
  },

  refreshGscData: async (range, requestedFilters) => {
    const projectId = activeProjectId();
    const { gscClientId, gscProperty } = get();
    const filters = requestedFilters ?? get().gscFilters ?? {};
    if (!projectId || !get().isGscConnected || !gscProperty) {
      set({ gscError: i18n.t('runtimeErrors.tools.gscNeedPropertyData') });
      return;
    }
    const requestToken = beginToolRequest('gsc-data');
    set({ isGscLoading: true, gscError: null });
    try {
      const gscData = await invokeTauriCommand<GscPerformanceData>('search_console_performance', { projectId, clientId: gscClientId, siteUrl: gscProperty, startDate: range?.startDate ?? null, endDate: range?.endDate ?? null, filters });
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-data', requestToken)) return;
      set({ gscData, gscDataFetchedAt: new Date().toISOString() });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-data', requestToken)) set({ gscError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.gscDataFailed') });
    } finally { if (activeProjectId() === projectId && isLatestToolRequest('gsc-data', requestToken)) set({ isGscLoading: false }); }
  },

  inspectGscUrl: async (url) => {
    const projectId = activeProjectId();
    const { gscClientId, gscProperty, isGscConnected } = get();
    if (!projectId || !isGscConnected || !gscProperty) {
      set({ gscError: i18n.t('runtimeErrors.tools.gscNeedPropertyInspect') });
      return;
    }
    const requestToken = beginToolRequest('gsc-inspection');
    set({ isGscLoading: true, gscError: null, gscInspectionResult: null });
    try {
      const gscInspectionResult = await invokeTauriCommand<Record<string, unknown>>('inspect_search_console_url', { projectId, clientId: gscClientId, siteUrl: gscProperty, inspectionUrl: url.trim() });
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-inspection', requestToken)) return;
      set({ gscInspectionResult });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-inspection', requestToken)) set({ gscError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.gscInspectFailed') });
    } finally { if (activeProjectId() === projectId && isLatestToolRequest('gsc-inspection', requestToken)) set({ isGscLoading: false }); }
  },

  // -------------------------------------------------------------
  // MCP Hub Actions
  // -------------------------------------------------------------
  setMcpClientTab: (tab) => set({ mcpClientTab: tab }),

  hydrateProject: async (projectId) => {
    beginToolRequest('gsc-session');
    beginToolRequest('gsc-data');
    beginToolRequest('gsc-inspection');
    if (!projectId) return set({ savedKeywords: [], trackedRanks: [], rankTrackingDraft: defaultRankTrackingDraft(), isRankLoading: false, rankError: null, crawlResult: null, crawlRuns: [], isCrawling: false, isCrawlPaused: false, crawlProgress: 0, activeCrawlRunId: null, crawlError: null, crawlPersistenceError: null, crawlPersistenceNotice: null, crawlPersistenceCompacted: false, isRetryingCrawlPersistence: false, crawlProgressDetail: null, interruptedCrawl: null, crawlUrl: '', crawlLimit: 25, crawlConfig: DEFAULT_CRAWL_CONFIG, crawlRequestProfiles: [], selectedCrawlRunId: null, isSavingCrawlRequestProfile: false, isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null, crawlExternalLinkCheckError: null, keywordQuery: '', keywordCountry: 'US', keywordLanguage: 'en', isKeywordLoading: false, keywordError: null, domainQuery: '', domainCountry: 'US', domainLanguage: 'en', domainOverview: null, isDomainLoading: false, domainError: null, backlinkQuery: '', backlinkProfile: null, backlinkProfileHistory: [], isBacklinkLoading: false, backlinkError: null, backlinkGapCompetitors: [], backlinkGapIncludeSubdomains: true, backlinkGapReport: null, isBacklinkGapLoading: false, backlinkGapError: null, aiBrandQuery: '', aiBrandDomain: '', aiBrandReport: null, aiBrandHistory: [], isAiBrandLoading: false, aiBrandError: null, aiSearchPrompt: '', aiPromptComparison: null, aiPromptHistory: [], isAiPromptLoading: false, aiPromptError: null, gscClientId: '', gscClientSecret: '', gscProperties: [], gscProperty: '', gscFilters: { ...DEFAULT_GSC_FILTERS }, isGscConnected: false, gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, isGscLoading: false, gscError: null, keywordResults: [], keywordResultsSource: null, domainComparison: null, domainComparisonHistory: [], domainComparisonTargets: [], isDomainComparisonLoading: false, domainComparisonError: null });
    const storedGscClientId = readStorage(gscClientIdKey(projectId)) || '';
    // The browser preview has no native credential store. Avoid an extra
    // promise turn there so project hydration remains deterministic for the
    // WebView and keeps all secrets desktop-only.
    const storedGscClientSecret = isTauriEnvironment()
      ? await getSecureValue(gscClientSecretKey(projectId)).catch(() => '')
      : '';
    const storedGscProperty = readStorage(gscPropertyKey(projectId)) || '';
    const backlinkGapSettings = loadBacklinkGapSettings(projectId);
    const projectRootUrl = useProjectStore.getState().projects.find((project) => project.id === projectId)?.rootUrl || '';
    migrateLegacyToolData(projectId);
    set({ savedKeywords: loadSavedKeywords(), trackedRanks: loadTrackedRanks(), rankTrackingDraft: loadRankTrackingDraft(projectId), isRankLoading: false, rankError: null, crawlResult: null, crawlRuns: [], isCrawling: false, isCrawlPaused: false, crawlProgress: 0, activeCrawlRunId: null, crawlError: null, crawlPersistenceError: null, crawlPersistenceNotice: null, crawlPersistenceCompacted: false, isRetryingCrawlPersistence: false, crawlProgressDetail: null, interruptedCrawl: readInterruptedCrawl(projectId), selectedTagFilter: null, crawlUrl: '', crawlLimit: 25, crawlConfig: DEFAULT_CRAWL_CONFIG, crawlRequestProfiles: loadCrawlRequestProfiles(), selectedCrawlRunId: null, isSavingCrawlRequestProfile: false, isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null, crawlExternalLinkCheckError: null, keywordQuery: loadKeywordQuery(projectId), keywordCountry: loadKeywordCountry(projectId), keywordLanguage: loadKeywordLanguage(projectId), isKeywordLoading: false, keywordError: null, domainQuery: loadProjectQuery(domainQueryKey, projectId), domainCountry: loadDomainCountry(projectId), domainLanguage: loadDomainLanguage(projectId), backlinkQuery: loadProjectQuery(backlinkQueryKey, projectId), backlinkGapCompetitors: backlinkGapSettings.competitors, backlinkGapIncludeSubdomains: backlinkGapSettings.includeSubdomains, backlinkGapReport: loadBacklinkGapReport(projectId), isBacklinkGapLoading: false, backlinkGapError: null, domainOverview: loadDomainOverview(projectId), isDomainLoading: false, domainError: null, backlinkProfile: loadBacklinkProfile(projectId), backlinkProfileHistory: loadBacklinkProfileHistory(projectId), isBacklinkLoading: false, backlinkError: null, domainComparison: loadLatestDomainComparison(projectId), domainComparisonHistory: loadDomainComparisonHistory(projectId), domainComparisonTargets: loadDomainComparisonTargets(projectId), isDomainComparisonLoading: false, domainComparisonError: null,
      aiBrandQuery: '', aiBrandDomain: '', aiBrandReport: null, aiBrandHistory: [], aiBrandError: null, isAiBrandLoading: false,
      aiSearchPrompt: '', aiPromptComparison: null, aiPromptHistory: [], aiPromptError: null, isAiPromptLoading: false,
      gscClientId: storedGscClientId, gscClientSecret: storedGscClientSecret, gscProperty: storedGscProperty, gscFilters: readGscFilters(projectId), gscProperties: [], isGscConnected: false, gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, isGscLoading: false, gscError: null, keywordResults: [], keywordResultsSource: null });
    let crawlRuns: CrawlRunRecord[] = [];
    let persistenceError: string | null = null;
    let persistenceNotice: string | null = null;
    try {
      crawlRuns = (await loadCrawlRuns(projectId)).filter((item): item is CrawlRunRecord => Boolean(item?.id && item?.result?.start_url));
    } catch (error) {
      persistenceError = isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.historyReadFailed');
    }
    // Migrate legacy WebView storage once; oversized snapshots used to exhaust
    // localStorage and make a completed crawl appear to have failed.
    if (!crawlRuns.length) {
      const parsed = readJsonStorage<unknown>(crawlRunsKey(projectId), []);
      crawlRuns = Array.isArray(parsed) ? parsed.filter((item): item is CrawlRunRecord => Boolean(item?.id && item?.result?.start_url)) : [];
      if (!crawlRuns.length) {
        const legacyResult = readJsonStorage<SiteCrawlResult | null>(crawlResultKey(projectId), null);
        if (legacyResult?.start_url) crawlRuns = [{ id: `legacy-${Date.now()}`, completedAt: new Date().toISOString(), startUrl: legacyResult.start_url, config: { ...DEFAULT_CRAWL_CONFIG, maxPages: legacyResult.pages_crawled }, result: legacyResult }];
      }
      if (crawlRuns.length && !persistenceError) {
        try {
          const saveResult = await saveCrawlRuns(projectId, crawlRuns);
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
    if (activeProjectId() !== projectId) return;
    const crawlSettings = readJsonStorage<CrawlProjectSettings | null>(crawlSettingsKey(projectId), null);
    // A project's root URL is the first crawl target. Keep an explicitly
    // saved crawl URL (including an intentional empty value) authoritative.
    const hydratedCrawlUrl = crawlSettings && typeof crawlSettings.url === 'string'
      ? crawlSettings.url
      : projectRootUrl;
    // Read both the new history arrays and the earlier single-result format.
    // Keep the migration in memory until the next successful run writes v1 history.
    const aiBrandHistory = researchHistory(readProjectResearch<BrandAiVisibilityReport[] | BrandAiVisibilityReport>(aiBrandReportKey, projectId));
    const aiPromptHistory = researchHistory(readProjectResearch<AiPromptComparison[] | AiPromptComparison>(aiPromptComparisonKey, projectId));
    const savedBrandSelection = readProjectResearch<string>(aiBrandSelectionKey, projectId);
    const savedPromptSelection = readProjectResearch<string>(aiPromptSelectionKey, projectId);
    const aiBrandReport = aiBrandHistory.find((item) => item.timestamp === savedBrandSelection) || aiBrandHistory[0] || null;
    const aiPromptComparison = aiPromptHistory.find((item) => item.captured_at === savedPromptSelection) || aiPromptHistory[0] || null;
    const aiResearchInputs = readProjectResearch<{ brand?: string; domain?: string; prompt?: string }>(aiResearchInputsKey, projectId);
    const hydratedCompacted = Boolean(crawlRuns[0]?.storage_compacted);
    if (hydratedCompacted && !persistenceNotice) persistenceNotice = i18n.t('runtimeErrors.tools.hydratedCompacted');
    const localInterruptedCrawl = readInterruptedCrawl(projectId);
    let hydratedInterruptedCrawl = localInterruptedCrawl;
    if (isTauriEnvironment()) {
      try {
        const nativeCheckpoint = await invokeTauriCommand<unknown>('load_project_crawl_checkpoint', { projectId });
        hydratedInterruptedCrawl = newestInterruptedCrawl(
          localInterruptedCrawl,
          normalizeInterruptedCrawl(nativeCheckpoint),
        );
      } catch {
        // Keep the local compatibility copy when the native checkpoint is not
        // available while upgrading from an older release.
      }
    }
    set({ crawlResult: crawlRuns[0]?.result || null, crawlRuns, crawlPersistenceError: persistenceError, crawlPersistenceNotice: persistenceNotice, crawlPersistenceCompacted: hydratedCompacted, interruptedCrawl: hydratedInterruptedCrawl, crawlUrl: hydratedCrawlUrl, crawlLimit: crawlSettings?.limit || 25, crawlConfig: { ...DEFAULT_CRAWL_CONFIG, ...crawlSettings?.config }, selectedCrawlRunId: crawlRuns[0]?.id || null,
      aiBrandQuery: aiResearchInputs?.brand || aiBrandReport?.brand || '', aiBrandDomain: aiResearchInputs?.domain || aiBrandReport?.domain || '', aiBrandReport, aiBrandHistory, isAiBrandLoading: false, aiBrandError: null,
      aiSearchPrompt: aiResearchInputs?.prompt || aiPromptComparison?.prompt || '', aiPromptComparison, aiPromptHistory, isAiPromptLoading: false, aiPromptError: null });
  },
}));
