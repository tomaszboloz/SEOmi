import { afterEach, describe, expect, it } from 'vitest';
import { brandReason, buildSiteFocusReport, cleanBrandList, MAX_BRAND_TERMS, resolveBrandPolicy, scoreIncremental } from '@/services/siteFocus';
import { summarizeSiteFocus } from '@/services/export/focusSummary';
import { phraseKey } from '@/services/siteFocus/terms';
import {
  cleanBrandInput, focusBrandKey, parseBrandInput, projectFocusOptions, readBrandPolicy, writeBrandPolicy,
} from '@/services/siteFocusMonitoring';
import { DIABETES_TERMS, makePage } from './siteFocusFixtures';

const HOST = 'insulina.test';
const START = `https://${HOST}/`;
const pages = () => Array.from({ length: 12 }, (_, i) => makePage(HOST, {
  path: i ? `/p-${i}` : '/', title: `Insulina ${i}`,
  terms: [['insulina', 4], ['insulina pompa', 2], ...DIABETES_TERMS.slice(i % 4, (i % 4) + 8).map((term): [string, number] => [term, 3])],
}));
const build = (brand?: Parameters<typeof resolveBrandPolicy>[2], competitorTerms: string[] = []) =>
  buildSiteFocusReport(pages(), START, { language: 'pl', brand, competitorTerms, now: '2026-10-30T00:00:00Z' });
const hasTerm = (report: ReturnType<typeof build>, term: string) =>
  Object.keys(report.model.termCluster).some((key) => key.split(' ').includes(phraseKey(term, 'pl') ?? term));

afterEach(() => localStorage.clear());

describe('brand policy (#56)', () => {
  it('excludes the domain name and aliases, flags competitor brands and keeps exceptions', () => {
    const policy = resolveBrandPolicy(START, 'en', { aliases: ['Acme Shop'], competitors: ['RivalCo'], exceptions: [] });
    expect([...policy.own]).toEqual(expect.arrayContaining([[phraseKey('insulina', 'en'), 'own-domain'], [phraseKey('acme shop', 'en'), 'own-alias']]));
    const key = (text: string) => phraseKey(text, 'en') ?? text;
    expect(brandReason(key('insulina pump'), policy)).toBe('own-domain');
    expect(brandReason(key('acme shop opinie'), policy)).toBe('own-alias');
    expect(brandReason(key('acme'), policy)).toBeUndefined();
    expect(brandReason(key('rivalco login'), policy)).toBe('competitor-brand');
    expect(brandReason(key('glucose meter'), policy)).toBeUndefined();
    const homonym = resolveBrandPolicy(START, 'en', { exceptions: ['insulina'] });
    expect(homonym.own.size).toBe(0);
    expect(brandReason(key('insulina pump'), homonym)).toBeUndefined();
  });

  it('cleans user input: trims, de-duplicates case-insensitively and caps the list', () => {
    expect(cleanBrandList(['  Acme  Shop ', 'acme shop', '', 7, 'x'.repeat(61)])).toEqual(['Acme Shop']);
    expect(cleanBrandList(Array.from({ length: 40 }, (_, i) => `b${i}`))).toHaveLength(MAX_BRAND_TERMS);
    expect(cleanBrandInput({ aliases: ['A'], competitors: 'nope', extra: ['x'] })).toEqual({ aliases: ['A'] });
    expect(cleanBrandInput(null)).toEqual({});
    expect(parseBrandInput('Acme\nRival, Other\n')).toEqual(['Acme', 'Rival', 'Other']);
  });

  it('keeps a brand-looking industry term in topics when it is an exception (homonym, Polish forms)', () => {
    expect(hasTerm(build(), 'insulina')).toBe(false);
    const kept = build({ exceptions: ['Insulina'] });
    expect(hasTerm(kept, 'insulina')).toBe(true);
    expect(kept.model.brand).toEqual({ exceptions: ['Insulina'] });
    expect(kept.brandFilter?.ownBrand).toEqual([]);
    expect(kept.coreConfigHash).not.toBe(build().coreConfigHash);
  });

  it('moves brand noise out of competitor gaps and explains why (GEM-56-05)', () => {
    const report = build({ aliases: ['Acme'], competitors: ['Żółć Pharma'] }, ['Acme opinie', 'żółć pharma sklep', 'insulina cena', 'telemedycyna']);
    const gap = report.gaps.find((item) => item.code === 'competitor-terms');
    expect(gap?.terms).toEqual(['telemedycyna']);
    expect(report.brandFilter?.filteredGaps).toEqual([
      { term: 'Acme opinie', reason: 'own-alias' }, { term: 'insulina cena', reason: 'own-domain' }, { term: 'żółć pharma sklep', reason: 'competitor-brand' },
    ]);
    expect(summarizeSiteFocus(report).brand_filtered).toHaveLength(3);
  });

  it('reuses the same dictionary for incremental scoring', () => {
    const report = build({ exceptions: ['insulina'] });
    const fresh = makePage(HOST, { path: '/new', title: 'Insulina nowa', terms: [['insulina', 5], ['glucose', 3]] });
    const { scored } = scoreIncremental(report, [fresh], START, '2026-10-30T01:00:00Z');
    expect(scored[0].keywordsFound.some((item) => item.term.includes('insulina'))).toBe(true);
  });

  it('stores one dictionary per project and feeds every SFS consumer (GEM-56-T03)', () => {
    expect(writeBrandPolicy('pa', { aliases: ['Acme'], exceptions: ['insulina'] })).toBe(true);
    expect(writeBrandPolicy('pb', { competitors: ['Rival'] })).toBe(true);
    expect(readBrandPolicy('pa')).toEqual({ aliases: ['Acme'], exceptions: ['insulina'] });
    expect(readBrandPolicy('pb')).toEqual({ competitors: ['Rival'] });
    expect(projectFocusOptions('pa').brand).toEqual({ aliases: ['Acme'], exceptions: ['insulina'] });
    expect(projectFocusOptions('pc').brand).toBeUndefined();
    writeBrandPolicy('pa', {});
    expect(localStorage.getItem(focusBrandKey('pa'))).toBeNull();
    expect(writeBrandPolicy('../x', { aliases: ['A'] })).toBe(false);
    expect(readBrandPolicy(undefined)).toEqual({});
  });
});
