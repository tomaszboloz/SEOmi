import { describe, expect, it } from 'vitest';
import { analyzeSchema, schemaScore } from '@/services/eeatTrust/schemaScore';
import type { SchemaNode } from '@/services/eeatTrust/graph';
import type { AuthorEntity, SchemaGraphDetail } from '@/services/eeatTrust/types';

const sn = (types: string[], props: Record<string, string[]> = {}, extra: Partial<SchemaNode> = {}): SchemaNode =>
  ({ page: 'u', decl: 0, path: '$', types, props, ...extra });
const author = (extra: Partial<AuthorEntity>): AuthorEntity =>
  ({ key: 'k', name: 'N', sameAs: [], articleUrls: [], generic: false, profiles: [], ...extra });

describe('analyzeSchema', () => {
  it('summarises organization, dates, citations and named persons', () => {
    const articles = new Map([
      ['p1', [sn(['Article'], { dateModified: ['2026'], citation: ['c'] })]],
      ['p2', [sn(['Article'], { datePublished: ['2025'] })]],
      ['p3', [sn(['Article'])]],
    ]);
    const detail = analyzeSchema(
      [sn(['Organization'], { sameAs: ['a', 'a', 'b'] }, { id: '#o', name: 'Acme' }), sn(['Organization'], { sameAs: ['c'] }, { id: '#o' })],
      articles,
      [author({ id: '#a', sameAs: ['x'] }), author({ id: '#b' }), author({ generic: true, id: '#g', sameAs: ['y'] })],
      new Set(['p1']),
      new Set(),
    );
    expect(detail.organization).toEqual({ present: true, hasId: true, sameAs: ['a', 'b', 'c'], name: 'Acme' });
    expect(detail).toMatchObject({
      articleCount: 3, articlesWithAuthor: 1, articlesWithDate: 2, articlesWithReviewer: 0,
      articlesWithCitation: 1, personCount: 2, personsWithId: 2, personsWithSameAs: 1,
    });
  });

  it('reports an absent organization for empty input', () => {
    const detail = analyzeSchema([], new Map(), [], new Set(), new Set());
    expect(detail.organization).toMatchObject({ present: false, hasId: false, sameAs: [] });
    expect(detail.articleCount).toBe(0);
  });
});

describe('schemaScore', () => {
  const base: SchemaGraphDetail = {
    organization: { present: true, hasId: true, sameAs: ['a'] }, articleCount: 4, articlesWithAuthor: 4, articlesWithDate: 4,
    articlesWithReviewer: 0, articlesWithCitation: 0, personCount: 2, personsWithId: 2, personsWithSameAs: 2,
  };
  const noArticlesNoPersons = { articleCount: 0, articlesWithAuthor: 0, articlesWithDate: 0, personCount: 0, personsWithId: 0, personsWithSameAs: 0 };

  it('gives 100 for a complete non-YMYL graph', () => {
    expect(schemaScore(base, false)).toBe(100);
  });
  it('penalises missing reviewers only for YMYL sites', () => {
    expect(schemaScore(base, true)).toBe(Math.round((0.4 + 0.35 + 0.25 * (2 / 3)) * 100));
  });
  it('scores zero for an empty graph without dividing by zero', () => {
    const empty = { ...base, ...noArticlesNoPersons, organization: { present: false, hasId: false, sameAs: [] } };
    expect(schemaScore(empty, true)).toBe(0);
  });
  it('weights the publisher entity at 40 points', () => {
    expect(schemaScore({ ...base, ...noArticlesNoPersons }, false)).toBe(40);
  });
});
