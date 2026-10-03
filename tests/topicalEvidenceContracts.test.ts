import { describe, expect, it } from 'vitest';
import { normalizeMetric, normalizeQueryEvidence } from '@/services/topicalDocument/evidence';
import { queryKey, queryEvidenceKey, importTopicalQueries } from '@/services/topicalDocument/queries';
import { createEmptyTopicalMap, createTopicalNode } from '@/services/topicalMap';
import type { GscTopicalEvidence, DataForSeoTopicalEvidence } from '@/services/topicalMap';

const gsc: GscTopicalEvidence = {
  provider: 'Google Search Console', retrievedAt: '2026-10-01', propertyUrl: 'https://site.test/Shop/',
  startDate: '2026-09-01', endDate: '2026-09-30', clicks: 0, impressions: 0, ctr: 0, position: 0,
  queryRowsMayBeTruncated: false, maxRowsPerDimension: 1000,
};
const ads: DataForSeoTopicalEvidence = {
  provider: 'DataForSEO Google Ads Keywords for Keywords Live', retrievedAt: '2026-10-01', seedKeyword: 'coffee',
  countryCode: 'PL', locationCode: 2616, languageCode: 'pl', searchVolume: 0, cpc: null,
  competitionIndex: null, searchIntent: null, monthlySearches: [],
};

describe('topical source contracts', () => {
  it('preserves measured zero and rejects non-finite or unavailable metrics', () => {
    expect(normalizeMetric(0)).toBe(0);
    expect(normalizeMetric(1.2)).toBe(1.2);
    for (const value of [null, undefined, '0', NaN, Infinity]) expect(normalizeMetric(value)).toBeNull();
  });
  it('rejects unknown providers and incomplete required source fields', () => {
    for (const value of [null, 1, {}, { provider: 'invented' }]) expect(normalizeQueryEvidence(value)).toBeUndefined();
    for (const key of ['retrievedAt', 'propertyUrl', 'startDate', 'endDate', 'clicks', 'impressions', 'ctr', 'position', 'maxRowsPerDimension']) {
      expect(normalizeQueryEvidence({ ...gsc, [key]: null }), key).toBeUndefined();
    }
    for (const key of ['retrievedAt', 'locationCode', 'seedKeyword', 'countryCode', 'languageCode']) {
      expect(normalizeQueryEvidence({ ...ads, [key]: null }), key).toBeUndefined();
    }
  });
  it('preserves valid observations and bounds optional monthly evidence', () => {
    expect(normalizeQueryEvidence(gsc)).toEqual(gsc);
    expect(normalizeQueryEvidence({ ...gsc, queryRowsMayBeTruncated: true })).toMatchObject({ queryRowsMayBeTruncated: true });
    expect(normalizeQueryEvidence({ ...ads, monthlySearches: null })).toEqual(ads);
    expect(normalizeQueryEvidence({ ...ads, searchIntent: ' commercial ', monthlySearches: [null, 1, {}, { year: 2026, month: 9, searchVolume: 0 }] }))
      .toMatchObject({ searchIntent: 'commercial', monthlySearches: [{ year: null, month: null, searchVolume: null }, { year: 2026, month: 9, searchVolume: 0 }] });
    const result = normalizeQueryEvidence({ ...ads, monthlySearches: Array.from({ length: 121 }, () => ({ year: 2026 })) });
    expect((result as DataForSeoTopicalEvidence).monthlySearches).toHaveLength(120);
  });
  it('normalizes query whitespace without folding GSC property paths', () => {
    expect(queryKey(' Coffee  BEANS ')).toBe('coffee beans');
    expect(queryEvidenceKey(gsc)).toContain('/Shop/');
    expect(queryEvidenceKey(ads)).toContain('|pl|2616|pl|coffee');
  });
  it('returns the original document for missing nodes and invalid input evidence', () => {
    const node = createTopicalNode('Topic');
    const document = { ...createEmptyTopicalMap(), nodes: [node] };
    expect(importTopicalQueries(document, 'missing', [{ text: 'q', source: gsc }])).toMatchObject({ document, addedCount: 0 });
    const result = importTopicalQueries(document, node.id, [{ text: ' ', source: gsc }, { text: 'q', source: { ...gsc, retrievedAt: '' } }]);
    expect(result.document).toBe(document);
    expect(result.duplicateCount).toBe(1);
  });
  it('retains snapshot identity, ignores older evidence and reports the node budget', () => {
    const node = createTopicalNode('Topic');
    node.queries = [{ id: 'manual', text: 'manual', provenance: 'asserted' }];
    const document = { ...createEmptyTopicalMap(), nodes: [node, createTopicalNode('Other')] };
    const first = importTopicalQueries(document, node.id, [{ text: 'coffee', source: gsc }]);
    const previous = first.document.nodes[0].queries[1];
    const older = importTopicalQueries(first.document, node.id, [{ text: ' COFFEE ', source: { ...gsc, retrievedAt: '2020' } }]);
    expect(older.document).toBe(first.document);
    expect(older.duplicateCount).toBe(1);
    expect(older.updatedCount).toBe(0);
    const refreshed = importTopicalQueries(first.document, node.id, [{ text: 'coffee', source: { ...gsc, retrievedAt: '2027', clicks: 3 } }]);
    expect(refreshed.document.nodes[0].queries[1].id).toBe(previous.id);
    expect(refreshed.updatedCount).toBe(1);
    const full = importTopicalQueries(document, node.id, Array.from({ length: 101 }, (_, i) => ({ text: `q${i}`, source: ads })));
    expect(full).toMatchObject({ addedCount: 99, limitReached: true });
    expect(full.document.nodes[0].queries).toHaveLength(100);
  });
});
