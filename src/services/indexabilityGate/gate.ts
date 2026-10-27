import { classifyIndexability, type GatePage, type IndexState } from './classify';

export interface GateOptions {
  /** User opt-in: score excluded pages anyway. */
  includeExcluded?: boolean;
}

export interface GateSummary {
  total: number;
  included: number;
  skipped: number;
  byState: Partial<Record<Exclude<IndexState, 'indexable' | 'unknown'>, number>>;
  includeExcluded: boolean;
}

export type GateExclusion = 'noindex' | 'canonicalized';

/** Exclusion reason for one page, or undefined when it should be scored. 4xx/5xx are handled by the existing status skip. */
export const exclusionOf = (page: GatePage): GateExclusion | undefined => {
  const state = classifyIndexability(page);
  return state === 'noindex' || state === 'canonicalized' ? state : undefined;
};

export const applyGate = <T extends GatePage>(pages: readonly T[], options: GateOptions = {}): { pages: T[]; summary: GateSummary } => {
  const byState: GateSummary['byState'] = {};
  const kept: T[] = [];
  pages.forEach((page) => {
    const state = classifyIndexability(page);
    if (options.includeExcluded || (state !== 'noindex' && state !== 'canonicalized' && state !== 'error-status')) { kept.push(page); return; }
    byState[state] = (byState[state] ?? 0) + 1;
  });
  return {
    pages: kept,
    summary: { total: pages.length, included: kept.length, skipped: pages.length - kept.length, byState, includeExcluded: !!options.includeExcluded },
  };
};
