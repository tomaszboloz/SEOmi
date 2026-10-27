import { describe, expect, it } from 'vitest';
import { normalize } from '@/services/embeddings/vector';
import { evaluateDecay, materialReasons } from '@/services/semanticDecay/alert';
import { compareSnapshots } from '@/services/semanticDecay/compare';
import type { SerpSnapshot } from '@/services/semanticDecay/types';

const snap = (id: string, over: Partial<SerpSnapshot> = {}): SerpSnapshot => ({
  id, takenAt: '2026-01-01', query: 'seo', country: 'PL', language: 'pl', provider: 'dfs', model: 'm', profile: 'p', k: 10,
  centroid: normalize([1, 0]), consensusEntities: ['A', 'B'], dominantIntent: 'info', dominantFormat: 'guide',
  docs: [{ url: 'u1', rank: 1 }], ...over,
});
const drifted = (id: string) => snap(id, { centroid: normalize([0, 1]), consensusEntities: ['C', 'D', 'E'], docs: [{ url: 'u2', rank: 1 }] });

describe('semantic decay', () => {
  it('flags incompatible and unavailable comparisons', () => {
    const c = compareSnapshots(snap('a'), snap('b', { model: 'x', k: 5, query: ' SEO ' }));
    expect(c.status).toBe('incompatible');
    expect(c.incompatible).toEqual(['model', 'k']);
    expect(compareSnapshots(snap('a'), snap('b', { centroid: null })).status).toBe('unavailable');
    expect(compareSnapshots(snap('a'), snap('b', { docs: [] })).status).toBe('unavailable');
  });
  it('measures shift, entities, intent, format and urls', () => {
    const c = compareSnapshots(snap('a'), snap('b', { ...drifted('b'), dominantIntent: 'buy', dominantFormat: null }));
    expect(c.centroidShift).toBeCloseTo(1);
    expect(c.newEntities).toEqual(['C', 'D', 'E']);
    expect(c.lostEntities).toEqual(['A', 'B']);
    expect(c.intentChange).toEqual({ from: 'info', to: 'buy' });
    expect(c.formatChange).toBeNull();
    expect(c.addedUrls).toEqual(['u2']);
    expect(c.removedUrls).toEqual(['u1']);
    expect(materialReasons(c)).toEqual(['centroid', 'entities', 'intent']);
    expect(materialReasons(compareSnapshots(snap('a'), snap('b', { dominantFormat: 'tool' })))).toEqual(['format']);
  });
  it('needs enough samples and persistence, then alerts once per cooldown', () => {
    expect(evaluateDecay([snap('a'), snap('b')], null, '2026-02-01').verdict).toBe('too-few-samples');
    expect(evaluateDecay([snap('a'), snap('b'), snap('c')], null, '2026-02-01').verdict).toBe('stable');
    expect(evaluateDecay([snap('a'), snap('b'), drifted('c')], null, '2026-02-01').verdict).toBe('not-persistent');
    const h = [snap('a'), drifted('b'), drifted('c')];
    const first = evaluateDecay(h, null, '2026-02-01');
    expect(first.verdict).toBe('alert');
    expect(first.dedupeKey).toContain('seo|PL');
    expect(evaluateDecay(h, '2026-01-30', '2026-02-01').verdict).toBe('cooldown');
    expect(evaluateDecay(h, '2026-01-01', '2026-02-01').verdict).toBe('alert');
  });
  it('does not call model changes market drift', () => {
    const h = [snap('a'), snap('b'), snap('c', { model: 'other' })];
    expect(evaluateDecay(h, null, '2026-02-01').verdict).toBe('incompatible');
    expect(evaluateDecay([snap('a'), snap('b', { centroid: null }), snap('c', { centroid: null })], null, '2026-02-01').verdict).toBe('too-few-samples');
  });
});
