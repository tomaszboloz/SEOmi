import { expect, it } from 'vitest';
import { deriveSerpRichResult, deriveSerpSitelinks } from '@/services/serpPreview';
import i18n from '@/i18n';

it('preserves an observed zero review count instead of replacing it with rating count', () => {
  const result = deriveSerpRichResult([{ data_type: 'Product', format: 'JSON-LD', content: {
    '@type': 'Product', aggregateRating: { ratingValue: 4, reviewCount: 0, ratingCount: 12 },
  } }]);
  expect(result?.fields).toEqual([{ label: i18n.t('serpPreview.rating'), value: '4 (0)' }]);
});

it('excludes the current document from sitelinks even when its URL contains a fragment', () => {
  expect(deriveSerpSitelinks([
    { href: '#other', text: 'Current section', is_internal: true },
    { href: '/page', text: 'Current page', is_internal: true },
    { href: '/contact', text: 'Contact', is_internal: true },
  ], 'https://site.test/page#intro')).toEqual([
    { url: 'https://site.test/contact', label: 'Contact', displayUrl: 'site.test › contact' },
  ]);
});
