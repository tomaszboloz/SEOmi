import { afterEach, beforeEach, expect, it } from 'vitest';
import * as keys from '@/stores/tools/storageKeys';
import { useProjectStore } from '@/stores/projectStore';
const initial=useProjectStore.getState();
beforeEach(()=>{localStorage.clear();useProjectStore.setState({activeProjectId:null});});
afterEach(()=>useProjectStore.setState(initial));

it('preserves the persisted project storage namespaces used by existing installations',()=>{
  expect({
    keywords:keys.savedKeywordsKey('a'), ranks:keys.trackedRanksKey('a'), rankDraft:keys.rankTrackingDraftKey('a'),
    crawl:keys.crawlResultKey('a'), runs:keys.crawlRunsKey('a'), settings:keys.crawlSettingsKey('a'), profiles:keys.crawlRequestProfilesKey('a'), interrupted:keys.interruptedCrawlKey('a'),
    comparison:keys.domainComparisonKey('a'), comparisonHistory:keys.domainComparisonHistoryKey('a'), comparisonTargets:keys.domainComparisonTargetsKey('a'),
    overview:keys.domainOverviewKey('a'), domainQuery:keys.domainQueryKey('a'), domainCountry:keys.domainCountryKey('a'), domainLanguage:keys.domainLanguageKey('a'),
    backlinkQuery:keys.backlinkQueryKey('a'), backlinkProfile:keys.backlinkProfileKey('a'), backlinkHistory:keys.backlinkProfileHistoryKey('a'), backlinkGap:keys.backlinkGapReportKey('a'),
    keywordQuery:keys.keywordQueryKey('a'), keywordCountry:keys.keywordCountryKey('a'), keywordLanguage:keys.keywordLanguageKey('a'),
    brandReport:keys.aiBrandReportKey('a'), promptComparison:keys.aiPromptComparisonKey('a'), researchInputs:keys.aiResearchInputsKey('a'), researchSettings:keys.aiResearchSettingsKey('a'),
    brandSelection:keys.aiBrandSelectionKey('a'), promptSelection:keys.aiPromptSelectionKey('a'),
  }).toEqual({
    keywords:'seomi_project_a_saved_keywords',ranks:'seomi_project_a_tracked_ranks',rankDraft:'seomi_project_a_rank_tracking_draft_v1',
    crawl:'seomi_project_a_crawl_result',runs:'seomi_project_a_crawl_runs',settings:'seomi_project_a_crawl_settings',profiles:'seomi_project_a_crawl_request_profiles_v1',interrupted:'seomi_project_a_crawl_interrupted_v1',
    comparison:'seomi_project_a_domain_comparison_v1',comparisonHistory:'seomi_project_a_domain_comparison_history_v1',comparisonTargets:'seomi_project_a_domain_comparison_targets_v1',
    overview:'seomi_project_a_domain_overview_v1',domainQuery:'seomi_project_a_domain_query_v1',domainCountry:'seomi_project_a_domain_country_v1',domainLanguage:'seomi_project_a_domain_language_v1',
    backlinkQuery:'seomi_project_a_backlink_query_v1',backlinkProfile:'seomi_project_a_backlink_profile_v1',backlinkHistory:'seomi_project_a_backlink_profile_history_v1',backlinkGap:'seomi_project_a_backlink_gap_report_v1',
    keywordQuery:'seomi_project_a_keyword_query_v1',keywordCountry:'seomi_project_a_keyword_country_v1',keywordLanguage:'seomi_project_a_keyword_language_v1',
    brandReport:'seomi_project_a_ai_brand_report_v1',promptComparison:'seomi_project_a_ai_prompt_comparison_v1',researchInputs:'seomi_project_a_ai_research_inputs_v1',researchSettings:'seomi_project_a_ai_research_settings_v1',
    brandSelection:'seomi_project_a_ai_brand_selection_v1',promptSelection:'seomi_project_a_ai_prompt_selection_v1',
  });
  const generators=Object.values(keys).filter((value)=>value !== keys.activeProjectId) as Array<(projectId:string)=>string>;
  const a=generators.map(key=>key('a'));
  const b=generators.map(key=>key('b'));
  expect(new Set([...a,...b]).size).toBe(a.length+b.length);
});

it('prefers the persisted selected project and falls back to live store state if storage is empty',()=>{
  expect(keys.activeProjectId()).toBeNull();
  useProjectStore.setState({activeProjectId:'live'});
  expect(keys.activeProjectId()).toBe('live');
  localStorage.setItem('seomi_active_project_v1','persisted');
  expect(keys.activeProjectId()).toBe('persisted');
  localStorage.setItem('seomi_active_project_v1','');
  expect(keys.activeProjectId()).toBe('live');
});
