import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { resolveEntities, scanAuthors } from '@/services/eeatTrust/authors';
import { buildTrustReport, combineLayers } from '@/services/eeatTrust/build';
import { analyzeCitations } from '@/services/eeatTrust/citations';
import { buildFindings } from '@/services/eeatTrust/findings';
import { recordTrust } from '@/services/eeatTrust/history';
import { analyzeSchema, schemaScore } from '@/services/eeatTrust/schemaScore';
import { analyzeTransparency } from '@/services/eeatTrust/transparency';
import type { SchemaNode } from '@/services/eeatTrust/graph';
import * as storage from '@/services/storage';
import { NOW, diabetesPages, diabetesFocus, trustedArticle } from './eeatTrustFixtures';

const article = (url = 'https://site.test/article'): SchemaNode => ({ page: url, decl: 0, path: '$', types: ['Article'], props: { author: ['person-id'] } });
const person: SchemaNode = { page: 'https://site.test/article', decl: 0, path: '$.author', id: 'person-id', types: ['Person'], name: 'Ada', props: { jobTitle: ['Coffee Coffee'] } };
const blankChild: SchemaNode = { page: 'https://site.test/article', decl: 0, path: '$.author[1]', types: ['Person'], props: {} };
const page = (patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({ url: 'https://site.test/article', final_url: 'https://site.test/article', http_status: 200, title: 'Article', links: [], schema_references: [], ...patch } as CrawledPageSummary);

describe('coverage 100 E-E-A-T edges', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('resolves inline entities when an id is absent from the registry', () => {
    const parent = article();
    const unknownChild = { ...blankChild, id: 'missing-id' };
    const entities = resolveEntities(parent, 'author', [unknownChild], new Map());
    expect(entities.at(-1)).toMatchObject({ id: 'missing-id' });
  });

  it('scans repeated authors, empty child entities and missing profiles', () => {
    const url = 'https://site.test/article';
    const nodes = new Map([[url, [person, blankChild]]]);
    const articles = new Map([[url, [article(url), article(url)]]]);
    const report = diabetesFocus(diabetesPages());
    const found = scanAuthors(diabetesPages(), nodes, articles, new Map([['person-id', person]]), report);
    expect(found.authors[0]).toMatchObject({ name: 'Ada', articleUrls: [url] });
    expect(scanAuthors([page()], new Map(), new Map([[url, [article(url)]]]), new Map(), undefined).authors).toHaveLength(1);
    const emptyBio = { ...person, id: 'empty-id', name: 'Empty', path: '$.author[0]', props: { jobTitle: [''] } };
    const parent = { ...article(url), props: { author: [] } };
    const emptyAlignment = scanAuthors([page()], new Map([[url, [emptyBio]]]), new Map([[url, [parent]]]), new Map([['empty-id', emptyBio]]), report);
    expect(emptyAlignment.authors[0]?.alignmentPct).toBeUndefined();
  });

  it('uses request URL and empty title fallbacks in a schema report', () => {
    const source = trustedArticle(diabetesPages().find((item) => item.url.includes('/articles/'))!);
    const report = buildTrustReport([{ ...source, final_url: '', title: null }], undefined, { now: NOW });
    expect(report.pageCount).toBe(1);
    expect(report.articleCount).toBe(1);
  });

  it('handles zero denominators in findings and schema scoring', () => {
    const schema = { organization: { present: false, hasId: false, sameAs: [] }, articleCount: 0, articlesWithAuthor: 0, articlesWithDate: 0, articlesWithReviewer: 0, articlesWithCitation: 0, personCount: 0, personsWithId: 0, personsWithSameAs: 0 };
    const base = { schema, authors: [], citations: { pagesAnalyzed: 0, pagesWithTrusted: 0, pagesWithAnyExternal: 0, trustedLinks: 0, externalLinks: 0, checkedLinks: 0, deadLinks: [], pagesWithScholarly: 0, scholarlySources: 0 }, transparency: { found: { editorial: undefined, about: undefined, contact: undefined, registry: undefined }, datedArticles: 0, articles: 0 }, unattributed: 0 } as never;
    expect(buildFindings(base).map((item) => item.code)).toContain('no-articles');
    expect(schemaScore(schema as never, true)).toBe(0);
    expect(analyzeSchema([{ page: 'p', decl: 0, path: '$', types: ['Organization'], props: {} }], new Map(), [], new Set(), new Set()).organization.present).toBe(true);
  });

  it('falls back to the stored history when persistence rejects a write', () => {
    vi.spyOn(storage, 'writeJsonStorage').mockReturnValue(false);
    const trust = buildTrustReport([], undefined, { now: NOW });
    expect(recordTrust('history-p1', trust, 'r1')).toEqual([]);
  });

  it('uses the no-final-url branch while inspecting transparency pages', () => {
    const detail = analyzeTransparency([page({ final_url: '', title: 'Contact' })], new Map());
    expect(detail.found.contact).toBe('https://site.test/article');
    expect(analyzeTransparency([page({ http_status: 500 }), page({ request_error_kind: 'timeout' })], new Map()).articles).toBe(0);
  });

  it('keeps malformed citation targets untrusted', () => {
    const detail = analyzeCitations([page({ final_url: '', links: [{ target_url: 'not-a-url', is_internal: false } as never] })], new Set(['https://site.test/article']), new Map());
    expect(detail.pagesWithTrusted).toBe(0);
  });

  it('supports a layer getter that becomes unavailable during aggregation', () => {
    let reads = 0;
    const layers = new Proxy({}, { get: () => (reads++ === 0 ? 80 : undefined) });
    expect(combineLayers(layers as never)).toBe(0);
  });
});
