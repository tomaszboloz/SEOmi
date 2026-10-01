import { expect, it } from 'vitest';
import { generateSchemaGraph } from '@/services/schemaGenerator';
import i18n from '@/i18n';
it('uses the page origin when site identity is invalid and does not invent omitted visible evidence', () => {
  const result = generateSchemaGraph({ siteUrl: 'invalid', page: { url: 'https://site.test/', title: '', schemaTypes: ['Article'] }, entity: { name: '', description: '', facts: [] },
    includeOrganization: true, includeUrlBreadcrumbs: true, articleType: 'Article',
  });
  expect(result.usedArticleType).toBeNull(); expect(result.usedUrlBreadcrumbs).toBe(0);
  expect(result.omitted).toContain(i18n.t('runtimeErrors.schema.articleHeadlineOmitted')); expect(result.omitted).toContain(i18n.t('runtimeErrors.schema.breadcrumbsOmitted'));
  expect((result.schema['@graph'] as Record<string, unknown>[])[0].url).toBe('https://site.test');
});
it('uses only complete verified facts from explicit entity/topic sources and preserves article publisher links', () => {
  const fact = { id: 'one', attribute: 'Observed', value: '0', reuseStatus: 'verified' as const, sourceUrl: 'https://source.test' };
  const result = generateSchemaGraph({ siteUrl: 'https://site.test', page: { url: 'https://site.test/post', title: 'Observed', description: 'Description', schemaTypes: ['Article'] },
    entity: { name: 'Organization', description: '', facts: [fact, { ...fact, id: 'empty-attribute', attribute: ' ' }, { ...fact, id: 'empty-value', value: ' ' }] },
    topicFacts: [{ ...fact, id: 'topic', attribute: 'Topic' }], includeOrganization: true, articleType: 'Article',
  });
  expect(result.usedVerifiedFacts).toBe(2); expect(result.usedArticleType).toBe('Article');
  const graph = result.schema['@graph'] as Record<string, unknown>[];
  expect(graph[0].additionalProperty).toEqual([{ '@type': 'PropertyValue', name: 'Observed', value: '0', url: 'https://source.test' }, { '@type': 'PropertyValue', name: 'Topic', value: '0', url: 'https://source.test' }]);
  expect(graph.find(node => node['@type'] === 'Article')).toMatchObject({ description: 'Description', publisher: { '@id': 'https://site.test/#organization' } });
});
it('does not attach empty fact properties when organization data has no reusable evidence', () => {
  const result = generateSchemaGraph({ siteUrl: 'https://site.test', page: { url: 'https://site.test/post', title: 'Observed', schemaTypes: ['Article'] },
    entity: { name: 'Organization', description: '', facts: [] }, includeOrganization: true, articleType: 'Article',
  });
  const graph = result.schema['@graph'] as Record<string, unknown>[];
  expect(graph[0].additionalProperty).toBeUndefined(); expect(result.usedVerifiedFacts).toBe(0);
  expect(graph.find(node => node['@type'] === 'Article')?.description).toBeUndefined();
});
