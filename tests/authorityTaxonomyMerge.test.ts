import { describe, expect, it } from 'vitest';
import { previewTaxonomyMerge } from '@/services/topicalAuthority/taxonomyMerge';

const tax = {
  language: 'en',
  pillars: [{ id: 'espresso', label: 'espresso', importance: 1 }, { id: 'grinder', label: 'grinder', importance: 0.5 }],
  subtopics: [{ id: 'a', pillar: 'espresso' }, { id: 'b', pillar: 'espresso' }, { id: 'c', pillar: 'grinder' }],
} as never;

describe('taxonomy merge preview (#57)', () => {
  it('splits matched, added and manual-only without mutation', () => {
    const manual = ['Espresso', 'Tea'];
    const out = previewTaxonomyMerge(tax, manual);
    expect(out.matched).toEqual([{ manual: 'Espresso', pillarId: 'espresso', subtopics: 2 }]);
    expect(out.added).toEqual([{ pillarId: 'grinder', label: 'grinder', subtopics: 1 }]);
    expect(out.manualOnly).toEqual(['Tea']);
    expect(manual).toEqual(['Espresso', 'Tea']);
  });
  it('ignores blank manual labels', () => {
    expect(previewTaxonomyMerge(tax, ['  ']).manualOnly).toEqual(['  ']);
  });
});
