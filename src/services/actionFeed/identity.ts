import { busUrlKey } from '@/services/recommendationBus/url';
import type { ExecutiveAction } from './types';

/** 32-bit FNV-1a, hex: short, deterministic and independent of object order. */
const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const urlKey = (url: string): string => busUrlKey(url) || url.trim();

/**
 * Common action identity (GEM-89-01): project, run, type and the canonical URLs, sorted unless the
 * order carries meaning (a link source -> target is not the same action as target -> source).
 */
export const actionId = (projectId: string, runId: string, type: string, urls: readonly string[], ordered = false): string => {
  const keys = urls.map(urlKey);
  return `act-${fnv1a([projectId, runId, type, ...(ordered ? keys : [...new Set(keys)].sort())].join('|'))}`;
};

const evidenceKey = (item: ExecutiveAction['evidence'][number]): string => JSON.stringify([item.source, item.code, item.params ?? null, item.items ?? null]);

/** Merges actions with the same id, keeping every distinct piece of evidence and the strongest declared delta. */
export const dedupeActions = (actions: readonly ExecutiveAction[]): ExecutiveAction[] => {
  const merged = new Map<string, ExecutiveAction>();
  for (const action of actions) {
    const existing = merged.get(action.id);
    if (!existing) { merged.set(action.id, { ...action, evidence: [...action.evidence] }); continue; }
    const known = new Set(existing.evidence.map(evidenceKey));
    existing.evidence.push(...action.evidence.filter((item) => !known.has(evidenceKey(item))));
    if (!existing.moduleDelta || (action.moduleDelta && action.moduleDelta.value > existing.moduleDelta.value)) existing.moduleDelta = action.moduleDelta ?? existing.moduleDelta;
    existing.effort = existing.effort ?? action.effort;
  }
  return [...merged.values()];
};
