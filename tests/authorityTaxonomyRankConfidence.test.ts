import { describe, expect, it } from 'vitest';
import { buildTaxonomy } from '@/services/topicalAuthority';
import type { FocusPage } from '@/services/siteFocus';

const page = (host: string, h2: string[]): FocusPage => ({
  url: `https://${host}/p`, final_url: `https://${host}/p`, title: 'Coffee guide', word_count: 800, depth: 1, http_status: 200, links: [],
  heading_texts: { h2, h3: [] },
} as unknown as FocusPage);

const base = { coreLabel: 'coffee', coreKeys: new Set(['coffee']), language: 'en', source: 'test', now: '2026-10-01' };

describe('taxonomy rank and confidence branches', () => {
  it('ignores headings beyond the top-20 rank when ranking a merged group', () => {
    const filler = Array.from({ length: 20 }, (_, i) => `${['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango'][i]} filler`);
    const taxonomy = buildTaxonomy({
      ...base,
      competitors: [
        { domain: 'one.test', pages: [page('one.test', [...filler, 'espresso machines'])] },
        { domain: 'two.test', pages: [page('two.test', ['espresso machines'])] },
      ],
      suggestions: [],
    });
    const row = taxonomy!.subtopics.find((item) => item.label === 'espresso machines')!;
    expect(row.sources?.domains).toEqual(['one.test', 'two.test']);
    expect(row.rank).toBe(1);
  });

  it('keeps a Suggest plus PAA only group with zero competitor domains', () => {
    const taxonomy = buildTaxonomy({
      ...base,
      competitors: [{ domain: 'one.test', pages: [page('one.test', [])] }],
      suggestions: ['pour over brewing'],
      paa: ['pour over brewing?'],
    });
    const row = taxonomy!.subtopics[0];
    expect(row.sources).toEqual({ domains: [], suggest: true, paa: true });
    expect(row.confidence).toBeCloseTo(0.667, 3);
  });
});
