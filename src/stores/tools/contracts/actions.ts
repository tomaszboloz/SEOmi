import type { SavedKeywordItem, SiteCrawlResult, CrawlConfig, CrawlEnvironment, CrawlRequestProfile, GscPerformanceFilters } from '@/types';
import type { RankTrackingDraft } from '../contracts';

export interface ToolsActions {  // Actions - Keywords
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
