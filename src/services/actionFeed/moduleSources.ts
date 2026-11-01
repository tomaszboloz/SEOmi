import type { AioReport } from '@/services/aioReadiness';
import type { SprsReport } from '@/services/semanticGraph/sprs';
import { actionId } from './identity';
import type { ActionScope } from './sources';
import type { ExecutiveAction } from './types';

/** Per-module cap so one module never floods the feed; the rest stays in the module tab. */
export const MODULE_ACTION_LIMIT = 10;

const base = (scope: ActionScope, type: string, source: 'sprs' | 'aior', url: string, code: string, items: string[]): ExecutiveAction => ({
  id: actionId(scope.projectId, scope.runId, type, [url]), type, source, urls: [url], effort: null, moduleDelta: null,
  hssDelta: null, conflicts: [], dependsOn: [], blocked: false, drillTab: source === 'sprs' ? 'visualisations' : 'aio',
  evidence: [{ source, code, items }],
});

/**
 * SPRS actions (#89 GEM-89): leaking pages lose flow to unrelated targets, under-linked pages need inbound links.
 * No engine simulation exists for them, so moduleDelta stays null and the delta is shown as unavailable.
 */
export const sprsActions = (scope: ActionScope, report: SprsReport | null | undefined, urlByNode: ReadonlyMap<string, string>): ExecutiveAction[] => {
  if (!report || report.status !== 'ready') return [];
  const rows = [...report.pages].sort((a, b) => a.score - b.score || a.nodeId.localeCompare(b.nodeId));
  return rows.flatMap((page) => {
    const url = urlByNode.get(page.nodeId);
    if (!url) return [];
    if (page.leak) return [base(scope, 'sprs:fix-leak', 'sprs', url, 'fix-leak', [])];
    return page.underLinked ? [base(scope, 'sprs:add-inlinks', 'sprs', url, 'add-inlinks', [])] : [];
  }).slice(0, MODULE_ACTION_LIMIT);
};

/** AIO-R actions: pages with weak passages, lowest score first; the issues of each weak passage are the evidence. */
export const aioActions = (scope: ActionScope, report: AioReport | null | undefined): ExecutiveAction[] => {
  if (!report || report.availability === 'unavailable' || report.availability === 'error' || report.availability === 'cancelled') return [];
  return [...report.pages]
    .filter((page) => page.weakChunks.length > 0)
    .sort((a, b) => a.score - b.score || a.url.localeCompare(b.url))
    .slice(0, MODULE_ACTION_LIMIT)
    .map((page) => base(scope, 'aior:rewrite-weak-passages', 'aior', page.url, 'rewrite-weak-passages', [...new Set(page.weakChunks.flatMap((chunk) => chunk.issues))]));
};
