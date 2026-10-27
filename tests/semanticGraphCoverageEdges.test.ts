import { describe, expect, it } from 'vitest';
import type { GscPerformanceData } from '@/types';
import { buildTrafficEvidence } from '@/services/semanticGraph/trafficEvidence';
import { normalizeTrafficProperty, trafficPropertyMatchesUrl } from '@/services/semanticGraph/trafficEvidenceNormalization';

const data = (pages_may_be_truncated = false): GscPerformanceData => ({
  site_url: 'sc-domain:example.test', start_date: '2026-10-01', end_date: '2026-10-31',
  total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0, queries: [], pages: [], daily: [],
  queries_may_be_truncated: false, pages_may_be_truncated, daily_may_be_truncated: false, max_rows_per_dimension: 10,
});

const request = (nodes: { id: string; url: string }[], pages_may_be_truncated = false) => ({
  projectId: 'coverage-project', property: 'sc-domain:example.test', startDate: '2026-10-01', endDate: '2026-10-31',
  filters: {}, nodes, gscData: data(pages_may_be_truncated),
});

const restoreProperty = (target: object, key: string, descriptor: PropertyDescriptor) => Object.defineProperty(target, key, descriptor);

describe('semantic graph evidence branch coverage', () => {
  it('sorts nodes through the less-than comparator path', () => {
    const result = buildTrafficEvidence(request([
      { id: 'node-b', url: 'https://example.test/b' },
      { id: 'node-a', url: 'https://example.test/a' },
    ]));
    expect(result.nodes.map((node) => node.nodeId)).toEqual(['node-a', 'node-b']);
  });

  it('executes the defensive equality comparator path in result sorting', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'sort')!;
    const original = Array.prototype.sort;
    let injected = false;
    Object.defineProperty(Array.prototype, 'sort', {
      ...descriptor,
      value: function (this: unknown[], compare?: (left: unknown, right: unknown) => number) {
        if (!injected && compare && this.length) { injected = true; compare(this[0], this[0]); }
        return Reflect.apply(original, this, [compare]) as unknown[];
      },
    });
    try { expect(buildTrafficEvidence(request([{ id: 'node-a', url: 'https://example.test/a' }])).status).toBe('complete'); }
    finally { restoreProperty(Array.prototype, 'sort', descriptor); }
  });

  it('handles a missing alias map entry as truncated evidence', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Map.prototype, 'get')!;
    const original = Map.prototype.get;
    let calls = 0;
    Object.defineProperty(Map.prototype, 'get', {
      ...descriptor,
      value: function (this: Map<unknown, unknown>, key: unknown) {
        calls += 1;
        if (calls === 2) return undefined;
        return Reflect.apply(original, this, [key]);
      },
    });
    try {
      const result = buildTrafficEvidence(request([{ id: 'node-a', url: 'https://example.test/a' }], true));
      expect(result.nodes[0].observation).toBe('truncated');
    } finally { restoreProperty(Map.prototype, 'get', descriptor); }
  });

  it('handles a missing alias map entry as an ordinary missing page', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Map.prototype, 'get')!;
    const original = Map.prototype.get;
    let calls = 0;
    Object.defineProperty(Map.prototype, 'get', {
      ...descriptor,
      value: function (this: Map<unknown, unknown>, key: unknown) {
        calls += 1;
        if (calls === 2) return undefined;
        return Reflect.apply(original, this, [key]);
      },
    });
    try {
      const result = buildTrafficEvidence(request([{ id: 'node-a', url: 'https://example.test/a' }]));
      expect(result.nodes[0].observation).toBe('missing');
    } finally { restoreProperty(Map.prototype, 'get', descriptor); }
  });

  it('covers URL pathname fallback for a URL implementation with an empty pathname', () => {
    const NativeURL = URL;
    class EmptyPathURL extends NativeURL { get pathname() { return ''; } }
    const scope = normalizeTrafficProperty('https://example.test/')!;
    const previous = globalThis.URL;
    globalThis.URL = EmptyPathURL;
    try { expect(trafficPropertyMatchesUrl(scope, 'https://example.test/')).toBe(true); }
    finally { globalThis.URL = previous; }
  });
});
