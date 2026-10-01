
import { KeywordIdea, SavedKeywordItem, TrackedRankItem, DomainOverviewData, DomainComparisonData, DomainComparisonHistory, BacklinkProfileData, BacklinkProfileHistory, BacklinkGapReport, SiteCrawlResult, CrawlConfig, CrawlProgress, CrawlRunRecord, CrawlEnvironment, CrawlRequestProfile, BrandAiVisibilityReport, AiPromptComparison, GscPerformanceData, GscPerformanceFilters, GscSiteProperty, ExternalLinkCheckProgress } from '@/types';
import { getSecureValue, invokeTauriCommand } from '@/services/tauri';
import { loadCrawlRuns, saveCrawlRuns } from '@/services/crawlPersistence';
import { notifyCrawlCompleted } from '@/services/desktopNotifications';

import { AiResearchSettings } from '@/services/aiResearchEvidence';
import { DataForSEOClient } from '@/services/dataforseo';

import { useAuthStore } from '../authStore';

export interface ToolsState {
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
  aiResearchSettings: AiResearchSettings;
  setAiResearchSettings: (settings: Partial<AiResearchSettings>) => void;
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

export interface CrawlProjectSettings {
  url: string;
  limit: number;
  config: CrawlConfig;
}

export interface InterruptedCrawl {
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
import type { StoreApi } from 'zustand';
export type ToolsSet = StoreApi<ToolsState>['setState'];
export type ToolsGet = StoreApi<ToolsState>['getState'];
export interface ToolsServices {
invoke: typeof invokeTauriCommand;
secureValue: typeof getSecureValue;
loadCrawlRuns: typeof loadCrawlRuns;
saveCrawlRuns: typeof saveCrawlRuns;
notifyCrawlCompleted: typeof notifyCrawlCompleted;
createDataForSeoClient: (login: string, password: string) => DataForSEOClient;
generateText: ReturnType<typeof useAuthStore.getState>['generateTextForProvider'];
}
