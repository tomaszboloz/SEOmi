import type { SprsPage } from './sprs';

export type SprsFlag = 'deadEnd' | 'underLinked' | 'leak';
const FLAGS: SprsFlag[] = ['deadEnd', 'underLinked', 'leak'];

/** A diagnostic flag that switched on or off for a page present before and after a What-If change (GEM-71-09). */
export interface FlagChange { nodeId: string; flag: SprsFlag; now: boolean }

export const flagChanges = (before: SprsPage[], after: SprsPage[]): FlagChange[] => {
  const prior = new Map(before.map((page) => [page.nodeId, page]));
  return after.flatMap((page) => {
    const was = prior.get(page.nodeId);
    return was ? FLAGS.filter((flag) => was[flag] !== page[flag]).map((flag) => ({ nodeId: page.nodeId, flag, now: page[flag] })) : [];
  }).sort((a, b) => (a.nodeId === b.nodeId ? FLAGS.indexOf(a.flag) - FLAGS.indexOf(b.flag) : a.nodeId < b.nodeId ? -1 : 1));
};
