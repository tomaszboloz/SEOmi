import { describe, expect, it } from 'vitest';
import { normalize } from '@/services/embeddings/vector';
import { buildBaseline, documentFrequency } from '@/services/igos/baseline';
import { baseCoverage, edsi, fhem, nefr, novelEntities, penalty, sdd } from '@/services/igos/components';
import { buildHeatmap, evidenceAdvice, recommend } from '@/services/igos/heatmap';
import { buildIgosReport } from '@/services/igos/report';
import { zoneChunks, zoneOf } from '@/services/igos/zones';
import type { CompetitorDoc, TargetDoc } from '@/services/igos/types';
import { classify, funnelCounts, scoreIntents, toSearchIntent } from '@/services/sija/classify';
import { parseFeatures } from '@/services/sija/features';
import { benchmark, featureVector, ssas } from '@/services/sija/ssas';
import type { PageFeatures } from '@/services/sija/types';
import { applyGate, canonicalTarget, classifyIndexability, detectConflicts, hasNoindex } from '@/services/indexabilityGate';

const vector = (...values: number[]) => normalize(values);
const doc = (url: string, entities: string[] = ['A'], status: number | null = 200): CompetitorDoc => ({ url, rank: 1, fetchedAt: null, status, entities, passages: [{ text: 'source', vector: vector(1, 0) }], terms: new Map([['x', 2]]) });
const target = (chunks = [{ text: 'chunk', offset: 0, heading: 'H2', vector: vector(1, 0) }]): TargetDoc => ({ url: 'https://target.test/', entities: ['A', 'N'], chunks, terms: new Map([['x', 1]]), wordCount: 100 });
const base: PageFeatures = { tables: 0, orderedLists: 0, unorderedLists: 0, formInputs: 0, calculators: 0, productCards: 0, localSignals: 0, words: 0, headings: 0, headingText: '' };

describe('coverage100 igos, sija and indexability edges', () => {
  it('keeps IGOS evidence available only with comparable passages', () => {
    expect(buildBaseline([doc('a', [], 500)], 1).status).toBe('unavailable');
    const partialFew = buildBaseline([doc('a'), doc('b')], 3);
    expect(partialFew.status).toBe('partial');
    expect(partialFew.limitations).toContain('too-few-documents');
    const partialMissing = buildBaseline([doc('a'), doc('b'), doc('c')], 5);
    expect(partialMissing.status).toBe('partial');
    expect(partialMissing.limitations).toContain('some-documents-missing');

    const ready = buildBaseline([doc('a'), doc('b'), doc('c')], 3);
    expect(documentFrequency([doc('a', [' Foo ']), doc('b', ['foo', '   '])]).get('foo')?.df).toBe(2);
    expect(novelEntities(['A', 'N', 'n'], ready)).toEqual(['n']);
    expect(nefr(0, 10)).toBe(0);
    expect(edsi('PMID: 1234', 0)).toBeCloseTo(1 / 3);
    expect(fhem('We measured it.')).toBeCloseTo(1 / 3);
    expect(sdd(new Map(), new Map())).toBe(0);
    expect(sdd(new Map([['a', 1]]), new Map([['a', 1]]))).toBeCloseTo(0);
    expect(baseCoverage(target([],), { ...ready, consensusEntities: [] })).toBe(1);
    expect(baseCoverage({ ...target(), entities: ['A'] }, { ...ready, consensusEntities: ['A', 'B'] })).toBe(0.5);
    expect(penalty(0.5)).toBe(1);
  });

  it('builds zones, heatmap sections and evidence advice', () => {
    expect(zoneOf(0.47, 0.6)).toBe('neutral');
    expect(zoneOf(0.47, 0.59)).toBe('drift');
    expect(zoneOf(0.5, 0.85)).toBe('echo');
    expect(zoneOf(0.5, 0.5)).toBe('gain');
    const docs = [doc('a'), doc('b'), doc('c')];
    const baseline = buildBaseline(docs, 3);
    const report = buildIgosReport(target([{ text: 'a'.repeat(200), offset: 2, heading: 'H2', vector: vector(1, 0) }]), docs, baseline);
    expect(report.zones[0].evidence).toMatchObject({ url: 'a' });
    expect(buildHeatmap(report)[0].cells[0].excerpt.length).toBe(140);
    expect(recommend(buildHeatmap(report))[0].kind).toBe('rewrite-echo');
    expect(recommend([{ heading: 'H', cells: [{ zone: 'drift', offset: 0, label: 'drift', topic: 0.1, nearest: 0.1, excerpt: 'x', source: null }, { zone: 'neutral', offset: 1, label: 'neutral', topic: 0.1, nearest: 0.7, excerpt: 'x', source: null }] }])).toEqual([{ kind: 'refocus-drift', offset: 0, source: null }]);
    expect(evidenceAdvice({ ...report, components: { ...report.components!, edsi: 0 } })[0].kind).toBe('add-evidence');
    expect(zoneChunks(target().chunks, { ...baseline, centroid: null }, docs)).toEqual([]);
    expect(buildIgosReport({ ...target(), chunks: [] }, docs, baseline)).toMatchObject({ status: 'unavailable', limitations: expect.arrayContaining(['no-target-chunks']) });
  });

  it('extracts structural signals and maps all intent classes', () => {
    const features = parseFeatures('<nav><table></table></nav><form><input /></form><h1>How to fix an error</h1><ol><li>x</li></ol><table></table><div class="calculator"><input /></div><address>x</address>');
    expect(features.formInputs).toBe(1);
    expect(features.calculators).toBe(1);
    expect(classify({ ...base, headingText: 'How to fix an error', orderedLists: 1 }).primary).toBe('how-to');
    expect(toSearchIntent(classify({ ...base, productCards: 1 }))).toBe('transactional');
    expect(scoreIntents(base).local).toBe(0);
    expect(funnelCounts([classify({ ...base, headingText: 'What is this', words: 500 }), classify({ ...base, productCards: 1 }), classify(base)])).toEqual({ TOFU: 1, MOFU: 0, BOFU: 1 });
  });

  it('keeps SSAS inconclusive when benchmark or norms are unavailable', () => {
    expect(benchmark([base, base])).toBeNull();
    expect(ssas(base, [base, base, base])).toMatchObject({ status: 'inconclusive', score: null });
    expect(featureVector(base).every((value) => value === 0)).toBe(true);
    const top = [{ ...base, words: 1000, headings: 10 }, { ...base, words: 1100, headings: 11 }, { ...base, words: 900, headings: 9 }];
    expect(ssas(top[0], top).status).toBe('aligned');
  });

  it('classifies indexability evidence and detects only evidenced conflicts', () => {
    const page = (patch: Record<string, unknown> = {}) => ({ url: 'https://a.test/p', final_url: 'https://a.test/p', http_status: 200, ...patch }) as never;
    expect(hasNoindex(page({ meta_robots: 'none' }))).toBe(true);
    expect(canonicalTarget(page({ canonical: 'https://a.test/p/' }))).toBeNull();
    expect(classifyIndexability(page({ http_status: 500 }))).toBe('error-status');
    const pages = [page({ meta_robots: 'noindex' }), page({ url: 'https://a.test/x', canonical: 'https://other.test/x' })];
    expect(applyGate(pages).summary.skipped).toBe(2);
    expect(detectConflicts({ pages, pillarUrls: ['https://a.test/p'], sitemapUrls: ['https://a.test/p'], clicks: new Map([['https://a.test/p', 1]]), inlinkCounts: new Map([['https://a.test/x', 50]]) }).map((item) => item.code).sort()).toEqual(['inlinked-foreign-canonical', 'noindex-with-traffic', 'pillar-noindex', 'sitemap-noindex']);
    expect(detectConflicts({ pages, referringDomains: new Map([['https://a.test/p', 3]]) }).map((item) => item.code)).toEqual(['noindex-with-traffic']);
    expect(detectConflicts({ pages, clicks: new Map([['https://a.test/p', 0]]), referringDomains: new Map([['https://a.test/p', 0]]) })).toEqual([]);
  });
});
