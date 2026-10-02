import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createEmptyTopicalMap, createTopicalNode, importTopicalQueries, updateManualTopicalQueries, parseManualTopicalQueries } from '@/services/topicalMap';
import type { GscTopicalEvidence } from '@/services/topicalMap';

const source = (propertyUrl: string): GscTopicalEvidence => ({
  provider: 'Google Search Console', retrievedAt: '2026-10-02T00:00:00Z', propertyUrl,
  startDate: '2026-09-01', endDate: '2026-09-30', clicks: 1, impressions: 10,
  ctr: 0.1, position: 2, queryRowsMayBeTruncated: false, maxRowsPerDimension: 25000,
});

describe('topical map bounded query identities', () => {
  it('reports manual overflow instead of silently dropping the 101st unique query', () => {
    const result = updateManualTopicalQueries(createTopicalNode('Topic'),
      Array.from({ length: 101 }, (_, index) => `query ${index}`).join('\n'));
    expect(result.queries).toHaveLength(100);
    expect(result.limitReached).toBe(true);
  });

  it('does not let blank and duplicate lines starve the manual query budget', () => {
    const queries = parseManualTopicalQueries(`${'\n'.repeat(100)}coffee\ncoffee\nbeans`, []);
    expect(queries.map((query) => query.text)).toEqual(['coffee', 'beans']);
  });

  it('keeps case-sensitive GSC property paths distinct during evidence imports', () => {
    const document = createEmptyTopicalMap();
    const node = createTopicalNode('Topic');
    document.nodes = [node];
    const result = importTopicalQueries(document, node.id, [
      { text: 'coffee', source: source('https://site.test/Shop/') },
      { text: 'coffee', source: source('https://site.test/shop/') },
    ]);
    expect(result.addedCount).toBe(2);
    expect(result.duplicateCount).toBe(0);
    expect(result.document.nodes[0].queries).toHaveLength(2);
  });

  it('keeps all topical map responsibilities within 150 physical lines', () => {
    const directory = 'src/services/topicalDocument';
    for (const file of ['src/services/topicalMap.ts', ...readdirSync(directory).map((name) => `${directory}/${name}`)]) {
      const source = readFileSync(file, 'utf8');
      expect(source.split('\n').length - Number(source.endsWith('\n')), file).toBeLessThanOrEqual(150);
    }
  });
});
