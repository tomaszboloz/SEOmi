import { expect, it } from 'vitest';
import { httpUrl, schemaTypeName, observedArticleTypes, readablePathSegment, urlBreadcrumbItems } from '@/services/schemaGenerator/urls';
it('validates HTTP identities and exact Schema.org vocabulary before selecting article families', () => {
  expect(httpUrl('https://site.test/path')?.origin).toBe('https://site.test'); expect(httpUrl('http://site.test/path')?.protocol).toBe('http:');
  expect(httpUrl('not-url')).toBeNull(); expect(httpUrl('file:///tmp/source')).toBeNull();
  expect(schemaTypeName(' Article ')).toBe('Article'); expect(schemaTypeName('https://www.schema.org/BlogPosting')).toBe('BlogPosting'); expect(schemaTypeName('http://schema.org/#NewsArticle')).toBe('NewsArticle');
  expect(schemaTypeName('https://schema.org/')).toBe(''); expect(schemaTypeName('https://other.test/Article')).toBe('');
  expect(observedArticleTypes(undefined)).toEqual([]); expect(observedArticleTypes(['Article', 'Article', 'https://schema.org/NewsArticle', 'Unknown'])).toEqual(['Article', 'NewsArticle']);
});
it('builds readable path labels with literal malformed escapes and contiguous retained positions', () => {
  expect(readablePathSegment('caf%C3%A9__guide')).toBe('café guide'); expect(readablePathSegment('%ZZ')).toBe('%ZZ'); expect(readablePathSegment('___')).toBe('');
  expect(urlBreadcrumbItems(new URL('https://site.test/%ZZ/___/guide?query#fragment'))).toEqual([
    { '@type': 'ListItem', position: 1, name: '%ZZ', item: 'https://site.test/%ZZ' },
    { '@type': 'ListItem', position: 2, name: 'guide', item: 'https://site.test/%ZZ/___/guide' },
  ]);
  expect(urlBreadcrumbItems(new URL('https://site.test/'))).toEqual([]);
});
