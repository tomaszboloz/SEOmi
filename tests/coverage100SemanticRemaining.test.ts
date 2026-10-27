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
import { governTemplates, templateInformationGain } from '@/services/templateGovernor/informationGain';

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
    expect(classifyIndexability({ url: 'https://a.test/', http_status: 100 } as never)).toBe('unknown');
    expect(classifyIndexability({ url: 'https://a.test/', http_status: 200, robots_decision: { indexability: 'other' } } as never)).toBe('unknown');
  });

  it('keeps equal SPRS deltas deterministic when the comparator sees reverse IDs', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const rows = simulateWhatIf(nodes, [], { add: [{ source: 'a', target: 'b' }] });
    expect(rows).toEqual([
      { nodeId: 'a', before: 100, after: 54.1, delta: -45.9 },
      { nodeId: 'c', before: 100, after: 54.1, delta: -45.9 },
      { nodeId: 'd', before: 100, after: 54.1, delta: -45.9 },
    ]);
    expect(computeSprs(nodes, [{ source: 'a', target: 'b' }]).pages[0]).toMatchObject({ nodeId: 'b', deadEnd: true });
    expect(simulateWhatIf(nodes, [{ source: 'a', target: 'b' }], { remove: [{ source: 'a', target: 'b' }] })).toHaveLength(3);
  });

  it('orders equal deltas by node ID when the comparator sees ascending IDs', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const rows = simulateWhatIf(nodes, [
      { source: 'a', target: 'b' }, { source: 'a', target: 'd' }, { source: 'b', target: 'a' },
    ], { add: [{ source: 'c', target: 'a' }] });
    expect(rows).toEqual([
      { nodeId: 'b', before: 77, after: 66.2, delta: -10.8 },
      { nodeId: 'c', before: 34.5, after: 23.7, delta: -10.8 },
      { nodeId: 'd', before: 77, after: 66.2, delta: -10.8 },
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

  it('keeps token accounting stable for a mixed boilerplate cluster and governs clusters', () => {
    const gain = templateInformationGain({ pattern: '/guide-{var}', pages: [
      { url: '/guide-a', text: 'shared alpha' },
      { url: '/guide-b', text: 'shared beta' },
    ] });
    expect(gain).toBe(0.5);
    expect(templateInformationGain({ pattern: '/empty', pages: [{ url: '/e', text: '' }] })).toBe(0);

    const thin = { pattern: '/thin-{var}', pages: Array.from({ length: 10 }, (_, i) => ({ url: `/t/${i}`, text: `common word ${i % 2 === 0 ? 'extra' : ''}` })) };
    const bloat = { pattern: '/bloat-{var}', pages: Array.from({ length: 50 }, (_, i) => ({ url: `/b/${i}`, text: 'same repeated text' })) };
    const healthy = { pattern: '/good-{var}', pages: Array.from({ length: 10 }, (_, i) => ({ url: `/g/${i}`, text: `worda${i} wordb${i} wordc${i} wordd${i} common` })) };
    const events = governTemplates([thin, bloat, healthy]);
    expect(events.find((e) => e.pattern === '/thin-{var}')?.verdict).toBe('thin-template');
    expect(events.find((e) => e.pattern === '/bloat-{var}')?.verdict).toBe('template-bloat');
    expect(events.find((e) => e.pattern === '/good-{var}')).toBeUndefined();
  });
});
