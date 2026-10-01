import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { buildSemanticMap } from '@/services/semanticMap';
import {
  createEmptyTopicalMap,
  createTopicalNode,
  importCrawlClusters,
  importTopicalQueries,
  normalizeTopicalMap,
  parseManualTopicalQueries,
  updateManualTopicalQueries,
  readTopicalMap,
  setTopicalNodeParent,
  topicalMapStorageKey,
  topicalCalendarDays,
  shiftTopicalCalendarMonth,
  toggleTopicalLateralRelation,
  writeTopicalMap,
} from '@/services/topicalMap';

const pages = [
  { url: 'https://example.com/a', final_url: 'https://example.com/a', title: 'A', semantic_terms: ['coffee', 'beans', 'grind'], semantic_links: [] },
  { url: 'https://example.com/b', final_url: 'https://example.com/b', title: 'B', semantic_terms: ['coffee', 'beans', 'roast'], semantic_links: [] },
  { url: 'https://example.com/c', final_url: 'https://example.com/c', title: 'C', semantic_terms: ['widget', 'device'], semantic_links: [] },
] as unknown as CrawledPageSummary[];

const storage = () => {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
};

describe('project topical map', () => {
  it('persists durable map data under the project and normalizes facts/URLs', () => {
    const local = storage();
    const document = createEmptyTopicalMap();
    document.entity.name = 'Example';
    document.entity.facts.push({ id: 'fact', attribute: 'region', value: 'North', sourceUrl: 'https://example.com/about', reuseStatus: 'locked' });
    document.nodes.push({ ...createTopicalNode('Coffee'), queries: [{ id: 'query', text: 'coffee guide', provenance: 'asserted' }], sourceUrls: ['javascript:alert(1)', 'https://example.com/a'] });

    writeTopicalMap('p1', document, local);
    const loaded = readTopicalMap('p1', local);
    expect(local.entries.has(topicalMapStorageKey('p1'))).toBe(true);
    expect(loaded.entity.facts[0].sourceUrl).toBe('https://example.com/about');
    expect(loaded.entity.facts[0].reuseStatus).toBe('locked');
    expect(loaded.nodes[0].sourceUrls).toEqual(['https://example.com/a']);
    expect(loaded.nodes[0].queries[0].provenance).toBe('asserted');
    expect(loaded.nodes[0].contentBrief).toMatchObject({ targetQueryId: '', requiredEntities: [], snippetTarget: 'none', draftMarkdown: '', paragraphReviews: [] });
  });

  it('breaks invalid parent cycles and prevents edits that would create cycles', () => {
    const raw = { nodes: [
      { ...createTopicalNode('A'), id: 'a', parentId: null },
      { ...createTopicalNode('B'), id: 'b', parentId: 'a' },
    ] };
    const normalized = normalizeTopicalMap(raw);
    const a = normalized.nodes.find((node) => node.id === 'a')!;
    const first = setTopicalNodeParent(normalized, a.id, 'b');
    expect(first).toBe(normalized);
  });

  it('locks legacy facts without explicit verification and drops stale brief query IDs', () => {
    const node = createTopicalNode('Coffee');
    const normalized = normalizeTopicalMap({
      entity: { facts: [{ id: 'legacy', attribute: 'claim', value: 'Unverified', sourceUrl: 'https://example.com/source' }] },
      nodes: [{ ...node, queries: [{ id: 'current', text: 'coffee', provenance: 'asserted' }], contentBrief: { targetQueryId: 'removed', snippetTarget: 'faq', requiredEntities: [' beans ', 'beans'], internalLinkTargets: ['javascript:alert(1)', 'https://example.com/a'], draftMarkdown: 'A draft.' } }],
    });

    expect(normalized.entity.facts[0].reuseStatus).toBe('locked');
    expect(normalized.nodes[0].contentBrief).toEqual({ targetQueryId: '', snippetTarget: 'faq', requiredEntities: ['beans'], internalLinkTargets: ['https://example.com/a'], draftMarkdown: 'A draft.', paragraphReviews: [], draftVersions: [] });
  });

  it('stores lateral relationships as a symmetric, de-duplicated relation', () => {
    const first = createTopicalNode('First');
    const second = createTopicalNode('Second');
    const document = { ...createEmptyTopicalMap(), nodes: [first, second] };
    const linked = toggleTopicalLateralRelation(document, first.id, second.id);
    expect(linked.nodes[0].relatedNodeIds).toEqual([second.id]);
    expect(linked.nodes[1].relatedNodeIds).toEqual([first.id]);
    expect(toggleTopicalLateralRelation(linked, first.id, second.id).nodes.every((node) => !node.relatedNodeIds.length)).toBe(true);
  });

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

  it('preserves exact imported provenance through manual editing but marks changed text as asserted', () => {
    const imported = { id: 'df-1', text: 'coffee guide', provenance: 'dataforseo' as const, source: {
      provider: 'DataForSEO Google Ads Keywords for Keywords Live' as const,
      retrievedAt: '2026-09-23T10:00:00.000Z', seedKeyword: 'coffee', countryCode: 'US', locationCode: 2840, languageCode: 'en',
      searchVolume: 100, cpc: 2, competitionIndex: 30, searchIntent: null, monthlySearches: [],
    } };
    const queries = parseManualTopicalQueries('coffee guide\ncoffee grinder', [imported]);

    expect(queries[0]).toEqual(imported);
    expect(queries[1]).toMatchObject({ text: 'coffee grinder', provenance: 'asserted' });
  });

  it('imports content clusters idempotently per crawl run with only real crawled URL evidence', () => {
    const graph = buildSemanticMap(pages, pages[0].url);
    const first = importCrawlClusters(createEmptyTopicalMap(), graph, pages, 'run-1');
    const second = importCrawlClusters(first, graph, pages, 'run-1');
    expect(second.nodes).toHaveLength(first.nodes.length);
    expect(first.nodes.every((node) => node.evidenceTerms.length <= 80 && node.sourceUrls.every((url) => pages.some((page) => page.url === url)))).toBe(true);
    expect(importCrawlClusters(first, graph, pages, 'run-2').nodes.length).toBeGreaterThan(first.nodes.length);
  });

  it('builds Monday-first calendar grids across month and year boundaries', () => {
    const september = topicalCalendarDays('2026-09');
    const februaryLeapYear = topicalCalendarDays('2028-02');

    expect(september[0]).toMatchObject({ date: '2026-08-31', inCurrentMonth: false });
    expect(september.at(-1)).toMatchObject({ date: '2026-10-04', inCurrentMonth: false });
    expect(september.every((day, index) => index === 0 || day.date > september[index - 1].date)).toBe(true);
    expect(februaryLeapYear.some((day) => day.date === '2028-02-29' && day.inCurrentMonth)).toBe(true);
    expect(shiftTopicalCalendarMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftTopicalCalendarMonth('2027-01', -1)).toBe('2026-12');
  });
});


it('replaces manual queries while preserving observed provider evidence and stable manual identifiers', () => {
  const imported = { id: 'observed', text: 'coffee impressions', provenance: 'gsc' as const };
  const retained = { id: 'manual-stable', text: 'Coffee guide', provenance: 'asserted' as const };
  const node = { ...createTopicalNode('Coffee'), queries: [imported, retained, { id: 'removed', text: 'Old draft', provenance: 'asserted' as const }] };
  const result = updateManualTopicalQueries(node, 'Coffee guide\nNew intent\nnew INTENT\n');
  expect(result.limitReached).toBe(false);
  expect(result.queries.map(query => query.text)).toEqual(['coffee impressions', 'Coffee guide', 'New intent']);
  expect(result.queries[0]).toBe(imported); expect(result.queries[1]).toBe(retained);
  expect(result.queries[2].provenance).toBe('asserted');
  expect(node.queries.map(query => query.id)).toEqual(['observed', 'manual-stable', 'removed']);
});

it('caps manual additions after observed queries without replacing their evidence', () => {
  const imported = Array.from({ length: 99 }, (_, index) => ({ id: `observed-${index}`, text: `actual query ${index}`, provenance: 'dataforseo' as const }));
  const result = updateManualTopicalQueries({ ...createTopicalNode('Coffee'), queries: imported }, 'New intent\nOther intent');
  expect(result.limitReached).toBe(true); expect(result.queries).toHaveLength(100);
  expect(result.queries.slice(0, 99)).toEqual(imported); expect(result.queries[99].text).toBe('New intent');
});

it('allows clearing manual queries without deleting observed queries', () => {
  const imported = { id: 'observed', text: 'actual query', provenance: 'gsc' as const };
  const result = updateManualTopicalQueries({ ...createTopicalNode('Coffee'), queries: [imported, {id:'manual',text:'draft',provenance:'asserted'}] }, '   ');
  expect(result).toEqual({queries:[imported],limitReached:false});
});
