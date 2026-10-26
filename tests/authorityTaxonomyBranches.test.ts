import { describe, expect, it } from 'vitest';
import type { FocusPage } from '@/services/siteFocus';
import { buildTaxonomy, type TaxonomyInput } from '@/services/topicalAuthority';
import { coffeePage, NOW } from './authorityFixtures';

const input = (pages: FocusPage[]): TaxonomyInput => ({
  coreLabel: 'coffee', coreKeys: new Set(), language: 'en', suggestions: [], source: 'test', now: NOW,
  competitors: [{ domain: 'one.test', pages }, { domain: 'two.test', pages }],
});

describe('direct taxonomy optional evidence', () => {
  it('accepts sparse H2/H3 evidence and absent focus terms without inventing entities', () => {
    const base = coffeePage('one.test', { path: '/guide', title: 'Coffee' });
    const pages = [
      { ...base, heading_texts: { h1: ['Coffee'], h2: undefined, h3: ['Espresso grinder'] }, focus_terms: undefined },
      { ...base, heading_texts: { h1: [], h2: ['Coffee extraction'], h3: undefined }, focus_terms: undefined },
      { ...base, heading_texts: undefined },
    ] as FocusPage[];
    const taxonomy = buildTaxonomy(input(pages));
    expect(taxonomy?.subtopics.map((row) => row.label)).toEqual(['Coffee extraction', 'Espresso grinder']);
    expect(taxonomy?.subtopics.every((row) => row.entities.length === 0)).toBe(true);
  });

  it.each([false, true])('sorts multiple equal-importance pillars by ID (reverse=%s)', (reverse) => {
    const headings = ['coffee alpha grinder', 'coffee alpha roast', 'brewing zeta grinder', 'brewing zeta roast',
      'espresso middle grinder', 'espresso middle roast'];
    if (reverse) headings.reverse();
    const pages = [coffeePage('one.test', { path: '/guide', title: 'Coffee', h2: headings })];
    const taxonomy = buildTaxonomy({ ...input(pages), coreKeys: new Set(['coffee', 'brewing', 'espresso', 'grinder', 'roast']) });
    expect(taxonomy?.pillars.map((pillar) => pillar.id)).toEqual(['alpha', 'middle', 'zeta']);
  });
});
