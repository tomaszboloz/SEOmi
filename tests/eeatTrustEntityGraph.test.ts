import { describe, expect, it } from 'vitest';
import { buildTrustGraph } from '@/services/eeatTrust/entityGraph';
import { nodesOf } from '@/services/eeatTrust/graph';
import { node, ref } from './eeatTrustFixtures';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, refs: ReturnType<typeof ref>[], extra: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  url, final_url: url, http_status: 200, request_error_kind: undefined, body_truncated: false,
  schema_references: refs, ...extra,
} as unknown as CrawledPageSummary);
const graph = (...pages: CrawledPageSummary[]) => buildTrustGraph(pages, new Map(pages.map((item) => [item.url, nodesOf(item)])));

describe('trust entity graph', () => {
  it('keeps cross-page definitions under one id while preserving role edges', () => {
    const id = 'https://site.test/team/alex#person';
    const article = page('https://site.test/article', [...node('$', { id: 'https://site.test/article#doc', type: 'Article', props: [['author', id], ['reviewedBy', id], ['publisher', 'https://site.test/#org']] })]);
    const profile = page('https://site.test/team/alex', [...node('$', { id, type: 'Person', name: 'Alex Kowalski', props: [['alternateName', 'A. Kowalski'], ['url', 'https://site.test/team/alex']] }), ...node('$.publisher', { id: 'https://site.test/#org', type: 'Organization', name: 'Site' })]);
    const result = graph(article, profile);
    const person = result.entities.find((entity) => entity.id === id);
    expect(person).toMatchObject({ names: ['Alex Kowalski'], aliases: ['A. Kowalski'], profileUrls: ['https://site.test/team/alex'] });
    expect(result.edges.filter((edge) => edge.to === person?.key).map((edge) => edge.role)).toEqual(['author', 'reviewer']);
    expect(result.diagnostics.some((item) => item.code === 'dangling-reference')).toBe(false);
  });

  it('does not merge homonyms or sameAs aliases', () => {
    const a = page('https://site.test/a', node('$', { id: '#a', type: 'Article', props: [['author', 'Alex']] }));
    const b = page('https://site.test/b', node('$', { id: '#b', type: 'Article', props: [['author', 'Alex']] }));
    const alias = page('https://site.test/alias', [...node('$', { id: '#person', type: 'Person', name: 'Alex', props: [['sameAs', 'https://same.test/#other']] })]);
    expect(graph(a, b, alias).entities.filter((entity) => entity.names.includes('Alex'))).toHaveLength(3);
  });

  it('makes conflicting definitions explicit instead of silently trusting one name', () => {
    const first = page('https://site.test/one', node('$', { id: 'https://site.test/#p', type: 'Person', name: 'Alex One' }));
    const second = page('https://site.test/two', node('$', { id: 'https://site.test/#p', type: 'Person', name: 'Alex Two' }));
    const result = graph(first, second);
    expect(result.diagnostics.some((item) => item.code === 'conflicting-definition')).toBe(true);
    expect(result.entities.find((entity) => entity.id === 'https://site.test/#p')?.names).toEqual(['Alex One', 'Alex Two']);
  });

  it('distinguishes dangling references from truncation and reports role overlap', () => {
    const truncated = page('https://site.test/truncated', [...node('$', { type: 'Article', props: [['author', '#missing'], ['reviewedBy', '#missing']] })], { body_truncated: true });
    const complete = page('https://site.test/complete', [...node('$', { type: 'Article', props: [['author', '#missing']] })]);
    const result = graph(truncated, complete);
    expect(result.diagnostics.filter((item) => item.code === 'indeterminate-reference')).not.toHaveLength(0);
    expect(result.diagnostics.filter((item) => item.code === 'dangling-reference')).toHaveLength(1);
    expect(result.diagnostics.some((item) => item.code === 'role-overlap')).toBe(true);
  });

  it('reports cycles without changing the graph into a score penalty', () => {
    const refs = [
      ...node('$', { id: '#doc', type: 'Article', props: [['author', '#person']] }),
      ...node('$.author', { id: '#person', type: 'Person', name: 'Alex', props: [['author', '#doc']] }),
    ];
    expect(graph(page('https://site.test/cycle', refs)).diagnostics.some((item) => item.code === 'cycle')).toBe(true);
  });
});
