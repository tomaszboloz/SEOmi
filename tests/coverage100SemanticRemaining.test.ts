import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/targetPhraseAudit/serp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/targetPhraseAudit/serp')>()),
  // The real selector guarantees normalized URLs; this simulates a malformed
  // internal result so the report's defensive URL guard stays exercised.
  selectOrganicTopTen: vi.fn(() => [{ type: 'organic', rank: 1, url: 'not a url' }]),
}));

import { canonicalTarget, classifyIndexability, hostOf } from '@/services/indexabilityGate/classify';
import { computeSprs, simulateWhatIf } from '@/services/semanticGraph/sprs';
import { buildTopTenContentGap } from '@/services/targetPhraseAudit/contentGap';
import { templateInformationGain } from '@/services/templateGovernor/informationGain';

describe('coverage100 semantic remaining edges', () => {
  it('uses valid hosts and the page URL when final_url is empty', () => {
    expect(hostOf('HTTPS://Example.test/path')).toBe('example.test');
    const page = {
      url: 'https://a.test/source',
      final_url: '',
      http_status: 200,
      canonical: 'https://b.test/target',
    } as never;
    expect(canonicalTarget(page)).toBe('https://b.test/target');
    expect(classifyIndexability(page)).toBe('canonicalized');
  });

  it('keeps equal SPRS deltas deterministic when the comparator sees reverse IDs', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const rows = simulateWhatIf(nodes, [], { add: [{ source: 'a', target: 'b' }] });
    expect(rows).toEqual([
      { nodeId: 'b', before: 100, after: 152.6, delta: 52.6 },
      { nodeId: 'a', before: 100, after: 82.5, delta: -17.5 },
      { nodeId: 'c', before: 100, after: 82.5, delta: -17.5 },
      { nodeId: 'd', before: 100, after: 82.5, delta: -17.5 },
    ]);
    expect(computeSprs(nodes, [{ source: 'a', target: 'b' }]).pages[0]).toMatchObject({ nodeId: 'b', deadEnd: true });
  });

  it('orders equal deltas by node ID when the comparator sees ascending IDs', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const rows = simulateWhatIf(nodes, [
      { source: 'a', target: 'b' }, { source: 'a', target: 'd' }, { source: 'b', target: 'a' },
    ], { add: [{ source: 'c', target: 'a' }] });
    expect(rows).toEqual([
      { nodeId: 'a', before: 100, after: 112.7, delta: 12.7 },
      { nodeId: 'c', before: 34.5, after: 26.7, delta: -7.8 },
      { nodeId: 'b', before: 77, after: 74.6, delta: -2.4 },
      { nodeId: 'd', before: 77, after: 74.6, delta: -2.4 },
    ]);
  });

  it('reports malformed selected evidence instead of treating it as page content', () => {
    const report = buildTopTenContentGap({
      phrase: 'malformed',
      rows: [{ type: 'organic', rank: 1, url: 'not a url' }],
      evidence: [{ url: 'not a url', fetchedAt: null, audit: { url: 'not a url', content_stats: { body_text: 'unsafe' } } as never }],
      now: () => '2026-10-23T00:00:00.000Z',
    });
    expect(report).toMatchObject({ status: 'unavailable', availablePages: 0, targetAvailable: false });
    expect(report.rows[0].error).toContain('does not match');
    expect(report.topics).toEqual([]);
  });

  it('keeps token accounting stable for a mixed boilerplate cluster', () => {
    const gain = templateInformationGain({ pattern: '/guide-{var}', pages: [
      { url: '/guide-a', text: 'shared alpha' },
      { url: '/guide-b', text: 'shared beta' },
    ] });
    expect(gain).toBe(0.5);
  });
});
