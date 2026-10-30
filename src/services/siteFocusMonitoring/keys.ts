import { validProjectId } from '@/services/schedules/policy';

export const SFS_HISTORY_LIMIT = 200;
/** Full page maps are kept only for the newest snapshots; older ones keep score and annotations. */
export const SFS_FULL_PAGES_KEPT = 2;
export const SFS_FULL_RECOMPUTE_LIMIT = 3;

export const validFocusProject = (projectId: string | null | undefined): projectId is string => typeof projectId === 'string' && validProjectId(projectId);
const keyOf = (name: string) => (projectId: string): string => `seomi_project_${projectId}_site_focus_${name}_v1`;

export const focusHistoryKey = keyOf('history');
export const focusTopicKey = keyOf('manual_topic');
export const focusAnchorsKey = keyOf('anchor_urls');
export const focusGoalKey = keyOf('business_goal');
export const focusBrandKey = keyOf('brand_policy');
export const focusBudgetKey = keyOf('recompute_budget');
export const focusSeenKey = keyOf('first_seen');
export const focusScheduleKey = keyOf('schedule');
