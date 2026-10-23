import { describe, expect, it } from 'vitest';
import { buildSprsReport } from '@/components/Charts/semanticTopical/signals/sprsAdapter';
import { detectConflicts, classifyIndexability } from '@/services/indexabilityGate';
import { buildContext } from '@/services/topicalAuthority';
import { buildSiteFocusReport, type FocusPage } from '@/services/siteFocus';
import type { SemanticMap } from '@/services/semanticGraph/types';
import { createCrawlPageFixture } from './fixtures/crawl';

const START = 'https://site.test/';
const page = (url: string, patch: Partial<FocusPage> = {}): FocusPage => createCrawlPageFixture({
  url, final_url: url, http_status: 200, word_count: 300, document_language: 'en',
  focus_terms: [
    { term: 'indexability', surface: 'indexability', count: 3, weight: 6 },
    { term: 'canonical', surface: 'canonical', count: 2, weight: 4 },
  ],
  ...patch,
}) as FocusPage;

const graph = (pages: FocusPage[], edges: Array<[string, string]>): SemanticMap => ({
  nodes: pages.map((item, index) => ({ id: `n${index}`, page: item, clusterId: 'c', clusterLabel: 'c', semanticSignalCount: 1, incomingContentLinks: 0, orphan: false })),
  edges: edges.map(([source, target]) => ({ id: `${source}>${target}`, source, target, anchors: [], links: 1 })),
  topicEdges: [], totalEdges: edges.length, totalTopicEdges: 0, totalInternalLinks: edges.length, clusters: [], hasSemanticTerms: true, truncated: false,
});

describe('indexability gate integration', () => {
  it('keeps TAS scoped to eligible pages even when SFS was opted into gated pages', () => {
    const eligible = page(`${START}ok`);
    const unknown = page(`${START}unknown`, { http_status: 0 });
    const pages = [
      eligible,
      unknown,
      page(`${START}noindex`, { meta_robots: 'noindex' }),
      page(`${START}canonical`, { canonical: 'https://other.test/' }),
      page(`${START}error`, { http_status: 404 }),
    ];
    const sfs = buildSiteFocusReport(pages, START, { includeNonIndexable: true, now: '2026-10-23T00:00:00Z' });
    const context = buildContext(pages, START, sfs);

    expect(context.pages.map((entry) => entry.url)).toEqual([eligible.url, unknown.url]);
    expect(classifyIndexability(unknown)).toBe('unknown');
  });

  it('filters gated graph nodes and dangling edges while retaining unknown status pages', () => {
    const eligible = page(`${START}ok`);
    const unknown = page(`${START}unknown`, { http_status: 0 });
    const noindex = page(`${START}noindex`, { meta_robots: 'noindex' });
    const canonical = page(`${START}canonical`, { canonical: 'https://other.test/' });
    const error = page(`${START}error`, { http_status: 500 });
    const report = buildSprsReport(graph([eligible, unknown, noindex, canonical, error], [
      ['n0', 'n1'], ['n0', 'n2'], ['n2', 'n0'], ['n3', 'n0'], ['n4', 'n0'],
    ]));

    expect(report.pages.map((row) => row.nodeId)).toEqual(expect.arrayContaining(['n0', 'n1']));
    expect(report.pages).toHaveLength(2);
    expect(report.pages.every((row) => ['n0', 'n1'].includes(row.nodeId))).toBe(true);
  });

  it('does not classify missing traffic or link evidence as conflicts', () => {
    const noindex = page(`${START}noindex`, { meta_robots: 'noindex' });
    expect(detectConflicts({ pages: [noindex] })).toEqual([]);
  });

  it('keeps an unavailable conflict metric out of the detail payload', () => {
    const noindex = page(`${START}noindex`, { meta_robots: 'noindex' });
    const [conflict] = detectConflicts({ pages: [noindex], clicks: new Map([[noindex.url, 3]]) });
    expect(conflict).toMatchObject({ code: 'noindex-with-traffic', detail: { clicks: 3 } });
    expect(conflict.detail).not.toHaveProperty('referringDomains');
  });
});
