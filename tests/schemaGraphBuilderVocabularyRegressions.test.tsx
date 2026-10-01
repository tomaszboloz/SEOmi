import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SchemaGraphBuilder } from '@/components/Charts/SchemaGraphBuilder';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { createCrawlPageFixture } from './fixtures/crawl';
import i18n from '@/i18n';
const props = (schema_types: string[]) => ({
  document: createEmptyTopicalMap(), pages: [createCrawlPageFixture({ url: 'https://site.test/post', final_url: 'https://site.test/post', schema_types })],
  siteUrl: 'https://site.test', selectedUrl: 'https://site.test/post', includeOrganization: false, includeUrlBreadcrumbs: false, articleType: '' as const,
  onSelectedUrlChange: vi.fn(), onIncludeOrganizationChange: vi.fn(), onIncludeUrlBreadcrumbsChange: vi.fn(), onArticleTypeChange: vi.fn(),
});
it.each(['https://other.test/Article', 'https://schema.org.evil.test/Article', 'other:Article'])('does not offer an article type from external vocabulary %s', type => {
  render(<SchemaGraphBuilder {...props([type])} />);
  expect(screen.queryByRole('combobox', { name: i18n.t('schemaUi.articleTypeAria') })).toBeNull();
});
it('offers only known local/Schema.org types when declarations mix vocabularies', () => {
  render(<SchemaGraphBuilder {...props(['https://other.test/Article', 'https://schema.org/NewsArticle'])} />);
  const selector = screen.getByRole('combobox', { name: i18n.t('schemaUi.articleTypeAria') });
  expect(Array.from((selector as HTMLSelectElement).options).map(option => option.value)).toEqual(['', 'NewsArticle']);
});
