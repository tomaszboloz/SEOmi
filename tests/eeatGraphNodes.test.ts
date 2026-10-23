import { describe, expect, it } from 'vitest';
import type { CrawledLink, CrawledPageSummary } from '@/types';
import { buildRegistry, childNodes, isArticleNode, isOrganizationNode, isPersonNode, nodesOf, type SchemaNode } from '@/services/eeatTrust/graph';
import { isDeadLink } from '@/services/eeatTrust/citations';
import { node, ref } from './eeatTrustFixtures';

type Refs = ReturnType<typeof ref>[];
const page = (refs: Refs | undefined, extra: Partial<CrawledPageSummary> = {}): CrawledPageSummary =>
  ({ url: 'https://a.test/p', schema_references: refs, ...extra }) as unknown as CrawledPageSummary;

const n = (path: string, types: string[], decl = 0, props: Record<string, string[]> = {}, id?: string): SchemaNode =>
  ({ page: 'u', decl, path, types, props, id });

describe('nodesOf', () => {
  it('groups references per declaration and node path and dedupes values', () => {
    const refs = [
      ...node('$', { id: '#a', type: ['Article', 'Article'], name: 'T', props: [['sameAs', 'x'], ['sameAs', 'x'], ['sameAs', 'y']] }),
      ...node('$.author', { type: 'Person', name: 'Ann' }),
      ...node('$', { type: 'Organization' }, 1),
    ];
    const nodes = nodesOf(page(refs));
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({ id: '#a', types: ['Article'], name: 'T', props: { sameAs: ['x', 'y'] }, page: 'https://a.test/p' });
    expect(nodes[1]).toMatchObject({ path: '$.author', types: ['Person'], name: 'Ann' });
    expect(nodes[2].decl).toBe(1);
  });

  it('ignores non JSON-LD refs, defaults path to root and prefers final_url', () => {
    const micro = { ...ref(0, '$', '@type', 'Person'), format: 'Microdata' } as Refs[number];
    const rootless = { format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' } as Refs[number];
    const nodes = nodesOf(page([micro, rootless], { final_url: 'https://a.test/final' }));
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ path: '$', page: 'https://a.test/final' });
  });

  it('returns no nodes when the page has no schema references', () => {
    expect(nodesOf(page(undefined))).toEqual([]);
  });
});

describe('node type predicates', () => {
  it('matches article and organization types case-insensitively but Person exactly', () => {
    expect(isArticleNode(n('$', ['blogposting']))).toBe(true);
    expect(isArticleNode(n('$', ['Person']))).toBe(false);
    expect(isOrganizationNode(n('$', ['LocalBusiness']))).toBe(true);
    expect(isOrganizationNode(n('$', ['Article']))).toBe(false);
    expect(isPersonNode(n('$', ['Person']))).toBe(true);
    expect(isPersonNode(n('$', ['person']))).toBe(false);
  });
});

describe('childNodes', () => {
  const parent = n('$', ['Article']);
  const all = [
    parent,
    n('$.author', ['Person']),
    n('$.author[1]', ['Person']),
    n('$.authority', ['Person']),
    n('$.author', ['Person'], 1),
    n('$.author.worksFor', ['Organization']),
  ];
  it('keeps same-declaration nodes at the property or its indexed entries', () => {
    expect(childNodes(parent, 'author', all).map((c) => c.path)).toEqual(['$.author', '$.author[1]']);
  });
  it('does not match a property that merely shares a prefix', () => {
    expect(childNodes(parent, 'auth', all)).toEqual([]);
  });
});

describe('buildRegistry', () => {
  it('merges nodes sharing an @id and skips id-less nodes', () => {
    const reg = buildRegistry([
      n('$', ['Organization'], 0, { sameAs: ['a'] }, '#o'),
      { ...n('$', ['LocalBusiness'], 0, { sameAs: ['a', 'b'] }, '#o'), name: 'Acme' },
      n('$', ['Person']),
    ]);
    expect([...reg.keys()]).toEqual(['#o']);
    expect(reg.get('#o')).toMatchObject({ types: ['Organization', 'LocalBusiness'], name: 'Acme', props: { sameAs: ['a', 'b'] } });
  });
});

describe('isDeadLink', () => {
  const link = (extra: object) => ({ target_url: 'https://x.test', is_internal: false, ...extra }) as unknown as CrawledLink;
  it('flags status >= 400 and request errors only', () => {
    expect(isDeadLink(link({ target_http_status: 404 }))).toBe(true);
    expect(isDeadLink(link({ target_http_status: 400 }))).toBe(true);
    expect(isDeadLink(link({ target_http_status: 399 }))).toBe(false);
    expect(isDeadLink(link({ target_request_error_kind: 'timeout' }))).toBe(true);
    expect(isDeadLink(link({}))).toBe(false);
  });
});
