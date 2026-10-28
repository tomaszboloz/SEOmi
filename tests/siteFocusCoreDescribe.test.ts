import { describe, expect, it } from 'vitest';
import { chooseCore, describeClusters, describeCore, labelOf } from '@/services/siteFocus/coreTopic';
import { computeFlags } from '@/services/siteFocus/flags';
import type { Prepared } from '@/services/siteFocus/evaluate';

const surfaces = new Map([['insulin', 'Insulin'], ['glucose', 'Glucose']]);
const clusters = [
  { id: 'c1', keys: ['insulin', 'glucose', 'diet', 'sugar'], weight: 30 },
  { id: 'c2', keys: ['car', 'engine'], weight: 10 },
];
const totals = new Map([['insulin', 12.34], ['glucose', 10], ['diet', 5], ['sugar', 2.66], ['car', 6], ['engine', 4]]);

describe('labelOf', () => {
  it('joins at most three terms using surface forms with key fallback', () => {
    expect(labelOf(['insulin', 'glucose', 'diet', 'sugar'], surfaces)).toBe('Insulin, Glucose, diet');
    expect(labelOf([], surfaces)).toBe('');
  });
});

describe('describeCore', () => {
  it('rounds coverage and weight to one decimal and caps shown terms at 15', () => {
    const keys = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const weights = new Map(keys.map((key) => [key, 1.26]));
    const core = describeCore({ clusters: [], core: { id: 'c1', keys, weight: 1 }, confidence: 50, weights, kCore: keys, mode: 'auto' }, surfaces, new Map([['t0', 1]]), 3);
    expect(core.terms).toHaveLength(15);
    expect(core.terms[0]).toEqual({ term: 't0', coveragePct: 33.3, weight: 1.3 });
    expect(core.terms[1].coveragePct).toBe(0);
    expect(core.label).toBe('t0, t1, t2');
    expect(core.manualOverride).toBeUndefined();
  });

  it('uses the manual input as label and exposes the override; zero pages cannot divide by zero', () => {
    const selection = chooseCore(clusters, totals, 'Insulin', 'en');
    const core = describeCore(selection, surfaces, new Map([['insulin', 2]]), 0);
    expect(core.label).toBe('Insulin');
    expect(core.manualOverride).toEqual({ input: 'Insulin', matched: true });
    expect(core.terms[0].coveragePct).toBe(200);
  });
});

describe('chooseCore', () => {
  it('picks the heaviest cluster and reports its share as confidence', () => {
    const selection = chooseCore(clusters, totals, undefined, 'en');
    expect(selection.core.id).toBe('c1');
    expect(selection.confidence).toBe(75);
    expect(selection.manual).toBeUndefined();
  });

  it('falls back to a synthetic manual cluster when the topic matches nothing', () => {
    const selection = chooseCore(clusters, totals, 'quantum', 'en');
    expect(selection.core.id).toBe('manual');
    expect(selection.manual).toEqual({ input: 'quantum', matched: false });
    expect(selection.clusters).toHaveLength(3);
    expect(selection.confidence).toBe(0);
  });

  it('survives an empty cluster list', () => {
    const selection = chooseCore([], new Map(), undefined, 'en');
    expect(selection.core.keys).toEqual([]);
    expect(selection.confidence).toBe(0);
  });
});

describe('describeClusters', () => {
  it('computes share of total weight and labels clusters', () => {
    const described = describeClusters(clusters, surfaces, totals);
    expect(described.map((c) => c.sharePct)).toEqual([75, 25]);
    expect(described[0].label).toBe('Insulin, Glucose, diet');
    expect(described[0].terms[0]).toEqual({ term: 'Insulin', weight: 12.3 });
  });

  it('reports zero share when every cluster is weightless', () => {
    const described = describeClusters([{ id: 'z', keys: ['x'], weight: 0 }], surfaces, new Map());
    expect(described[0]).toMatchObject({ sharePct: 0, weight: 0, terms: [{ term: 'x', weight: 0 }] });
  });
});

describe('computeFlags', () => {
  const item = (skipped?: string, degraded = false) => ({ skipped, terms: { degraded } }) as unknown as Prepared;
  const many = (count: number) => Array.from({ length: count }, () => item());

  it('flags low confidence for fewer than 10 live pages', () => {
    expect(computeFlags(many(9), 90, false, 'none' as never, false).isLowConfidence).toBe(true);
    expect(computeFlags(many(10), 90, false, 'none' as never, false).isLowConfidence).toBe(false);
  });

  it('flags low confidence below 20 percent unless the topic is manual', () => {
    expect(computeFlags(many(10), 19, false, 'none' as never, false).isLowConfidence).toBe(true);
    expect(computeFlags(many(10), 19, true, 'none' as never, false).isLowConfidence).toBe(false);
  });

  it('counts render timeouts, ignores skipped items for degradation and passes through mode and multi-topic', () => {
    const items = [...many(10), item('render-timeout', true), item('render-timeout')];
    const flags = computeFlags(items, 50, false, 'manual' as never, true);
    expect(flags).toMatchObject({ skippedRenderTimeouts: 2, degraded: false, isMultiTopic: true, fallbackMode: 'manual' });
    expect(computeFlags([...many(10), item(undefined, true)], 50, false, 'none' as never, false).degraded).toBe(true);
  });
});
