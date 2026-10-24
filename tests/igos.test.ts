import { describe, expect, it } from 'vitest';
import { normalize } from '@/services/embeddings/vector';
import { buildBaseline, documentFrequency } from '@/services/igos/baseline';
import { baseCoverage, edsi, fhem, nefr, novelEntities, penalty, sdd } from '@/services/igos/components';
import { buildHeatmap, evidenceAdvice, recommend } from '@/services/igos/heatmap';
import { buildIgosReport } from '@/services/igos/report';
import type { CompetitorDoc, TargetDoc } from '@/services/igos/types';
import { zoneChunks, zoneOf } from '@/services/igos/zones';

const v = (...x: number[]) => normalize(x);
const doc = (rank: number, entities: string[], vec = v(1, 0), status: number | null = 200): CompetitorDoc => ({
  url: `https://c${rank}.test/`, rank, fetchedAt: null, status, entities,
  passages: [{ text: 'p', vector: vec }], terms: new Map([['a', 2], ['b', 1]]),
});
const target = (vec = v(1, 0), entities: string[] = ['x'], text = 'plain'): TargetDoc => ({
  url: 'https://t.test/', entities, wordCount: 100, terms: new Map([['a', 1], ['z', 3]]),
  chunks: [{ text, offset: 0, heading: 'H', vector: vec }, { text: 'two', offset: 9, heading: 'H', vector: vec }, { text: 'three', offset: 20, heading: null, vector: vec }],
});

describe('igos zones boundaries', () => {
  it.each([
    [0.9, 0.82, 'echo'], [0.9, 0.81, 'gain'], [0.48, 0.5, 'gain'], [0.47, 0.6, 'neutral'],
    [0.47, 0.59, 'drift'], [0.1, 0.9, 'echo'],
  ])('topic %s nearest %s => %s', (topic, nearest, zone) => expect(zoneOf(topic, nearest)).toBe(zone));
});

describe('igos baseline', () => {
  it('is unavailable with no docs and partial with few', () => {
    expect(buildBaseline([], 10).status).toBe('unavailable');
    expect(buildBaseline([doc(1, []), doc(2, [], v(1, 0), 500)], 10).availableDocs).toBe(1);
    const partial = buildBaseline([doc(1, ['A', 'a']), doc(2, ['A']), doc(3, [])], 10);
    expect(partial.status).toBe('partial');
    expect(partial.limitations).toContain('some-documents-missing');
  });
  it('splits consensus and rare entities by DF, counting aliases once', () => {
    const docs = [doc(1, ['Foo', 'foo ']), doc(2, ['Foo']), doc(3, ['']), doc(4, []), doc(5, ['Rare'])];
    expect(documentFrequency(docs).get('foo')?.df).toBe(2);
    const b = buildBaseline(docs, 5);
    expect(b.status).toBe('ready');
    expect(b.consensusEntities).toEqual(['foo']);
    expect(b.rareEntities).toEqual(['Rare']);
    expect(b.centroid).not.toBeNull();
    expect(b.terms.get('a')).toBe(10);
  });
});

describe('igos components', () => {
  it('computes NEFR, EDSI, FHEM, SDD, coverage', () => {
    expect(nefr(10, 0)).toBe(1);
    expect(nefr(2, 0)).toBeCloseTo(0.4);
    expect(edsi('see 10.1000/abc and PMID: 123456', 1000)).toBeCloseTo(2 / 3);
    expect(fhem('We tested it. Przetestowaliśmy. In our study')).toBe(1);
    expect(fhem('nothing')).toBe(0);
    expect(sdd(new Map(), new Map())).toBe(0);
    expect(sdd(new Map([['a', 1]]), new Map([['a', 1]]))).toBeCloseTo(0);
    expect(sdd(new Map([['a', 1]]), new Map([['b', 1]]))).toBeGreaterThan(0.9);
    const base = buildBaseline([doc(1, ['A', 'B']), doc(2, ['A', 'B']), doc(3, ['A', 'B'])], 3);
    expect(novelEntities(['A', 'N', 'n', ''], base)).toEqual(['n']);
    expect(baseCoverage(target(v(1, 0), ['A']), base)).toBe(0.5);
    expect(baseCoverage(target(), buildBaseline([doc(1, [])], 1))).toBe(1);
    expect(penalty(0)).toBe(0.5);
    expect(penalty(0.9)).toBe(1);
  });
});

describe('igos report and heatmap', () => {
  const docs = [doc(1, ['A']), doc(2, ['A']), doc(3, ['A'])];
  const base = buildBaseline(docs, 3);
  it('returns null score without a baseline or chunks', () => {
    expect(buildIgosReport(target(), [], buildBaseline([], 3)).igos).toBeNull();
    const none = { ...target(), chunks: [] };
    expect(buildIgosReport(none, docs, base).limitations).toContain('no-target-chunks');
    expect(zoneChunks(target().chunks, buildBaseline([], 1), [])).toEqual([]);
  });
  it('flags off-topic pages without a score', () => {
    const r = buildIgosReport(target(v(0, 1)), docs, base);
    expect(r.status).toBe('off-topic');
    expect(r.igos).toBeNull();
    expect(r.zones[0].zone).toBe('drift');
  });
  it('scores on-topic pages and builds heatmap advice', () => {
    const r = buildIgosReport(target(v(1, 0), ['A', 'N1']), docs, base);
    expect(r.igos).toBeGreaterThanOrEqual(0);
    expect(r.zones[0].zone).toBe('echo');
    const map = buildHeatmap(r);
    expect(map.map((s) => s.heading)).toEqual(['H', null]);
    expect(recommend(map)[0].kind).toBe('rewrite-echo');
    expect(evidenceAdvice(r)[0].kind).toBe('add-evidence');
    expect(evidenceAdvice({ ...r, components: null })).toEqual([]);
    const drift = buildHeatmap(buildIgosReport(target(v(0, 1)), docs, base));
    expect(recommend(drift)[0].kind).toBe('refocus-drift');
    expect(recommend(buildHeatmap({ ...r, zones: r.zones.map((z) => ({ ...z, zone: 'gain' as const })) }))).toEqual([]);
  });
});
