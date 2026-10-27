import { describe, expect, it } from 'vitest';
import { focusBudgetKey, focusHistoryKey, focusScheduleKey, focusSeenKey, focusTopicKey } from '@/services/siteFocusMonitoring/keys';
import { authorityBenchmarkKey, authorityHistoryKey, authorityTaxonomyKey, validAuthorityProject } from '@/services/topicalAuthorityMonitoring/keys';

describe('monitoring storage keys', () => {
  it('builds exact per-project site focus keys that never collide', () => {
    expect(focusTopicKey('p1')).toBe('seomi_project_p1_site_focus_manual_topic_v1');
    expect(focusSeenKey('p1')).toBe('seomi_project_p1_site_focus_first_seen_v1');
    expect(focusHistoryKey('p1')).toBe('seomi_project_p1_site_focus_history_v1');
    expect(focusBudgetKey('p1')).toBe('seomi_project_p1_site_focus_recompute_budget_v1');
    expect(focusScheduleKey('p1')).toBe('seomi_project_p1_site_focus_schedule_v1');
    const all = [focusTopicKey, focusSeenKey, focusHistoryKey, focusBudgetKey, focusScheduleKey].flatMap((k) => [k('a'), k('b')]);
    expect(new Set(all).size).toBe(10);
  });

  it('builds exact authority keys and reuses the project id guard', () => {
    expect(authorityHistoryKey('p1')).toBe('seomi_project_p1_authority_history_v1');
    expect(authorityTaxonomyKey('p1')).toBe('seomi_project_p1_authority_taxonomy_v1');
    expect(authorityBenchmarkKey('p1')).toBe('seomi_project_p1_authority_benchmark_v1');
    expect(validAuthorityProject('p1')).toBe(true);
    expect(validAuthorityProject('../x')).toBe(false);
    expect(validAuthorityProject(undefined)).toBe(false);
  });
});
