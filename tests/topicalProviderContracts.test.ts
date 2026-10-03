import { describe, expect, it } from 'vitest';
import { createEmptyTopicalMap, createTopicalNode, importTopicalQueries, normalizeTopicalMap } from '@/services/topicalMap';

describe('topical provider snapshots', () => {
it('imports DataForSEO query snapshots with market and source metrics, idempotently', () => {
    const node = createTopicalNode('Coffee');
    const document = { ...createEmptyTopicalMap(), nodes: [node] };
    const source = {
      provider: 'DataForSEO Google Ads Keywords for Keywords Live' as const,
      retrievedAt: '2026-09-23T10:00:00.000Z', seedKeyword: 'coffee', countryCode: 'PL', locationCode: 2616, languageCode: 'pl',
      searchVolume: 0, cpc: null, competitionIndex: 42, searchIntent: 'informational',
      monthlySearches: [{ year: 2026, month: 8, searchVolume: null }],
    };
    const first = importTopicalQueries(document, node.id, [{ text: 'coffee guide', source }]);
    const second = importTopicalQueries(first.document, node.id, [{ text: 'coffee guide', source }]);
    const importedQuery = normalizeTopicalMap(first.document).nodes[0].queries[0];

    expect(first).toMatchObject({ addedCount: 1, duplicateCount: 0, limitReached: false });
    expect(second).toMatchObject({ addedCount: 0, duplicateCount: 1 });
    expect(importedQuery).toMatchObject({ provenance: 'dataforseo', source: { ...source } });
  });

it('imports GSC observations with date window and truncation disclosure', () => {
    const node = createTopicalNode('Coffee');
    const document = { ...createEmptyTopicalMap(), nodes: [node] };
    const result = importTopicalQueries(document, node.id, [{ text: 'coffee beans', source: {
      provider: 'Google Search Console', retrievedAt: '2026-09-23T10:00:00.000Z', propertyUrl: 'sc-domain:example.com',
      startDate: '2026-08-01', endDate: '2026-08-31', clicks: 12, impressions: 140, ctr: 12 / 140,
      position: 4.8, queryRowsMayBeTruncated: true, maxRowsPerDimension: 1000,
    } }]);
    const query = result.document.nodes[0].queries[0];

    expect(query.provenance).toBe('gsc');
    expect(query.source).toMatchObject({ provider: 'Google Search Console', propertyUrl: 'sc-domain:example.com', startDate: '2026-08-01', endDate: '2026-08-31', queryRowsMayBeTruncated: true, clicks: 12, impressions: 140 });
  });

it('keeps same-text evidence from both providers and refreshes the matching source snapshot', () => {
    const node = createTopicalNode('Coffee');
    const document = { ...createEmptyTopicalMap(), nodes: [node] };
    const dataForSeo = {
      provider: 'DataForSEO Google Ads Keywords for Keywords Live' as const,
      retrievedAt: '2026-09-23T10:00:00.000Z', seedKeyword: 'coffee', countryCode: 'PL', locationCode: 2616, languageCode: 'pl',
      searchVolume: 100, cpc: 1, competitionIndex: 20, searchIntent: null, monthlySearches: [],
    };
    const gsc = {
      provider: 'Google Search Console' as const, retrievedAt: '2026-09-23T11:00:00.000Z', propertyUrl: 'sc-domain:example.com',
      startDate: '2026-08-01', endDate: '2026-08-31', clicks: 1, impressions: 10, ctr: 0.1, position: 3,
      queryRowsMayBeTruncated: false, maxRowsPerDimension: 1000,
    };
    const first = importTopicalQueries(document, node.id, [{ text: 'coffee', source: dataForSeo }]);
    const second = importTopicalQueries(first.document, node.id, [{ text: 'coffee', source: gsc }]);
    const refreshed = importTopicalQueries(second.document, node.id, [{ text: 'coffee', source: { ...dataForSeo, retrievedAt: '2026-09-24T10:00:00.000Z', searchVolume: 120 } }]);

    expect(second.addedCount).toBe(1);
    expect(second.document.nodes[0].queries.map((query) => query.provenance)).toEqual(['dataforseo', 'gsc']);
    expect(refreshed.addedCount).toBe(0);
    expect(refreshed.updatedCount).toBe(1);
    expect(refreshed.document.nodes[0].queries).toHaveLength(2);
    expect(refreshed.document.nodes[0].queries[0].source).toMatchObject({ retrievedAt: '2026-09-24T10:00:00.000Z', searchVolume: 120 });
  });

});
