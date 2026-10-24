import { describe, expect, it } from 'vitest';
import type { FocusPage } from '@/services/siteFocus';
import { buildTaxonomy } from '@/services/topicalAuthority';
import { coffeePage } from './authorityFixtures';

const sourcePage = (host: string, headings: string[], terms = ['alpha', 'beta']): FocusPage => coffeePage(host, {
  path: '/page', title: 'Guide', h2: headings, terms,
});
const input = (competitors: Array<{ domain: string; pages: FocusPage[] }>, suggestions: string[] = [], coreKeys = new Set<string>()) => ({
  coreLabel: 'guide', coreKeys, language: 'en', competitors, suggestions, source: 'test', now: '2026-10-01',
});

describe('coverage100 taxonomy remaining branches', () => {
  it('rejects empty and oversized heading candidates while retaining valid ones', () => {
    const heading = 'qzx qzy qzz qaa qab qac qad qae qaf';
    const pages = [sourcePage('one.test', ['!!!', heading, 'alpha guide']), sourcePage('two.test', ['alpha guide'])];
    const taxonomy = buildTaxonomy(input([{ domain: 'one.test', pages }, { domain: 'two.test', pages }], ['!!!']));
    expect(taxonomy?.subtopics.map((item) => item.label)).toContain('alpha guide');
    expect(taxonomy?.subtopics.map((item) => item.label)).not.toContain(heading);
  });

  it('caps matched suggestion questions at five and falls back to term surfaces', () => {
    const pages = [sourcePage('one.test', ['alpha machine']), sourcePage('two.test', ['alpha machine'])];
    pages.forEach((page) => { page.focus_terms = [{ term: 'shared-entity', surface: '', count: 2, weight: 4 }]; });
    const questions = Array.from({ length: 6 }, (_, index) => `alpha machine q${index}?`);
    const taxonomy = buildTaxonomy(input([{ domain: 'one.test', pages }, { domain: 'two.test', pages }], questions));
    expect(taxonomy?.subtopics[0].questions).toHaveLength(5);
    expect(taxonomy?.subtopics[0].entities).toContain('shared-entity');
    expect(taxonomy?.commonTerms).toHaveProperty('shared entity');
  });

  it('uses an empty suggestion safely and returns null for empty or under-supported sources', () => {
    expect(buildTaxonomy(input([]))).toBeNull();
    const one = sourcePage('one.test', ['only one domain']);
    const two = sourcePage('two.test', ['different domain']);
    expect(buildTaxonomy(input([{ domain: 'one.test', pages: [one] }, { domain: 'two.test', pages: [two] }]))).toBeNull();
  });

  it('assigns shared anchors to separate equal-weight pillars and exercises core-key fallback', () => {
    const headings = ['zzza foo', 'zzza bar', 'zzzb foo', 'zzzb bar'];
    const pages = [sourcePage('one.test', headings), sourcePage('two.test', headings)];
    const split = buildTaxonomy(input([{ domain: 'one.test', pages }, { domain: 'two.test', pages }]));
    expect(split?.pillars.map((pillar) => pillar.id)).toEqual(expect.arrayContaining(['foo', 'bar']));
    const fallback = buildTaxonomy(input([{ domain: 'one.test', pages }, { domain: 'two.test', pages }], [], new Set(['zzza', 'foo', 'zzzb', 'bar'])));
    expect(fallback?.subtopics.length).toBeGreaterThan(1);
  });
});
