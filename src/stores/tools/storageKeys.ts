

import { readStorage } from '@/services/storage';

import { useProjectStore } from '../projectStore';

export const savedKeywordsKey = (projectId: string) => `seomi_project_${projectId}_saved_keywords`;

export const trackedRanksKey = (projectId: string) => `seomi_project_${projectId}_tracked_ranks`;

export const rankTrackingDraftKey = (projectId: string) => `seomi_project_${projectId}_rank_tracking_draft_v1`;

export const crawlResultKey = (projectId: string) => `seomi_project_${projectId}_crawl_result`;

export const crawlRunsKey = (projectId: string) => `seomi_project_${projectId}_crawl_runs`;

export const crawlSettingsKey = (projectId: string) => `seomi_project_${projectId}_crawl_settings`;

export const crawlRequestProfilesKey = (projectId: string) => `seomi_project_${projectId}_crawl_request_profiles_v1`;

export const interruptedCrawlKey = (projectId: string) => `seomi_project_${projectId}_crawl_interrupted_v1`;

export const domainComparisonKey = (projectId: string) => `seomi_project_${projectId}_domain_comparison_v1`;

export const domainComparisonHistoryKey = (projectId: string) => `seomi_project_${projectId}_domain_comparison_history_v1`;

export const domainComparisonTargetsKey = (projectId: string) => `seomi_project_${projectId}_domain_comparison_targets_v1`;

export const domainOverviewKey = (projectId: string) => `seomi_project_${projectId}_domain_overview_v1`;

export const domainQueryKey = (projectId: string) => `seomi_project_${projectId}_domain_query_v1`;

export const domainCountryKey = (projectId: string) => `seomi_project_${projectId}_domain_country_v1`;

export const domainLanguageKey = (projectId: string) => `seomi_project_${projectId}_domain_language_v1`;

export const backlinkQueryKey = (projectId: string) => `seomi_project_${projectId}_backlink_query_v1`;

export const backlinkProfileKey = (projectId: string) => `seomi_project_${projectId}_backlink_profile_v1`;

export const backlinkProfileHistoryKey = (projectId: string) => `seomi_project_${projectId}_backlink_profile_history_v1`;

export const backlinkGapReportKey = (projectId: string) => `seomi_project_${projectId}_backlink_gap_report_v1`;

export const keywordQueryKey = (projectId: string) => `seomi_project_${projectId}_keyword_query_v1`;

export const keywordCountryKey = (projectId: string) => `seomi_project_${projectId}_keyword_country_v1`;

export const keywordLanguageKey = (projectId: string) => `seomi_project_${projectId}_keyword_language_v1`;

export const activeProjectId = () => readStorage('seomi_active_project_v1') || useProjectStore.getState().activeProjectId;

export const aiBrandReportKey = (projectId: string) => `seomi_project_${projectId}_ai_brand_report_v1`;

export const aiPromptComparisonKey = (projectId: string) => `seomi_project_${projectId}_ai_prompt_comparison_v1`;

export const aiResearchInputsKey = (projectId: string) => `seomi_project_${projectId}_ai_research_inputs_v1`;

export const aiResearchSettingsKey = (projectId: string) => `seomi_project_${projectId}_ai_research_settings_v1`;

export const aiBrandSelectionKey = (projectId: string) => `seomi_project_${projectId}_ai_brand_selection_v1`;

export const aiPromptSelectionKey = (projectId: string) => `seomi_project_${projectId}_ai_prompt_selection_v1`;