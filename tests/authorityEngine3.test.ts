import { describe, expect, it } from 'vitest';
import { buildAuthorityReport, cosine, unigramKeys, isGenericAnchor, measureFreshness, buildContext, eligiblePages, focusMultiplier, quadrantFor, aggregateTas, velocityScore, simulateTas } from '@/services/topicalAuthority';
import { splitTemplates } from '@/services/topicalAuthority/templates';
import { COFFEE, COMPETITORS, NOW, OWN_HOST, coffeePage, ownReport, ownSite } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;

describe('aggregation', () => {
  it('weights the four pillars, rescales missing ones and couples to SFS', () => {
    expect(focusMultiplier(100)).toBe(1);
    expect(focusMultiplier(0)).toBe(0.7);
    expect(focusMultiplier(500)).toBe(1);
    const full = aggregateTas({ tcr: 80, cdes: 60, silc: 40, cvff: 100 }, 100);
    expect(full).toMatchObject({ tasRaw: 66, tas: 66, unavailable: [] });
    expect(aggregateTas({ tcr: 80, cdes: 60, silc: 40, cvff: 100 }, 0).tas).toBe(46);
    const partial = aggregateTas({ tcr: 50, cdes: null, silc: null, cvff: 100 }, 100);
    expect(partial.unavailable).toEqual(['cdes', 'silc']);
    expect(partial.tasRaw).toBeCloseTo(((0.35 * 50 + 0.1 * 100) / 0.45), 1);
    expect(aggregateTas({ tcr: null, cdes: 50, silc: 50, cvff: 50 }, 80)).toMatchObject({ tas: null, tasRaw: null });
    expect(simulateTas({ tcr: null, cdes: 1, silc: 1, cvff: 1 }, 50)).toBeNull();
    expect(simulateTas({ tcr: 100, cdes: 100, silc: 100, cvff: 100 }, 100)).toBeCloseTo(100, 6);
    expect(velocityScore(0.5, 20)).toBe(62);
    expect(velocityScore(null, 20)).toBe(80);
  });

  it('places sites in the four quadrants', () => {
    expect(quadrantFor(80, 80)).toBe('dominant_authority');
    expect(quadrantFor(80, 50)).toBe('boutique_specialist');
    expect(quadrantFor(60, 70)).toBe('diluted_giant');
    expect(quadrantFor(60, 30)).toBe('unfocused_generalist');
  });
});

describe('context helpers', () => {
  it('computes cosine, unigram keys and eligibility', () => {
    expect(cosine(new Map([['a', 1]]), new Map([['a', 2], ['b', 1]]))).toBeCloseTo(0.894, 2);
    expect(cosine(new Map(), new Map([['a', 1]]))).toBe(0);
    expect(unigramKeys('The Espresso machines', 'en').size).toBeGreaterThan(0);
    const pages = ownSite();
    const context = buildContext(pages, START, ownReport(pages));
    const eligible = eligiblePages(context);
    expect(eligible.every((entry) => entry.focus.trs >= 60 && entry.focus.type !== 'technical')).toBe(true);
    expect(context.pages.some((entry) => entry.url.includes('privacy'))).toBe(true);
    expect(eligible.some((entry) => entry.url.includes('privacy'))).toBe(false);
  });

  it('skips pages missing from the Site Focus report', () => {
    const pages = ownSite();
    const sfs = { ...ownReport(pages), pages: [] };
    expect(buildContext(pages, START, sfs).pages).toEqual([]);
  });

  it('classifies generic anchors in several languages', () => {
    ['Click here', ' read more… ', 'czytaj więcej', '詳細', 'اضغط هنا', ''].forEach((anchor) => expect(isGenericAnchor(anchor)).toBe(true));
    expect(isGenericAnchor('espresso machine review')).toBe(false);
  });
});

describe('freshness and templates', () => {
  it('counts only dated pages and lists stale ones', () => {
    const pages = ownSite();
    const context = buildContext(pages, START, ownReport(pages));
    const fresh = measureFreshness(eligiblePages(context), NOW);
    expect(fresh.dated).toBe(4);
    expect(fresh.stale).toEqual([`https://${OWN_HOST}/espresso/machine-review`]);
    expect(fresh.ratio).toBe(0.75);
    expect(measureFreshness([], NOW)).toEqual({ ratio: null, total: 0, dated: 0, undated: 0, stale: [] });
  });

  it('collapses programmatic clones to the strongest page', () => {
    const clones = ['warsaw', 'krakow', 'poznan', 'gdansk', 'lodz', 'wroclaw'].map((city) => coffeePage('local.test', { path: `/coffee-roasting-${city}`, title: `Coffee roasting ${city}`, terms: COFFEE, noUnique: true }));
    const home = coffeePage('local.test', { path: '/', title: 'Local coffee', terms: COFFEE });
    const pages = [home, ...clones];
    const sfs = ownReport(pages);
    const context = buildContext(pages, 'https://local.test/', sfs);
    const split = splitTemplates(eligiblePages(context));
    expect(split.duplicates).toHaveLength(5);
    expect(split.representatives.length).toBeLessThan(eligiblePages(context).length);
    const result = buildAuthorityReport(pages, 'https://local.test/', sfs, { now: NOW });
    expect(result.templateDuplicates).toHaveLength(5);
    expect(result.warnings).toContain('template-duplicates');
    expect(splitTemplates(eligiblePages(context).slice(0, 2)).duplicates).toEqual([]);
  });

  it('exposes shared competitor fixtures', () => {
    expect(COMPETITORS).toHaveLength(3);
  });
});
