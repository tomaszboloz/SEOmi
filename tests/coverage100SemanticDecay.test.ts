import { describe, expect, it } from 'vitest';
import { normalize } from '@/services/embeddings/vector';
import { evaluateDecay, materialReasons } from '@/services/semanticDecay/alert';
import { compareSnapshots } from '@/services/semanticDecay/compare';
import { incompatibilities } from '@/services/semanticDecay/gate';
import type { DecayComparison, SerpSnapshot } from '@/services/semanticDecay/types';

const snap = (id: string, patch: Partial<SerpSnapshot> = {}): SerpSnapshot => ({ id, takenAt: '2026-01-01', query: 'seo', country: 'PL', language: 'pl', provider: 'dfs', model: 'm', profile: 'p', k: 10, centroid: normalize([1, 0]), consensusEntities: ['A', 'B'], dominantIntent: 'info', dominantFormat: 'guide', docs: [{ url: 'https://a.test/', rank: 1 }], ...patch });

describe('coverage100 semantic decay gates', () => {
  it('normalizes compatibility fields and reports each changed identity', () => {
    expect(incompatibilities(snap('a'), snap('b', { query: ' SEO ', country: 'DE', language: 'en', provider: 'x', model: 'x', profile: 'q', k: 5 }))).toEqual(['country', 'language', 'provider', 'model', 'profile', 'k']);
    expect(compareSnapshots(snap('a'), snap('b', { centroid: null })).status).toBe('unavailable');
    expect(compareSnapshots(snap('a', { docs: [] }), snap('b')).status).toBe('unavailable');
  });

  it('deduplicates entities and URL changes while preserving display values', () => {
    const comparison = compareSnapshots(snap('a', { consensusEntities: ['Foo', 'bar'] }), snap('b', { consensusEntities: ['foo', 'Baz'], docs: [{ url: 'https://b.test/', rank: 1 }], dominantIntent: 'buy', dominantFormat: 'tool', centroid: normalize([0, 1]) }));
    expect(comparison.newEntities).toEqual(['Baz']);
    expect(comparison.lostEntities).toEqual(['bar']);
    expect(comparison.intentChange).toEqual({ from: 'info', to: 'buy' });
    expect(comparison.formatChange).toEqual({ from: 'guide', to: 'tool' });
    expect(comparison.addedUrls).toEqual(['https://b.test/']);
    expect(comparison.removedUrls).toEqual(['https://a.test/']);
  });

  it('only marks material comparison reasons and handles empty components', () => {
    const stable: DecayComparison = { status: 'ready', incompatible: [], centroidShift: null, newEntities: [], lostEntities: [], intentChange: null, formatChange: null, addedUrls: [], removedUrls: [] };
    expect(materialReasons(stable)).toEqual([]);
    expect(materialReasons({ ...stable, centroidShift: 0.1, newEntities: ['a', 'b'], lostEntities: ['c'], intentChange: { from: 'x', to: 'y' }, formatChange: { from: 'a', to: 'b' } })).toEqual(['centroid', 'entities', 'intent', 'format']);
  });

  it('requires persistent compatible evidence and observes cooldowns', () => {
    const stable = [snap('a'), snap('b'), snap('c')];
    expect(evaluateDecay(stable.slice(0, 2), null, '2026-02-01').verdict).toBe('too-few-samples');
    expect(evaluateDecay(stable, null, '2026-02-01').verdict).toBe('stable');
    const drift = (id: string) => snap(id, { centroid: normalize([0, 1]), consensusEntities: ['C', 'D', 'E'], dominantIntent: 'buy' });
    expect(evaluateDecay([stable[0], stable[1], drift('c')], null, '2026-02-01').verdict).toBe('not-persistent');
    const persistent = evaluateDecay([stable[0], drift('b'), drift('c')], '2026-01-31', '2026-02-01');
    expect(persistent.verdict).toBe('cooldown');
    expect(persistent.dedupeKey).toContain('seo|PL');
    expect(evaluateDecay([stable[0], snap('b', { model: 'x' }), snap('c')], null, '2026-02-01').verdict).toBe('incompatible');
  });
});
