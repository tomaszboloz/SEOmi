import { describe, expect, it } from 'vitest';
import { buildContext, findCannibalization } from '@/services/topicalAuthority';
import { SAME_H1_JACCARD, SAME_INTENT_COSINE } from '@/services/topicalAuthority/cannibal';
import { COFFEE, OWN_HOST, coffeePage, ownReport } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const groupsOf = (specs: Array<{ path: string; h1: string; terms: string[] }>) => {
  const pages = specs.map((spec) => coffeePage(OWN_HOST, { path: spec.path, title: spec.h1, h1: spec.h1, terms: spec.terms, noUnique: true }));
  const context = buildContext(pages, START, ownReport(pages));
  return findCannibalization(context.pages, context, [], new Map());
};

describe('cannibalization intent and language edges (#59 GEM-59-T02, D01 defaults)', () => {
  it('documents the default thresholds used for grouping', () => {
    expect(SAME_INTENT_COSINE).toBe(0.88);
    expect(SAME_H1_JACCARD).toBe(0.5);
  });

  it('does not group pages with near-identical vocabulary but different headline intent', () => {
    const groups = groupsOf([
      { path: '/buy-espresso-machine', h1: 'Buy espresso machine online', terms: COFFEE },
      { path: '/espresso-history', h1: 'History of the grinder kettle', terms: COFFEE },
    ]);
    expect(groups).toEqual([]);
  });

  it('groups pages that share vocabulary and the same headline intent', () => {
    const groups = groupsOf([
      { path: '/espresso-machines', h1: 'Best espresso machines', terms: COFFEE },
      { path: '/espresso-machine-guide', h1: 'Best espresso machines guide', terms: COFFEE },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].edges[0].basis).toBe('intent');
  });

  it('keeps pages with the same headline but unrelated vocabulary apart', () => {
    const groups = groupsOf([
      { path: '/a', h1: 'Best espresso machines', terms: COFFEE.slice(0, 4) },
      { path: '/b', h1: 'Best espresso machines', terms: ['privacy', 'cookies', 'policy', 'legal'] },
    ]);
    expect(groups).toEqual([]);
  });
});
