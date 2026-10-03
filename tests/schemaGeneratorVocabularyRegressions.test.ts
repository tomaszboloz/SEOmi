import { expect, it } from 'vitest';
import { generateSchemaGraph } from '@/services/schemaGenerator';
it.each(['https://other.test/Article', 'https://schema.org.evil.test/Article', 'other:Article'])('does not treat external vocabulary %s as observed Schema.org Article', type => {
  const result = generateSchemaGraph({ siteUrl: 'https://site.test', page: { url: 'https://site.test/post', title: 'Observed', schemaTypes: [type] },
    entity: { name: '', description: '', facts: [] }, includeOrganization: false, articleType: 'Article',
  });
  expect(result.usedArticleType).toBeNull();
  expect((result.schema['@graph'] as Record<string, unknown>[]).some(node => node['@type'] === 'Article')).toBe(false);
});
it('numbers only retained breadcrumb items while preserving their actual path URLs', () => {
  const result = generateSchemaGraph({ siteUrl: 'https://site.test', page: { url: 'https://site.test/__/guide' },
    entity: { name: '', description: '', facts: [] }, includeOrganization: false, includeUrlBreadcrumbs: true,
  });
  const graph = result.schema['@graph'] as Record<string, unknown>[];
  expect(graph.find(node => node['@type'] === 'BreadcrumbList')?.itemListElement).toEqual([
    { '@type': 'ListItem', position: 1, name: 'guide', item: 'https://site.test/__/guide' },
  ]);
});
