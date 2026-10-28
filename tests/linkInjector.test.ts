import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary, RagSection } from '@/types';
import type { InternalLinkOpportunity } from '@/services/internalLinkOpportunities';
import type { SemanticMap } from '@/services/semanticGraph/types';
import {
  anchorText, bestSection, buildLinkInjections, buildSnippet, countTerm, expectedSprGain, MAX_INJECTIONS, snippetLanguage, sprsGainContext,
} from '@/services/linkInjector';

const section = (heading: string, level: number, paragraphs: string[]): RagSection =>
  ({ heading, level, paragraphs, tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0 });
const page = (url: string, patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  url, final_url: url, redirect_chain: [], depth: 1, http_status: 200, response_time_ms: 100, indexability_status: 'Indexable',
  body_truncated: false, word_count: 300, semantic_terms: [], semantic_links: [], schema_types: [], schema_syntax_errors: 0, hreflangs: [],
  h1_count: 1, internal_link_count: 0, external_link_count: 0, links: [], images: [], issues_count: 0, issues: [], ...patch,
}) as CrawledPageSummary;
const opportunity = (sourceUrl: string, targetUrl: string, sharedTerms: string[], weightedJaccard = 0.5): InternalLinkOpportunity =>
  ({ id: `${sourceUrl}=>${targetUrl}`, sourceUrl, sourceTitle: sourceUrl, targetUrl, targetTitle: `Title ${targetUrl}`, sharedTerms, weightedJaccard });

describe('countTerm', () => {
  it('counts literal, case-insensitive whole words and treats metacharacters literally', () => {
    expect(countTerm('Solar panels; SOLAR panel. solarium', 'solar')).toBe(2);
    expect(countTerm('Learn C++ and c++ fast, c+ no', 'c++')).toBe(2);
    expect(countTerm('Żółw i żółwie', 'żółw')).toBe(1);
    expect(countTerm('太阳能电池板和太阳能', '太阳能')).toBe(2);
    expect(countTerm('anything', '  ')).toBe(0);
  });
});

describe('bestSection', () => {
  const donor = page('https://a.test/', {
    rag_sections: [
      section('Intro solar', 1, ['solar solar solar']),
      section('Costs', 2, ['solar panel price']),
      section('Install', 3, ['solar panel mounting, panel angle']),
      section('Deep', 4, ['solar panel panel panel']),
      section('Same', 2, ['solar panel mounting, panel angle']),
    ],
  });
  it('picks the H2/H3 section with most shared-term mentions, earlier on ties', () => {
    expect(bestSection(donor, ['solar', 'panel'])).toEqual({ heading: 'Install', level: 3, index: 2, termHits: 3, matchedTerms: ['solar', 'panel'] });
  });
  it('returns null without captured sections or matches', () => {
    expect(bestSection(page('https://b.test/'), ['solar'])).toBeNull();
    expect(bestSection(donor, ['wind'])).toBeNull();
  });
});

describe('snippets', () => {
  it('uses the page language, then the semantic language, and flags the English fallback', () => {
    expect(snippetLanguage({ document_language: 'pl-PL' })).toEqual({ language: 'pl', fallback: false });
    expect(snippetLanguage({ document_language: 'xx', semantic_language: 'de' })).toEqual({ language: 'de', fallback: false });
    expect(snippetLanguage({ document_language: 'constructor' })).toEqual({ language: 'en', fallback: true });
  });
  it('escapes HTML and Markdown and keeps anchors short at a word boundary', () => {
    const snippet = buildSnippet(page('https://a.test/', { document_language: 'pl' }), 'https://a.test/x_(1)?a="b"&c', 'Panele <b>[PV]</b> & "eko"');
    expect(snippet.html).toBe('<p>Zobacz też: <a href="https://a.test/x_(1)?a=&#34;b&#34;&#38;c">Panele &#60;b&#62;[PV]&#60;/b&#62; &#38; &#34;eko&#34;</a>.</p>');
    expect(snippet.markdown).toBe('Zobacz też: [Panele <b>\\[PV\\]</b> & "eko"](https://a.test/x_%281%29?a="b"&c).');
    expect(anchorText('word '.repeat(30)).length).toBeLessThanOrEqual(70);
    expect(anchorText('x'.repeat(90))).toHaveLength(70);
    expect(buildSnippet(page('https://a.test/'), 'https://a.test/t', '  ').anchor).toBe('https://a.test/t');
  });
});

const graphOf = (pages: CrawledPageSummary[], links: Array<[number, number]>): SemanticMap => ({
  nodes: pages.map((p, i) => ({ id: `page-${i}`, page: p, clusterId: 'c', clusterLabel: 'c', semanticSignalCount: 1, incomingContentLinks: 0, orphan: false })),
  edges: links.map(([s, t]) => ({ id: `e${s}-${t}`, source: `page-${s}`, target: `page-${t}`, anchors: [], links: 1 })),
  topicEdges: [],
} as unknown as SemanticMap);

describe('SPRS gain', () => {
  const pages = ['https://s.test/', 'https://s.test/a', 'https://s.test/b'].map((url) => page(url));
  const context = sprsGainContext(graphOf(pages, [[0, 1], [1, 0], [2, 0]]));
  it('solves the target change for one added link and reports unknown pages as null', () => {
    expect(context).not.toBeNull();
    expect(expectedSprGain(context!, 'https://s.test/', 'https://s.test/b', 0.5)).toBeGreaterThan(0);
    expect(expectedSprGain(context!, 'https://s.test/', 'https://other.test/', 0.5)).toBeNull();
    expect(expectedSprGain(context!, 'https://s.test/a', 'https://s.test/a', 0.5)).toBeNull();
    expect(sprsGainContext(graphOf([], []))).toBeNull();
  });

  it('builds top injections with a section, ranked by gain, skipping donors without a matching H2/H3', () => {
    const withSection = (url: string) => page(url, { rag_sections: [section('Guide', 2, ['solar panel'])] });
    const donors = [withSection('https://s.test/'), withSection('https://s.test/a'), page('https://s.test/b')];
    const rows = buildLinkInjections([
      opportunity('https://s.test/a', 'https://s.test/', ['solar'], 0.9),
      opportunity('https://s.test/', 'https://s.test/b', ['solar', 'panel'], 0.4),
      opportunity('https://s.test/b', 'https://s.test/a', ['solar'], 0.99),
      opportunity('https://missing.test/', 'https://s.test/a', ['solar'], 0.99),
    ], donors, context);
    expect(rows.map((row) => row.id)).toEqual(['https://s.test/=>https://s.test/b', 'https://s.test/a=>https://s.test/']);
    expect(rows[0].section.heading).toBe('Guide');
    expect(rows[0].expectedSprGain).toBeGreaterThan(rows[1].expectedSprGain ?? 0);
    const many = Array.from({ length: 15 }, (_, i) => opportunity('https://s.test/', `https://s.test/t${i}`, ['solar']));
    const capped = buildLinkInjections(many, donors, null);
    expect(capped).toHaveLength(MAX_INJECTIONS);
    expect(capped.every((row) => row.expectedSprGain === null)).toBe(true);
  });
});
