import { describe, expect, it } from 'vitest';
import { normalizeNode } from '@/services/topicalDocument/node';
import { normalizeTopicalMap } from '@/services/topicalDocument/normalization';
import { createTopicalNode } from '@/services/topicalMap';

const gsc = { provider: 'Google Search Console', retrievedAt: 'now', propertyUrl: 'sc-domain:site.test', startDate: '2026-01-01', endDate: '2026-01-31', clicks: 0, impressions: 1, ctr: 0, position: 1, maxRowsPerDimension: 1000 };
const ads = { provider: 'DataForSEO Google Ads Keywords for Keywords Live', retrievedAt: 'now', seedKeyword: 'coffee', countryCode: 'PL', locationCode: 2616, languageCode: 'pl' };

describe('topical node normalization', () => {
  it('rejects invalid nodes and defaults all optional collections', () => {
    for (const value of [null, 1, {}, { title: ' ' }]) expect(normalizeNode(value)).toBeNull();
    expect(normalizeNode({ title: ' Topic ' })).toMatchObject({ title: 'Topic', queries: [], facts: [], sourceUrls: [], evidenceTerms: [], relatedNodeIds: [], scheduledDate: '', parentId: null });
  });
  it('derives query provenance from real normalized sources and clears stale target IDs', () => {
    const node = normalizeNode({ id: 'a', title: 'A', parentId: '', relatedNodeIds: ['a', 'b', 'b', ' '],
      queries: [null, 1, {}, { text: ' ' }, { id: 'q', text: 'coffee', source: gsc }, { text: 'beans', source: ads }, { text: 'guide', provenance: 'gsc' }],
      facts: [null, { attribute: 'a', value: 'b' }], sourceUrls: ['invalid', 'https://site.test', 'https://site.test/'],
      evidenceTerms: ['Coffee', ' coffee ', ' '], scheduledDate: '2026-01-01', contentBrief: { targetQueryId: 'q' }, sourceRunId: 'run', sourceClusterId: 'cluster' })!;
    expect(node.queries.map((query) => query.provenance)).toEqual(['gsc', 'dataforseo', 'asserted']);
    expect(node.contentBrief.targetQueryId).toBe('q');
    expect(node.relatedNodeIds).toEqual(['b']);
    expect(node.facts).toHaveLength(1);
    expect(node.sourceUrls).toEqual(['https://site.test/']);
    expect(node.evidenceTerms).toEqual(['coffee']);
    expect(node).toMatchObject({ parentId: null, scheduledDate: '2026-01-01', sourceRunId: 'run', sourceClusterId: 'cluster' });
  });
  it('bounds inventories and retains only selected enum values', () => {
    const node = normalizeNode({ title: 'A', kind: 'pillar', boundary: 'outer', intent: 'mixed', lifecycle: 'published', parentId: ' b ',
      queries: Array.from({ length: 101 }, (_, i) => ({ text: `q${i}` })), facts: Array.from({ length: 301 }, () => ({ attribute: 'a', value: 'b' })),
      sourceUrls: Array.from({ length: 1001 }, (_, i) => `https://site.test/${i}`), evidenceTerms: Array.from({ length: 81 }, (_, i) => `t${i}`) })!;
    expect(node).toMatchObject({ kind: 'pillar', boundary: 'outer', intent: 'mixed', lifecycle: 'published', parentId: 'b' });
    expect([node.queries.length, node.facts.length, node.sourceUrls.length, node.evidenceTerms.length]).toEqual([100, 300, 1000, 80]);
  });
  it('returns empty documents for missing input and breaks persisted cycles deterministically', () => {
    for (const value of [null, 1, {}]) expect(normalizeTopicalMap(value)).toMatchObject({ nodes: [], entity: { facts: [] } });
    const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ ...createTopicalNode(id), id }));
    nodes[0].parentId = 'b'; nodes[1].parentId = 'a'; nodes[2].parentId = 'missing'; nodes[3].parentId = 'd';
    nodes[0].relatedNodeIds = ['b', 'missing'];
    const result = normalizeTopicalMap({ updatedAt: 'now', entity: { name: ' Entity ', description: ' desc ', facts: [null, { attribute: 'a', value: 'b' }] }, nodes: [null, ...nodes] });
    expect(result.nodes.map((node) => node.parentId)).toEqual([null, 'a', null, null]);
    expect(result.nodes[0].relatedNodeIds).toEqual(['b']);
    expect(result.entity).toMatchObject({ name: 'Entity', description: 'desc' });
    expect(result.entity.facts).toHaveLength(1);
    expect(result.updatedAt).toBe('now');
  });
});
