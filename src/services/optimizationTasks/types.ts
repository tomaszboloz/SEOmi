export type TaskKind = 'add-link' | 'redirect-301' | 'remove-410' | 'add-entities' | 'remove-noindex';
export type TaskStatus = 'planned' | 'implemented' | 'verified' | 'failed';
export type TaskModule = 'sfs' | 'tas' | 'sprs' | 'eetv';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface OptimizationTask {
  id: string;
  kind: TaskKind;
  module: TaskModule;
  status: TaskStatus;
  /** Page the change is made on (link source, redirected, removed or edited page). */
  url: string;
  /** Link or redirect destination. */
  targetUrl?: string;
  requiredEntities?: string[];
  /** Module score when the task was planned; null when the module had no score. */
  baselineScore: number | null;
  owner?: string;
  priority: TaskPriority;
  /** SLA deadline, YYYY-MM-DD. */
  dueDate?: string;
  createdAt: string;
  implementedAt?: string;
  verifiedAt?: string;
  verdict?: TaskVerdict;
}

export type VerdictCode =
  | 'link-found' | 'link-missing'
  | 'redirect-ok' | 'redirect-wrong-target' | 'still-200'
  | 'gone-ok' | 'wrong-status'
  | 'entities-ok' | 'entities-missing'
  | 'index-ok' | 'still-noindex';

export interface TaskVerdict {
  status: 'verified' | 'failed';
  code: VerdictCode;
  params: Record<string, string | number>;
  /** Module score now minus baseline; null when either is unknown. */
  delta: number | null;
  /** True when the module score dropped below baseline. */
  regression: boolean;
}

export const ENTITY_COVERAGE_MIN = 0.6;
