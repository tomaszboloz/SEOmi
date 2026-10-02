import { TabType } from '@/types';
import { ALL_WORKSPACE_TABS } from '@/services/workspaceRoutes';

export const LEGACY_HISTORY_KEY = 'seomi_audit_history';
export const ACTIVE_PROJECT_KEY = 'seomi_active_project_v1';
export const historyKey = (projectId: string) => `seomi_project_${projectId}_audit_history`;
export const batchQueueKey = (projectId: string) => `seomi_project_${projectId}_audit_queue_v1`;
export const batchRunKey = (projectId: string) => `seomi_project_${projectId}_audit_queue_run_v1`;
export const onlyProblemsKey = (projectId: string) => `seomi_project_${projectId}_audit_only_problems_v1`;
export const activeTabKey = (projectId: string) => `seomi_project_${projectId}_active_tab_v1`;
export const dataForSeoSummaryKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_summary_v1`;
export const dataForSeoSerpKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_serp_v1`;
export const dataForSeoTargetKey = (projectId: string) => `${dataForSeoSummaryKey(projectId)}_target`;

export const projectTabs: readonly TabType[] = ALL_WORKSPACE_TABS;

export const state = {
  activeBatchProjectId: null as string | null,
};

export const nativeQueueWrites = new Map<string, Promise<boolean>>();
export const auditRequestTokens = new Map<string, string>();
