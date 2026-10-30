import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateDecay } from '@/services/semanticDecay/alert';
import { buildReferenceSnapshot } from '@/services/semanticDecay/recordReferenceSnapshot';
import { classifySerpUrl, summarizeSerpFormats } from '@/services/semanticDecay/serpFormat';
import type { SerpSnapshot } from '@/services/semanticDecay/types';
import type { ReferenceTaxonomy } from '@/services/topicalAuthority';

const taxonomy: ReferenceTaxonomy = {
  version: 1, coreLabel: 'glukometr', language: 'pl', builtAt: '2026-01-01T00:00:00.000Z', source: 'dataforseo', competitors: [], suggestionCount: 0,
  pillars: [{ id: 'p1', label: 'P1', importance: 1 }], subtopics: [], commonTerms: { glukometr: 1 },
};
const hits = (urls: string[]) => [{ query: 'glukometr', source: 'dataforseo', hits: urls.map((url, i) => ({ url, rank: i + 1, domain: '' })) }];

beforeEach(() => localStorage.clear());

describe('Decay Radar TOP K format (#98 GEM-98-03)', () => {
  it.each([
    ['https://www.youtube.com/watch?v=1', 'video'], ['https://pl.wikipedia.org/wiki/Glukometr', 'encyclopedia'],
    ['https://www.reddit.com/r/diabetes/x', 'forum'], ['https://a.pl/forum/glukometry', 'forum'],
    ['https://shop.pl/produkt/accu-chek', 'product'], ['https://shop.pl/kategoria/glukometry/', 'category'],
    ['https://a.pl/blog/jak-wybrac', 'guide'], ['https://a.pl/ranking-glukometrow', 'listicle'],
    ['https://a.pl/news/x', 'news'], ['https://a.pl/kalkulator-bmi', 'tool'], ['https://a.pl/', 'homepage'],
    ['https://a.pl/abc', null], ['nope', null],
  ])('classifies %s', (url, format) => expect(classifySerpUrl(url)).toBe(format));

  it('needs a clear majority with enough coverage before naming a dominant format', () => {
    expect(summarizeSerpFormats(['https://a.pl/blog/1', 'https://b.pl/blog/2', 'https://c.pl/produkt/x'])).toMatchObject({ dominantFormat: 'guide', dominantIntent: 'informational' });
    expect(summarizeSerpFormats(['https://a.pl/blog/1', 'https://c.pl/produkt/x']).dominantFormat).toBeNull();
    expect(summarizeSerpFormats(['https://a.pl/blog/1', 'https://a.pl/x', 'https://a.pl/y']).dominantFormat).toBeNull();
    expect(summarizeSerpFormats(['https://youtube.com/1', 'https://youtube.com/2']).dominantIntent).toBeNull();
    expect(summarizeSerpFormats([])).toEqual({ dominantFormat: null, dominantIntent: null, coverage: 0, counts: {} });
  });

  it('records the dominant format and alerts when shops replace guides persistently', () => {
    const guides = ['https://a.pl/blog/1', 'https://b.pl/poradnik/2', 'https://c.pl/guide/3'];
    const shops = ['https://a.pl/produkt/1', 'https://b.pl/produkt/2', 'https://c.pl/sklep/3/'];
    const base = buildReferenceSnapshot(taxonomy, hits(guides), { country: 'PL', language: 'pl' }) as SerpSnapshot;
    expect(base).toMatchObject({ dominantFormat: 'guide', dominantIntent: 'informational' });
    const shift = (id: string) => ({ ...(buildReferenceSnapshot(taxonomy, hits(shops), { country: 'PL', language: 'pl' }) as SerpSnapshot), id });
    expect(shift('x')).toMatchObject({ dominantFormat: 'product', dominantIntent: 'transactional' });
    const result = evaluateDecay([base, shift('a'), shift('b')], null, '2026-03-01T00:00:00Z');
    expect(result.verdict).toBe('alert');
    expect(result.reasons).toEqual(expect.arrayContaining(['intent', 'format']));
  });
});
