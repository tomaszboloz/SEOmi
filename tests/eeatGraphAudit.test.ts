import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { auditGraph, pageIslands } from '@/services/eeatTrust/graphAudit';
import { buildFindings } from '@/services/eeatTrust';
import { nodesOf } from '@/services/eeatTrust/graph';
import { node } from './eeatTrustFixtures';

const P = 'Structured data graph: ';
const page = (url: string, refs: ReturnType<typeof node>, messages: string[] = []): CrawledPageSummary => ({
  url, final_url: url, http_status: 200, schema_references: refs, issues: messages.map((message) => ({ severity: 'Warning', message })), links: [],
}) as unknown as CrawledPageSummary;

describe('JSON-LD graph audit (#65)', () => {
  it('classifies the crawler graph findings without re-parsing JSON-LD and dedupes conflicts across pages', () => {
    const audit = auditGraph([
      page('https://s.test/a', [], [
        `${P}author references undeclared local @id https://s.test/#anna in this crawl.`,
        `${P}local @id https://s.test/#org has conflicting @type or name declarations in this crawl.`,
        `${P}person \`Anna Nowak\` appears on multiple crawled pages without a shared @id.`,
        'Unrelated issue.',
      ]),
      page('https://s.test/b', [], [
        `${P}local @id https://s.test/#org has conflicting @type or name declarations in this crawl.`,
        `${P}local @id https://s.test/#org has inconsistent sameAs declarations in this crawl.`,
      ]),
    ]);
    expect(audit.dangling).toEqual([{ page: 'https://s.test/a', property: 'author', id: 'https://s.test/#anna' }]);
    expect(audit.conflicts).toEqual([
      { id: 'https://s.test/#org', kind: 'type-or-name', pages: ['https://s.test/a', 'https://s.test/b'] },
      { id: 'https://s.test/#org', kind: 'same-as', pages: ['https://s.test/b'] },
    ]);
    expect(audit.unshared).toEqual([{ kind: 'person', name: 'Anna Nowak', pages: ['https://s.test/a'] }]);
  });

  it('counts islands: nodes linked by string or nested @id references form one group', () => {
    const linked = page('https://s.test/c', [
      ...node('$.@graph[0]', { id: '#page', type: 'WebPage', props: [['publisher', '#org']] }),
      ...node('$.@graph[0].author', { id: '#anna' }),
      ...node('$.@graph[1]', { id: '#org', type: 'Organization' }),
      ...node('$.@graph[2]', { id: '#anna', type: 'Person' }),
    ]);
    expect(pageIslands(nodesOf(linked))).toEqual({ components: 1, nodes: 3 });
    const split = page('https://s.test/d', [
      ...node('$', { id: '#page', type: 'WebPage' }),
      ...node('$', { type: 'BreadcrumbList' }, 1),
      ...node('$.itemListElement[0]', { type: 'ListItem', props: [['item', 'https://s.test/']] }, 1),
    ]);
    expect(pageIslands(nodesOf(split))).toEqual({ components: 2, nodes: 2 });
    expect(auditGraph([linked, split]).islands).toEqual([{ page: 'https://s.test/d', components: 2, nodes: 2 }]);
    expect(pageIslands([])).toEqual({ components: 0, nodes: 0 });
  });

  it('turns the audit into findings and stays silent without graph evidence', () => {
    const base = { schema: { organization: { present: true, hasId: true, sameAs: ['x'] }, articleCount: 0, articlesWithAuthor: 0, articlesWithDate: 0, articlesWithReviewer: 0, articlesWithCitation: 0, personCount: 0, personsWithId: 0, personsWithSameAs: 0 }, authors: [], citations: { pagesAnalyzed: 0, pagesWithTrusted: 0, pagesWithAnyExternal: 0, trustedLinks: 0, externalLinks: 0, checkedLinks: 0, deadLinks: [], pagesWithScholarly: 0, scholarlySources: 0 }, transparency: { found: { editorial: 'e', about: 'a', contact: 'c', registry: 'r' }, datedArticles: 0, articles: 0 }, unattributed: 0 } as unknown as Parameters<typeof buildFindings>[0];
    const graph = { pagesAudited: 2, dangling: [{ page: 'a', property: 'author', id: '#x' }], conflicts: [{ id: '#o', kind: 'same-as' as const, pages: ['a'] }], unshared: [{ kind: 'person', name: 'Anna', pages: ['a', 'b'] }], islands: [{ page: 'a', components: 2, nodes: 2 }] };
    const codes = buildFindings({ ...base, graph }).map((finding) => finding.code);
    expect(codes).toEqual(expect.arrayContaining(['graph-dangling', 'graph-id-conflict', 'graph-unshared-id', 'graph-islands']));
    expect(buildFindings(base).map((finding) => finding.code).filter((code) => code.startsWith('graph-'))).toEqual([]);
  });
});
