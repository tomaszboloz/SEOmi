import { busUrlKey } from '@/services/recommendationBus/url';
import type { RemovalGuard } from '@/services/recommendationBus/guard';
import type { ExecutiveAction } from './types';

const PRUNE = new Set(['sfs:remove-offtopic']);
const KEEP = new Set(['sfs:strengthen-borderline', 'tas:refresh-stale', 'tas:deepen-shallow', 'sfs:expand-core-cluster']);
const MERGE = new Set(['tas:merge-cannibalized']);
const EXPAND = new Set(['tas:deepen-shallow', 'sfs:expand-core-cluster']);

const key = (url: string): string => busUrlKey(url) || url;
const overlap = (left: ExecutiveAction, right: ExecutiveAction): string[] => {
  const keys = new Set(right.urls.map(key));
  return left.urls.filter((url) => keys.has(key(url)));
};

/**
 * Conflict arbitration (GEM-89-02/05), conservative by design:
 * - #81 guardrail first: a removal touching protected or needs-data URLs is flagged; when no URL is left
 *   removable the action is blocked.
 * - keep vs prune: a URL another action wants to keep or improve blocks its removal (keep wins).
 * - merge vs expand: expanding a cannibalised URL depends on the merge being done first.
 * Returns new objects; the input actions are not mutated.
 */
export const arbitrateActions = (actions: readonly ExecutiveAction[], guard: Partial<RemovalGuard> = {}): ExecutiveAction[] => {
  const protectedKeys = new Set((guard.protectedUrls ?? []).map(key));
  const needsKeys = new Set((guard.needsDataUrls ?? []).map(key));
  const out = actions.map((action) => ({ ...action, conflicts: [...action.conflicts], dependsOn: [...action.dependsOn] }));
  for (const action of out) {
    if (PRUNE.has(action.type)) {
      const shielded = action.urls.filter((url) => protectedKeys.has(key(url)));
      const needs = action.urls.filter((url) => needsKeys.has(key(url)));
      if (shielded.length) action.conflicts.push({ kind: 'protected-by-evidence', urls: shielded });
      if (needs.length) action.conflicts.push({ kind: 'needs-data', urls: needs });
      for (const other of out.filter((item) => KEEP.has(item.type))) {
        const urls = overlap(action, other);
        if (urls.length) action.conflicts.push({ kind: 'keep-vs-prune', urls, withAction: other.id });
      }
      const stopped = new Set(action.conflicts.flatMap((conflict) => conflict.urls).map(key));
      action.blocked = action.urls.length > 0 && action.urls.every((url) => stopped.has(key(url)));
    }
    if (EXPAND.has(action.type)) {
      for (const merge of out.filter((item) => MERGE.has(item.type))) {
        const urls = overlap(action, merge);
        if (!urls.length) continue;
        action.conflicts.push({ kind: 'merge-vs-expand', urls, withAction: merge.id });
        if (!action.dependsOn.includes(merge.id)) action.dependsOn.push(merge.id);
      }
    }
  }
  return out;
};
