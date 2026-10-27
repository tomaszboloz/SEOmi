import { describe, expect, it } from 'vitest';
import { buildTaxonomy } from '@/services/topicalAuthority';
import { buildTopics } from '@/services/topicalDiagnosis/topics';
import { createSuggestionFetcher, createReferenceDeps } from '@/services/topicalAuthorityReference';
import { useToolsStore } from '@/stores/toolsStore';
import type { FocusPage } from '@/services/siteFocus';

const page = (host: string, index: number, headings: unknown, terms: unknown[] = []): FocusPage => ({
  url: `https://${host}/p-${index}`, final_url: `https://${host}/p-${index}`, title: 'Coffee guide', word_count: 800, depth: 1,
  http_status: 200, links: [], heading_texts: headings as never, focus_terms: terms as never,
} as unknown as FocusPage);

describe('coverage100 taxonomy and provider edges', () => {
  it('filters empty and oversized heading candidates and keeps fallback entity surfaces', () => {
    const pages = [
      page('one.test', 1, { h2: ['!!!', 'espresso guide', 'one two three four five six seven eight nine'], h3: [] }, [{ term: 'extra', surface: '', count: 1, weight: 1 }]),
      page('two.test', 1, { h2: ['espresso guide'], h3: [] }, [{ term: 'extra', surface: '', count: 2, weight: 2 }]),
      page('three.test', 1, {}, undefined as never),
    ];
    const taxonomy = buildTaxonomy({ coreLabel: 'coffee', coreKeys: new Set(['espresso', 'guide']), language: 'en', competitors: [{ domain: 'one.test', pages }, { domain: 'two.test', pages }], suggestions: ['unmatched question?'], source: 'test', now: '2026-10-01' });
    expect(taxonomy).not.toBeNull();
    expect(taxonomy!.subtopics.some((row) => row.entities.includes('extra'))).toBe(true);
    expect(taxonomy!.suggestionCount).toBe(1);

    const noSuggestions = buildTaxonomy({ coreLabel: 'coffee', coreKeys: new Set(['espresso']), language: 'en', competitors: [{ domain: 'one.test', pages: [page('one.test', 1, { h2: ['espresso'], h3: [] })] }, { domain: 'two.test', pages: [page('two.test', 1, { h2: ['espresso'], h3: [] })] }], suggestions: [], source: 'test', now: '2026-10-01' });
    expect(noSuggestions?.suggestionCount).toBe(0);

    const disjoint = buildTaxonomy({ coreLabel: 'coffee', coreKeys: new Set(['espresso']), language: 'en', competitors: [{ domain: 'one.test', pages: [page('one.test', 1, { h2: ['aaa'], h3: [] })] }, { domain: 'two.test', pages: [page('two.test', 1, { h2: ['bbb'], h3: [] })] }], suggestions: [], source: 'test', now: '2026-10-01' });
    expect(disjoint).toBeNull();
  });

  it('uses provider defaults and translates plain thrown errors', async () => {
    const ok = createSuggestionFetcher({ geo: 'PL', language: 'pl', fetch: async () => ({ status: 'ok', result: { suggestions: ['coffee'] } }) });
    expect(await ok('x')).toEqual(['coffee']);
    const empty = createSuggestionFetcher({ geo: 'PL', language: 'pl', fetch: async () => ({ status: 'ok', result: null }) });
    expect(await empty('x')).toEqual([]);
    const errStatus = createSuggestionFetcher({ geo: 'PL', language: 'pl', fetch: async () => ({ status: 'error', result: null }) });
    expect(await errStatus('x')).toEqual([]);
    const throws = createSuggestionFetcher({ geo: 'PL', language: 'pl', fetch: async () => { throw new Error('network'); } });
    expect(await throws('x')).toEqual([]);
    useToolsStore.setState({ keywordCountry: '', keywordLanguage: '' });
    expect(createReferenceDeps().fetchSuggestions).toBeTypeOf('function');
    useToolsStore.setState({ keywordCountry: 'US', keywordLanguage: 'en' });
  });

  it('accepts a custom similarity function for grouped diagnosis topics', () => {
    const doc = (id: string, value: string) => ({ id, pages: [], primaryPage: { url: `https://x.test/${id}` }, urls: new Set([`https://x.test/${id}`]), languages: ['en'], terms: new Set([value]), titleTerms: new Set([value]), titleForms: new Map(), section: 'x', role: 'content', partialEvidence: false }) as never;
    const result = buildTopics([doc('doc-0', 'a'), doc('doc-1', 'b')], new Map([['doc-0', 'area'], ['doc-1', 'area']]), { documentFrequency: new Map(), comparable: 2, isTopical: () => true, idf: () => 1 }, () => 1);
    expect(result.pairs).toHaveLength(1);
    expect(result.topics).toHaveLength(1);
  });
});
