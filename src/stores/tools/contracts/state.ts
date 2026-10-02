import type { KeywordIdea, SavedKeywordItem, TrackedRankItem, DomainOverviewData, DomainComparisonData, DomainComparisonHistory, BacklinkProfileData, BacklinkProfileHistory, BacklinkGapReport, SiteCrawlResult, CrawlConfig, CrawlProgress, CrawlRunRecord, CrawlRequestProfile, BrandAiVisibilityReport, AiPromptComparison, GscPerformanceData, GscPerformanceFilters, GscSiteProperty, ExternalLinkCheckProgress } from '@/types';
import type { AiResearchSettings } from '@/services/aiResearchEvidence';
import type { RankTrackingDraft, InterruptedCrawl } from '../contracts';

export interface ToolsData {
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

}
