import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateDecay } from '@/services/semanticDecay/alert';
import { compareSnapshots } from '@/services/semanticDecay/compare';
import {
  buildReferenceSnapshot, lexicalCentroid, recordReferenceSnapshot, REFERENCE_DECAY_MODEL,
} from '@/services/semanticDecay/recordReferenceSnapshot';
import { loadSerpHistory } from '@/services/semanticDecay/snapshotStore';
import type { ReferenceTaxonomy } from '@/services/topicalAuthority';
import type { ReferenceSerpObservation } from '@/services/topicalAuthorityReference/types';

const MARKET = { country: 'PL', language: 'pl' };
const taxonomy = (builtAt: string, terms: Record<string, number>, entities: string[]): ReferenceTaxonomy => ({
  version: 1, coreLabel: 'insulina', language: 'pl', builtAt, source: 'dataforseo', competitors: ['a.test'], suggestionCount: 0,
  pillars: [{ id: 'p1', label: 'P1', importance: 1 }],
  subtopics: [{ id: 's1', pillar: 'p1', label: 'S1', keys: ['s1'], importance: 1, entities, questions: [] }],
  commonTerms: terms,
});
const serp = (urls: string[], source = 'dataforseo', query = 'insulina'): ReferenceSerpObservation[] =>
  [{ query, source, hits: urls.map((url, index) => ({ url, rank: index + 1, domain: '' })) }];
const URLS = ['https://a.test/1', 'https://b.test/2', 'https://c.test/3'];

beforeEach(() => localStorage.clear());

describe('reference run as a Decay Radar producer', () => {
  it('skips partial or empty SERP evidence and labels the lexical model', () => {
    const base = taxonomy('2026-01-01T00:00:00.000Z', { dawka: 0.5 }, ['Insulina']);
    expect(buildReferenceSnapshot(base, serp(URLS, 'bing-rss'), MARKET)).toBeNull();
    expect(buildReferenceSnapshot(base, serp([]), MARKET)).toBeNull();
    expect(buildReferenceSnapshot(base, [{ query: 'x', source: 'dataforseo', hits: [{ url: 'https://a.test/', rank: 0, domain: '' }] }], MARKET)).toBeNull();
    expect(recordReferenceSnapshot('p', base, undefined, MARKET)).toBe(false);
    const snapshot = buildReferenceSnapshot(base, [...serp(URLS), ...serp(['https://b.test/2'], 'dataforseo', 'insulina cena')], MARKET);
    expect(snapshot).toMatchObject({ model: REFERENCE_DECAY_MODEL, query: 'insulina', country: 'PL', dominantIntent: null, dominantFormat: null, consensusEntities: ['Insulina'] });
    expect(snapshot?.docs).toEqual([{ url: 'https://a.test/1', rank: 1 }, { url: 'https://b.test/2', rank: 1 }, { url: 'https://c.test/3', rank: 3 }]);
    expect(lexicalCentroid({})).toBeNull();
    expect(lexicalCentroid({ a: Number.NaN, b: 0 })).toBeNull();
  });

  it('treats a reordered TOP K with the same content as stable', () => {
    const terms = { dawka: 0.5, pen: 0.3 };
    recordReferenceSnapshot('p', taxonomy('2026-01-01T00:00:00.000Z', terms, ['Insulina']), serp(URLS), MARKET);
    recordReferenceSnapshot('p', taxonomy('2026-02-01T00:00:00.000Z', terms, ['Insulina']), serp([...URLS].reverse()), MARKET);
    expect(recordReferenceSnapshot('p', taxonomy('2026-03-01T00:00:00.000Z', terms, ['Insulina']), serp(URLS), MARKET)).toBe(true);
    const history = loadSerpHistory('p');
    expect(history.snapshots).toHaveLength(3);
    expect(evaluateDecay(history.snapshots, null, '2026-03-02T00:00:00.000Z').verdict).toBe('stable');
  });

  it('alerts on a persistent change of centroid and entities, and gates a different query set', () => {
    recordReferenceSnapshot('p', taxonomy('2026-01-01T00:00:00.000Z', { dawka: 0.5 }, ['Insulina']), serp(URLS), MARKET);
    const drift = { glukometr: 0.9, sensor: 0.8 };
    const entities = ['CGM', 'Libre', 'Dexcom', 'Insulina'];
    recordReferenceSnapshot('p', taxonomy('2026-02-01T00:00:00.000Z', drift, entities), serp(URLS), MARKET);
    recordReferenceSnapshot('p', taxonomy('2026-03-01T00:00:00.000Z', drift, entities), serp(URLS), MARKET);
    const history = loadSerpHistory('p');
    const result = evaluateDecay(history.snapshots, null, '2026-03-02T00:00:00.000Z');
    expect(result.verdict).toBe('alert');
    expect(result.reasons).toEqual(['centroid', 'entities']);
    expect(result.comparison?.newEntities).toEqual(['CGM', 'Dexcom', 'Libre']);
    const other = buildReferenceSnapshot(taxonomy('2026-04-01T00:00:00.000Z', drift, entities), serp(URLS, 'dataforseo', 'insulina cena'), MARKET);
    expect(compareSnapshots(history.snapshots[0], other!).incompatible).toEqual(['profile']);
  });
});
