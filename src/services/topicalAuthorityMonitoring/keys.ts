import { validFocusProject } from '@/services/siteFocusMonitoring';

export { validFocusProject as validAuthorityProject };

export const AUTHORITY_HISTORY_LIMIT = 200;
export const TAXONOMY_TTL_DAYS = 30;

const keyOf = (name: string) => (projectId: string): string => `seomi_project_${projectId}_authority_${name}_v1`;

export const authorityHistoryKey = keyOf('history');
export const authorityTaxonomyKey = keyOf('taxonomy');
export const authorityBenchmarkKey = keyOf('benchmark');
