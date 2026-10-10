import { describe, expect, it } from 'vitest';
import { buildSemanticMap } from '@/services/semanticMap';
import i18n from '@/i18n';
import { clusterLabel } from '@/services/semanticGraph/labels';
import type { SemanticTermInventory } from '@/services/semanticGraph/terms';
import { fillerPages, topicPage } from './fixtures/semanticMapTopics';

const labelInventory = (
  termsByPage: string[][],
  topicalTermsByPage: string[][],
): SemanticTermInventory => ({
  termsByPage,
  topicalTermsByPage: topicalTermsByPage.map((terms) => new Set(terms)),
  isTopicalTerm: (term) => topicalTermsByPage.some((terms) => terms.includes(term)),
  inverseFrequency: () => 1,
  displayTerm: (term) => term,
});

describe('buildSemanticMap topical clusters', () => {
  it('does not let a term present on most pages glue unrelated topics together', () => {
    const coffee = Array.from({ length: 6 }, (_, index) => topicPage(`https://site.test/coffee-${index}`, ['linkedin', 'profile', 'espresso', 'grinding', 'burr']));
    const garden = Array.from({ length: 6 }, (_, index) => topicPage(`https://site.test/garden-${index}`, ['linkedin', 'profile', 'tomatoes', 'compost', 'seedlings']));

    const map = buildSemanticMap([...coffee, ...garden, ...fillerPages(8)], coffee[0].url);

    expect(map.nodes[0].clusterId).toBe(map.nodes[5].clusterId);
    expect(map.nodes[6].clusterId).toBe(map.nodes[11].clusterId);
    expect(map.nodes[0].clusterId).not.toBe(map.nodes[6].clusterId);
    expect(map.topicEdges.every((edge) => !edge.sharedTerms.includes('linkedin'))).toBe(true);
    expect(map.nodes[0].clusterLabel).not.toMatch(/linkedin|profile/);
  });

  it('does not chain two topics into one cluster through a single bridging page', () => {
    const coffee = Array.from({ length: 5 }, (_, index) => topicPage(`https://site.test/coffee-${index}`, ['espresso', 'grinding', 'burr', 'crema']));
    const garden = Array.from({ length: 5 }, (_, index) => topicPage(`https://site.test/garden-${index}`, ['tomatoes', 'compost', 'seedlings', 'mulch']));
    const bridge = topicPage('https://site.test/bridge', ['espresso', 'grinding', 'tomatoes', 'compost']);

    const map = buildSemanticMap([...coffee, ...garden, bridge, ...fillerPages(10)], coffee[0].url);

    expect(map.nodes[0].clusterId).toBe(map.nodes[4].clusterId);
    expect(map.nodes[5].clusterId).toBe(map.nodes[9].clusterId);
    expect(map.nodes[0].clusterId).not.toBe(map.nodes[5].clusterId);
  });

  it('labels a cluster with its most characteristic terms rather than its most frequent one', () => {
    const ssi = Array.from({ length: 3 }, (_, index) => topicPage(`https://site.test/ssi-${index}`, ['sales', 'ssi', 'wskaźnik', 'navigator']));
    const others = Array.from({ length: 8 }, (_, index) => topicPage(`https://site.test/other-${index}`, ['sales', `unique${String.fromCharCode(97 + index)}`, 'navigator']));

    const map = buildSemanticMap([...ssi, ...others], ssi[0].url);

    expect(map.nodes[0].clusterId).toBe(map.nodes[2].clusterId);
    expect(map.nodes[0].clusterLabel).toMatch(/^(ssi|wskaźnik) \/ (ssi|wskaźnik)$/);
  });

  it('uses only terms shared by multiple members for a multi-page label', () => {
    const inventory = labelInventory(
      [['shared', 'only-first'], ['shared', 'only-second']],
      [['shared', 'only-first'], ['shared', 'only-second']],
    );

    expect(clusterLabel([0, 1], inventory)).toBe('shared');
  });

  it('does not revive site-wide terms when every topical term was filtered', () => {
    const inventory = labelInventory(
      [['brand'], ['brand']],
      [[], []],
    );

    expect(clusterLabel([0, 1], inventory)).toBe(i18n.t('runtimeErrors.semanticMap.noSignals'));
  });

  it('re-evaluates a pending merge after its group grows instead of chaining to it', () => {
    // 0-1 and 0-2 are equally similar; after 0 and 1 merge, page 2 shares
    // nothing with page 1, so the group average falls below the floor.
    const pages = [
      topicPage('https://site.test/0', ['alpha', 'bravo', 'charlie', 'delta']),
      topicPage('https://site.test/1', ['charlie', 'delta', 'echo', 'foxtrot']),
      topicPage('https://site.test/2', ['alpha', 'bravo', 'golf', 'hotel']),
    ];

    const map = buildSemanticMap(pages, pages[0].url);

    expect(map.topicEdges).toHaveLength(2);
    expect(map.nodes[0].clusterId).toBe(map.nodes[1].clusterId);
    expect(map.nodes[2].clusterId).not.toBe(map.nodes[0].clusterId);
  });
});
