import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { buildSemanticMap } from '@/services/semanticMap';
import { buildTermInventory } from '@/services/semanticGraph/terms';
import i18n from '@/i18n';

const topicPage = (url: string, terms: string[], extra: Record<string, unknown> = {}) => ({
  url, final_url: url, semantic_terms: terms, semantic_links: [], links: [], http_status: 200, ...extra,
} as unknown as CrawledPageSummary);

describe('semantic map term inventory', () => {
  it('keys inflected forms together and displays the form most pages use', () => {
    const inventory = buildTermInventory([
      topicPage('https://site.test/a', ['Szkolenia', 'szkolenie', 'sprzedaży', 'ale', '2026', ' '], { document_language: 'pl' }),
      topicPage('https://site.test/b', ['szkolenie', 'sprzedaż'], { document_language: 'pl' }),
      topicPage('https://site.test/c', ['szkolenie'], { document_language: 'pl' }),
      topicPage('https://site.test/gone', ['szkolenia'], { document_language: 'pl', http_status: 410 }),
    ]);

    expect(inventory.termsByPage).toEqual([['pl:szkolen', 'pl:sprzedaz'], ['pl:szkolen', 'pl:sprzedaz'], ['pl:szkolen'], []]);
    expect(inventory.displayTerm('pl:szkolen')).toBe('szkolenie');
    // One page each: the shorter observed form wins the tie.
    expect(inventory.displayTerm('pl:sprzedaz')).toBe('sprzedaż');
  });

  it('keeps error pages out of topical clusters and topic edges', () => {
    const pages = [
      topicPage('https://site.test/a', ['espresso', 'grinding', 'burr']),
      topicPage('https://site.test/b', ['espresso', 'grinding', 'burr']),
      topicPage('https://site.test/missing-1', ['found', 'page', 'error'], { http_status: 404 }),
      topicPage('https://site.test/missing-2', ['found', 'page', 'error'], { http_status: 404 }),
      topicPage('https://site.test/moved', ['found', 'page', 'error'], { http_status: 301 }),
    ];

    const map = buildSemanticMap(pages, pages[0].url);

    expect(map.topicEdges.map((edge) => [edge.source, edge.target])).toEqual([['page-0', 'page-1']]);
    expect(map.nodes[2].clusterId).not.toBe(map.nodes[3].clusterId);
    expect(map.nodes[2].clusterLabel).toBe(i18n.t('runtimeErrors.semanticMap.noSignals'));
    expect(map.nodes[2].semanticSignalCount).toBe(0);
    expect(map.clusters.map((cluster) => cluster.label)).not.toContain('found');
  });

  it('keeps rendered pages whose browser did not expose an HTTP status', () => {
    const pages = [
      topicPage('https://site.test/a', ['espresso', 'grinding', 'burr'], { http_status: 0 }),
      topicPage('https://site.test/b', ['espresso', 'grinding', 'burr'], { http_status: 0 }),
    ];

    expect(buildSemanticMap(pages, pages[0].url).topicEdges).toHaveLength(1);
  });

  it('ignores function words and numbers that older crawls still stored', () => {
    const pages = [
      topicPage('https://site.test/a', ['ale', '2026', '000', 'jeśli', 'espresso'], { document_language: 'pl' }),
      topicPage('https://site.test/b', ['ale', '2026', '000', 'jeśli', 'ogrody'], { document_language: 'pl' }),
    ];

    const map = buildSemanticMap(pages, pages[0].url);

    expect(map.topicEdges).toHaveLength(0);
    expect(map.nodes.map((node) => node.clusterLabel)).toEqual(['espresso', 'ogrody']);
    expect(map.nodes[0].semanticSignalCount).toBe(1);
  });

  it('relates Polish pages that use different inflections of the same terms', () => {
    const pages = [
      topicPage('https://site.test/a', ['szkolenia', 'navigatora', 'sprzedaży'], { document_language: 'pl-PL' }),
      topicPage('https://site.test/b', ['szkolenie', 'navigator', 'sprzedaż'], { document_language: 'pl' }),
    ];

    const map = buildSemanticMap(pages, pages[0].url);

    expect(map.nodes[0].clusterId).toBe(map.nodes[1].clusterId);
    // Evidence stays readable: forms observed on the pages, never the internal key.
    expect(map.topicEdges.map((edge) => edge.sharedTerms)).toEqual([['navigator', 'sprzedaż', 'szkolenia']]);
    // Two characteristic terms, in observed forms.
    expect(map.nodes[0].clusterLabel).toBe('szkolenia / navigator');
  });

  it('does not relate the same forms when the pages are not Polish', () => {
    const pages = [
      topicPage('https://site.test/a', ['szkolenia', 'navigatora', 'sprzedaży'], { document_language: 'de' }),
      topicPage('https://site.test/b', ['szkolenie', 'navigator', 'sprzedaż']),
    ];

    expect(buildSemanticMap(pages, pages[0].url).topicEdges).toEqual([]);
  });

  it('uses the language the crawler inferred when the page declares none', () => {
    const pages = [
      topicPage('https://site.test/a', ['szkolenia', 'navigatora', 'sprzedaży'], { document_language: null, semantic_language: 'pl' }),
      topicPage('https://site.test/b', ['szkolenie', 'navigator', 'sprzedaż'], { document_language: null, semantic_language: 'pl' }),
    ];

    const map = buildSemanticMap(pages, pages[0].url);

    expect(map.topicEdges).toHaveLength(1);
    expect(map.nodes[0].clusterId).toBe(map.nodes[1].clusterId);
  });

  it('does not connect identical surface terms from different language pages', () => {
    const pages = [
      topicPage('https://site.test/pl', ['firmy', 'oferta'], { semantic_language: 'pl' }),
      topicPage('https://site.test/en', ['firm', 'offer'], { semantic_language: 'en' }),
    ];

    expect(buildSemanticMap(pages, pages[0].url).topicEdges).toEqual([]);
  });

  it('does not connect identical topical words when only the page language differs', () => {
    const pages = [
      topicPage('https://site.test/pl', ['seo', 'marketing'], { semantic_language: 'pl' }),
      topicPage('https://site.test/en', ['seo', 'marketing'], { semantic_language: 'en' }),
    ];

    expect(buildSemanticMap(pages, pages[0].url).topicEdges).toEqual([]);
  });
});
