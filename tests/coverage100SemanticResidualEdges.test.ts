import { describe, expect, it } from 'vitest';
import { buildTopTenContentGap } from '@/services/targetPhraseAudit/contentGap';
import { computeSprs, simulateWhatIf } from '@/services/semanticGraph/sprs';
import { classifyIndexability } from '@/services/indexabilityGate';
import { buildAuthorityPrompt, buildGapBrief, buildAuthorityReport, buildTaxonomy } from '@/services/topicalAuthority';
import { findCannibalization } from '@/services/topicalAuthority/cannibal';
import { buildTopicalBenchmark } from '@/services/topicalAuthorityReference';
import { buildTopics } from '@/services/topicalDiagnosis/topics';
import { coffeePage, NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

describe('coverage100 semantic residual edges', () => {
  it('sorts equal what-if deltas deterministically and keeps self-links out', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const rows = simulateWhatIf(nodes, [{ source: 'a', target: 'a' }], { add: [
      { source: 'c', target: 'a' }, { source: 'c', target: 'b' }, { source: 'd', target: 'a' }, { source: 'd', target: 'b' },
    ] });
    expect(rows.map((row) => row.nodeId)).toEqual(['a', 'b', 'c', 'd']);
    expect(computeSprs(nodes, rows.map((row) => ({ source: row.nodeId, target: 'a' })))).toHaveProperty('status', 'ready');
  });

  it('uses final-url evidence and compares topics against a supplied target', () => {
    const audit = { url: '', final_url: 'https://a.test/', http_status: 200, content_stats: { body_text: 'espresso grinder guide' }, meta_tags: { title: 'Espresso guide' }, headings: { h1_texts: [] } } as never;
    const report = buildTopTenContentGap({ phrase: 'espresso', rows: [{ type: 'organic', rank: 1, url: 'https://a.test/' }], evidence: [{ url: 'https://a.test/', fetchedAt: null, audit }], targetPageAudit: { url: 'https://target.test/', final_url: 'https://target.test/', content_stats: { body_text: 'espresso' } } as never, now: () => NOW });
    expect(report.status).toBe('complete');
    expect(report.topics.find((topic) => topic.term === 'grinder')).toMatchObject({ status: 'gap', targetOccurrences: 0 });
  });

  it('covers taxonomy and brief fallbacks for empty labels and capped questions', () => {
    const pages = [coffeePage('one.test', { path: '/one', title: 'Coffee', h2: ['Coffee machines'] }), coffeePage('two.test', { path: '/two', title: 'Coffee', h2: ['Coffee machines'] })];
    const questions = ['Coffee machines guide?', 'Coffee machines buying?', 'Coffee machines care?', 'Coffee machines choice?', 'Coffee machines setup?', 'Coffee machines price?', 'Coffee machines repair?'];
    const taxonomy = buildTaxonomy({ coreLabel: 'coffee', coreKeys: new Set(['coffee']), language: 'en', competitors: [{ domain: 'one.test', pages }, { domain: 'two.test', pages }], suggestions: questions, source: 'test', now: NOW });
    expect(taxonomy?.subtopics.some((row) => row.questions.length === 5)).toBe(true);
    const base = buildAuthorityReport(ownSite(), `https://${OWN_HOST}/`, ownReport(), { taxonomy: referenceTaxonomy(), now: NOW });
    const missing = { subtopicId: 'new', pillar: 'p', label: '', importance: 0.5, status: 'missing_gap' as const, coverage: 0 as const, urls: [], similarity: 0, entitiesPresent: [], entitiesMissing: [], questionsMissing: [] };
    const brief = buildGapBrief({ ...base, coverage: [
      { subtopicId: 'mate-a', pillar: 'p', label: 'Mate A', importance: 1, status: 'covered_strong', coverage: 1, urls: ['/a'], bestUrl: '/a', similarity: 90 },
      { subtopicId: 'mate-b', pillar: 'p', label: 'Mate B', importance: 1, status: 'covered_strong', coverage: 1, urls: ['/b'], bestUrl: '/b', similarity: 80 },
      missing,
    ] as never }, missing);
    expect(brief.h1).toBe('');
    expect(buildAuthorityPrompt(brief, 'coffee', '')).toContain('language "en"');
  });

  it('keeps no-taxonomy reports measurable and handles zero shared entities', () => {
    const pages = ownSite();
    const start = `https://${OWN_HOST}/`;
    expect(buildAuthorityReport(pages, start, ownReport(), { taxonomy: null, now: NOW }).warnings).toContain('no-pillars');
    const taxonomy = referenceTaxonomy(pages)!;
    const missingTaxonomy = { ...taxonomy, subtopics: [...taxonomy.subtopics, { id: 'missing', pillar: taxonomy.pillars[0].id, label: 'Quantum vacuum', keys: ['quantum', 'vacuum'], importance: 1, entities: [], questions: [] }] };
    expect(buildAuthorityReport(pages, start, ownReport(pages), { taxonomy: missingTaxonomy, now: NOW }).coverage.some((row) => row.coverage === 0)).toBe(true);
    const make = (url: string) => ({ url, page: {} as never, focus: { trs: 80, type: 'article' as const } as never, vector: new Map([['x', 1]]), zone: new Set(['topic']), h1: new Set(['topic']), headings: [], keys: new Set(['x']), date: undefined });
    const first = make('https://x.test/a');
    const second = make('https://x.test/b');
    const context = { language: 'en', pages: [first, second], byUrl: new Map([[first.url, first], [second.url, second]]), coreKeys: new Set<string>() };
    expect(findCannibalization([first, second], context, [], new Map())).toHaveLength(1);
  });

  it('returns unavailable for empty benchmark inputs and skips weak lexical pairs', () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const own = buildAuthorityReport(pages, `https://${OWN_HOST}/`, ownReport(pages), { taxonomy, now: NOW });
    expect(buildTopicalBenchmark(own, OWN_HOST, [{ domain: 'empty.test', pages: [] }], taxonomy, NOW)).toBeNull();
    const doc = (id: string, term: string) => ({ id, pages: [], primaryPage: { url: `https://x.test/${id}` }, urls: new Set([`https://x.test/${id}`]), languages: ['en'], terms: new Set([term]), titleTerms: new Set([term]), titleForms: new Map(), section: 'x', role: 'content', partialEvidence: false }) as never;
    const result = buildTopics([doc('doc-0', 'alpha'), doc('doc-1', 'beta')], new Map([['doc-0', 'area'], ['doc-1', 'area']]), { documentFrequency: new Map(), comparable: 2, isTopical: () => true, idf: () => 1 });
    expect(result).toMatchObject({ pairs: [], topics: [], singletons: ['doc-0', 'doc-1'] });
  });

  it('falls back from an empty canonical-target list to the page canonical', () => {
    const page = { url: 'https://a.test/p', final_url: 'https://a.test/p', http_status: 200, canonical_targets: [], canonical: 'https://b.test/p' } as never;
    expect(classifyIndexability(page)).toBe('canonicalized');
  });
});
