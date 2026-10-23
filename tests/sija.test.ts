import { describe, expect, it } from 'vitest';
import { classify, funnelCounts, scoreIntents, toSearchIntent } from '@/services/sija/classify';
import { parseFeatures } from '@/services/sija/features';
import { benchmark, featureVector, ssas } from '@/services/sija/ssas';
import type { PageFeatures } from '@/services/sija/types';

const page = (body: string) => parseFeatures(`<html><body><nav><table></table><ol></ol></nav>${body}<footer><form><input></form></footer></body></html>`);
const base: PageFeatures = { tables: 0, orderedLists: 0, unorderedLists: 0, formInputs: 0, calculators: 0, productCards: 0, localSignals: 0, words: 0, headings: 0, headingText: '' };

describe('sija features', () => {
  it('ignores chrome and counts structure', () => {
    const f = page('<h1>Title</h1><table></table><ol><li>a</li></ol><ul></ul><form><input name="x"><input type="hidden"><select></select></form>');
    expect(f).toMatchObject({ tables: 1, orderedLists: 1, unorderedLists: 1, formInputs: 2, headings: 1 });
  });
  it('detects calculators, products, local signals', () => {
    expect(page('<div class="mortgage-calculator"><input></div>').calculators).toBe(1);
    expect(page('<div class="product"><span>19,99 zł</span></div><div class="price" data-price="1"></div>').productCards).toBe(2);
    expect(page('<div itemtype="https://schema.org/Product"></div>').productCards).toBe(1);
    expect(page('<a href="tel:123">x</a><address>a</address><p>Opening hours</p>').localSignals).toBe(3);
    expect(page('<div itemtype="https://schema.org/LocalBusiness"></div>').localSignals).toBe(1);
  });
});

describe('sija classify', () => {
  const cases: Array<[string, Partial<PageFeatures>, string]> = [
    ['definitional', { headingText: 'What is SEO', words: 400 }, 'definitional'],
    ['definitional short', { headingText: 'Co to jest SEO', words: 10 }, 'definitional'],
    ['how-to', { headingText: 'How to bake', orderedLists: 1 }, 'how-to'],
    ['troubleshooting', { headingText: 'Fix error 500', orderedLists: 2 }, 'troubleshooting'],
    ['comparison', { headingText: 'A vs B', tables: 1 }, 'comparison'],
    ['curated-list', { headingText: 'Best tools', unorderedLists: 2, productCards: 3 }, 'curated-list'],
    ['tool', { calculators: 1, formInputs: 2 }, 'tool'],
    ['transactional', { productCards: 3, formInputs: 1 }, 'transactional'],
    ['local', { localSignals: 2 }, 'local'],
  ];
  it.each(cases)('%s', (_n, over, want) => {
    expect(classify({ ...base, ...over }).primary).toBe(want);
  });
  it('is null when nothing matches and mixed when close', () => {
    const none = classify(base);
    expect(none.primary).toBeNull();
    expect(toSearchIntent(none)).toBe('unknown');
    const mixed = classify({ ...base, headingText: 'How to fix error', orderedLists: 1 });
    expect(mixed.mixed.length).toBeGreaterThan(0);
    expect(toSearchIntent(mixed)).toBe('mixed');
    expect(scoreIntents(base).local).toBe(0);
  });
  it('maps to the 6-class contract and counts funnel stages', () => {
    const one = (over: Partial<PageFeatures>) => classify({ ...base, ...over });
    expect(toSearchIntent(one({ productCards: 3 }))).toBe('transactional');
    expect(toSearchIntent(one({ calculators: 1 }))).toBe('transactional');
    expect(toSearchIntent(one({ headingText: 'A vs B', tables: 1 }))).toBe('commercial');
    expect(toSearchIntent(one({ localSignals: 2 }))).toBe('navigational');
    expect(toSearchIntent(one({ headingText: 'What is X' }))).toBe('informational');
    expect(funnelCounts([one({ productCards: 3 }), one({ headingText: 'What is X' }), one({ tables: 1, headingText: 'vs' }), classify(base)])).toEqual({ TOFU: 1, MOFU: 1, BOFU: 1 });
  });
});

describe('ssas', () => {
  const top = [{ ...base, tables: 2, words: 1500, headings: 10 }, { ...base, tables: 3, words: 1800, headings: 12 }, { ...base, tables: 2, words: 1200, headings: 8 }];
  it('is inconclusive without benchmark or with zero vectors', () => {
    expect(benchmark(top.slice(0, 2))).toBeNull();
    expect(ssas(top[0], top.slice(0, 2)).status).toBe('inconclusive');
    expect(ssas(base, [base, base, base])).toEqual({ status: 'inconclusive', score: null, benchmarkPages: 3 });
    expect(featureVector(base).every((x) => x === 0)).toBe(true);
  });
  it('scores aligned and mismatching pages', () => {
    const aligned = ssas(top[0], top);
    expect(aligned.status).toBe('aligned');
    expect(aligned.score).toBeGreaterThan(80);
    const bad = ssas({ ...base, productCards: 10, formInputs: 5, words: 100, headings: 1 }, top);
    expect(bad.status).toBe('mismatch');
    expect(bad.score).toBeLessThan(55);
  });
});
