import type { ActionDrillTab, ExecutiveAction } from '@/services/actionFeed';
import type { HssReport } from '@/services/hss';
import type { NewTask } from '@/services/optimizationTasks/storage';
import type { TaskModule, TaskPriority } from '@/services/optimizationTasks/types';
import type { BriefRecommendationInput } from './briefInput';

export type CardArtifactKind = 'link' | 'entities' | 'removal' | 'module';
/** Why the card plans no task: guardrail block, removal (Deployment Artifacts only), no page URL, or the fix lives in the module tab. */
export type CardNoTaskReason = 'blocked' | 'removal' | 'no-url' | 'in-module';

/** Execution Card (#124): diagnosis, location, before/after artifact and deployment for one feed action. */
export interface ExecutionCard {
  actionId: string;
  diagnosis: { codes: string[]; hssDelta: number | null; moduleDelta: number | null };
  location: { urls: string[] };
  artifact: { kind: CardArtifactKind; items: string[]; drillTab: ActionDrillTab };
  deployment: { task: NewTask | null; brief: BriefRecommendationInput | null; noTask: CardNoTaskReason | null };
}

/** Removals and merges become 301/410 rules only through Deployment Artifacts behind the #81 URL guard. */
const REMOVALS = new Set(['sfs:remove-offtopic', 'tas:merge-cannibalized']);
const MAX_ITEMS = 20;
const MODULE: Record<ExecutiveAction['source'], TaskModule> = { sfs: 'sfs', tas: 'tas', eetv: 'eetv', links: 'sprs' };

/** Site-level module score from HSS; null when not measured. SPRS is per page in the tracker, so it stays null. */
const baselineFor = (module: TaskModule, hss: HssReport | null | undefined): number | null => {
  if (module === 'sprs') return null;
  const component = hss?.components.find((item) => item.module === module);
  return component?.status === 'measured' && component.value !== null ? component.value : null;
};

/** Only the HSS What-If result sets priority; unknown stays unset (tracker default), never invented. */
const priorityOf = (hssDelta: number | null): TaskPriority | undefined => {
  if (hssDelta === null) return undefined;
  if (hssDelta >= 2) return 'high';
  return hssDelta > 0 ? 'medium' : 'low';
};

const itemsOf = (action: ExecutiveAction): string[] =>
  [...new Set(action.evidence.flatMap((item) => item.items ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, MAX_ITEMS);

const artifactKind = (action: ExecutiveAction, items: string[]): CardArtifactKind => {
  if (REMOVALS.has(action.type)) return 'removal';
  if (action.type === 'internal-link') return 'link';
  return items.length && action.urls.length === 1 ? 'entities' : 'module';
};

const noTaskReason = (action: ExecutiveAction, kind: CardArtifactKind): CardNoTaskReason | null => {
  if (action.blocked) return 'blocked';
  if (kind === 'removal') return 'removal';
  if (kind === 'link') return action.urls.length === 2 ? null : 'no-url';
  if (!action.urls.length) return 'no-url';
  return kind === 'module' ? 'in-module' : null;
};

const taskFor = (action: ExecutiveAction, kind: CardArtifactKind, items: string[], hss: HssReport | null | undefined): NewTask => {
  const module = MODULE[action.source];
  const expected = action.moduleDelta && action.moduleDelta.module === module ? action.moduleDelta.value : undefined;
  const priority = priorityOf(action.hssDelta);
  return {
    module, url: action.urls[0], baselineScore: baselineFor(module, hss),
    ...(kind === 'link' ? { kind: 'add-link', targetUrl: action.urls[1] } : { kind: 'add-entities', requiredEntities: items }),
    ...(priority ? { priority } : {}),
    ...(expected !== undefined ? { expectedDelta: expected } : {}),
  } as NewTask;
};

const briefFor = (action: ExecutiveAction, items: string[]): BriefRecommendationInput | null =>
  action.source !== 'links' && action.urls.length === 1 && !REMOVALS.has(action.type) && action.type !== 'internal-link'
    ? { origin: action.source, title: action.urls[0], sourceUrl: action.urls[0], ...(items.length ? { missingEntities: items } : {}) }
    : null;

/** Pure: derives the card from the action's own evidence; never fetches, writes or edits a page. */
export const buildExecutionCard = (action: ExecutiveAction, hss?: HssReport | null): ExecutionCard => {
  const items = itemsOf(action);
  const kind = artifactKind(action, items);
  const noTask = noTaskReason(action, kind);
  return {
    actionId: action.id,
    diagnosis: { codes: [...new Set(action.evidence.map((item) => `${item.source}:${item.code}`))], hssDelta: action.hssDelta, moduleDelta: action.moduleDelta?.value ?? null },
    location: { urls: [...action.urls] },
    artifact: { kind, items, drillTab: action.drillTab },
    deployment: { task: noTask ? null : taskFor(action, kind, items, hss), brief: action.blocked ? null : briefFor(action, items), noTask },
  };
};
