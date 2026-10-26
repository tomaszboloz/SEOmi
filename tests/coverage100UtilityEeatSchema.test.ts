import { describe, expect, it } from 'vitest';
import { scholarlyIds, scholarlyKey } from '@/services/eeatTrust/citationIds';
import { analyzeCitations, citationScore, citationsUnverified, isTrustedHost } from '@/services/eeatTrust/citations';
import { buildFindings } from '@/services/eeatTrust/findings';
import { buildRegistry, childNodes, isArticleNode, isOrganizationNode, isPersonNode, nodesOf } from '@/services/eeatTrust/graph';
import { classifyProfile, classifyProfiles, declarationRecall, hostMatches, orcidChecksumValid } from '@/services/eeatTrust/identifiers';
import { generateSchemaGraph } from '@/services/schemaGenerator';
import { httpUrl, observedArticleTypes, schemaTypeName, urlBreadcrumbItems } from '@/services/schemaGenerator/urls';

describe('E-E-A-T and schema evidence boundaries', () => {
  it('classifies profiles and scholarly identifiers without accepting look-alike hosts', () => {
    expect(hostMatches('sub.orcid.org', 'orcid.org')).toBe(true);
    expect(hostMatches('orcid.org.evil.test', 'orcid.org')).toBe(false);
    expect(orcidChecksumValid('0000-0002-1825-0097')).toBe(true);
    expect(classifyProfile('https://orcid.org/0000-0002-1825-0097')).toMatchObject({ kind: 'orcid', status: 'syntax-valid', tier: 1 });
    expect(classifyProfile('https://linkedin.com/company')).toMatchObject({ kind: 'social', status: 'declared' });
    expect(classifyProfile('not a URL')).toMatchObject({ kind: 'other', status: 'invalid' });
    expect(classifyProfiles(['https://wikidata.org/entity/Q42', 'https://www.wikidata.org/entity/Q42'])).toHaveLength(1);
    expect(declarationRecall(classifyProfiles(['https://orcid.org/0000-0002-1825-0097']))).toBeGreaterThan(0);
    expect(scholarlyIds('https://doi.org/10.1000/ABC.1')).toEqual({ doi: '10.1000/abc.1' });
    expect(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov/12345/')).toEqual({ pmid: '12345' });
    expect(scholarlyIds('https://ncbi.nlm.nih.gov/articles/PMC1234567')).toEqual({ pmcid: 'PMC1234567' });
    expect(scholarlyKey({ pmid: '123' })).toBe('pmid:123');
  });

  it('scores trusted citations and emits ordered findings for missing evidence', () => {
    expect(isTrustedHost('sub.gov.pl')).toBe(true);
    expect(isTrustedHost('gov.example.test')).toBe(false);
    const article = { url: 'https://site.test/article', final_url: 'https://site.test/article', links: [
      { target_url: 'https://doi.org/10.1000/x', is_internal: false, target_http_status: 200 },
      { target_url: 'https://example.test/dead', is_internal: false, target_http_status: 404 },
    ] };
    const detail = analyzeCitations([article] as never, new Set([article.final_url]), new Map());
    expect(detail).toMatchObject({ pagesAnalyzed: 1, pagesWithTrusted: 1, checkedLinks: 2, scholarlySources: 1 });
    expect(citationScore(detail)).toBe(75);
    expect(citationsUnverified({ ...detail, checkedLinks: 0 })).toBe(true);
    expect(citationScore({ ...detail, checkedLinks: 0, deadLinks: [] })).toBe(75);
    const findings = buildFindings({
      schema: { organization: { present: false, hasId: false, sameAs: [] }, articleCount: 2, articlesWithAuthor: 0, articlesWithDate: 0, articlesWithReviewer: 0, articlesWithCitation: 0, personCount: 0, personsWithId: 0, personsWithSameAs: 0 },
      authors: [], citations: { ...detail, pagesWithTrusted: 0, checkedLinks: 0, deadLinks: [], scholarlySources: 0 },
      transparency: { found: { editorial: undefined, about: undefined, contact: undefined, registry: undefined }, datedArticles: 0, articles: 2 }, ymyl: 'health', unattributed: 2,
    });
    expect(findings.map((finding) => finding.code)).toContain('ymyl-unattributed');
    expect(findings[0].severity).toBe('critical');
  });

  it('rebuilds schema nodes and conservative article graphs', () => {
    const page = { url: 'https://site.test/post', final_url: 'https://site.test/post', schema_references: [
      { format: 'JSON-LD', declaration_index: 0, node_path: '$', property: '@id', value: 'https://site.test/#org' },
      { format: 'JSON-LD', declaration_index: 0, node_path: '$', property: '@type', value: 'Organization' },
      { format: 'JSON-LD', declaration_index: 0, node_path: '$.author[0]', property: '@type', value: 'Person' },
    ] };
    const nodes = nodesOf(page as never);
    expect(nodes).toHaveLength(2);
    expect(isOrganizationNode(nodes[0])).toBe(true);
    expect(isPersonNode(nodes[1])).toBe(true);
    expect(childNodes(nodes[0], 'author', nodes)).toHaveLength(1);
    expect(buildRegistry(nodes).has('https://site.test/#org')).toBe(true);
    expect(isArticleNode({ types: ['Article'], props: {} } as never)).toBe(true);
    expect(schemaTypeName('https://schema.org/Article')).toBe('Article');
    expect(observedArticleTypes(['Article'])).toEqual(['Article']);
    expect(httpUrl('ftp://site.test')).toBeNull();
    expect(urlBreadcrumbItems(new URL('https://site.test/a%20page/two'))[0].name).toBe('a page');
    const graph = generateSchemaGraph({ siteUrl: 'https://site.test', page: { url: 'https://site.test/post', title: 'Post', description: 'Desc', schemaTypes: ['Article'] }, entity: { name: 'Site', description: '', facts: [] }, includeOrganization: true, includeUrlBreadcrumbs: false, articleType: 'Article' });
    expect(graph.usedArticleType).toBe('Article');
    expect((graph.schema['@graph'] as Array<Record<string, unknown>>).some((node) => node['@type'] === 'Article')).toBe(true);
  });
});
