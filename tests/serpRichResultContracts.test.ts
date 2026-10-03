import { expect, it } from 'vitest';
import { deriveSerpRichResult } from '@/services/serpPreview/richResult';
import i18n from '@/i18n';
const schema = (content: unknown) => [{ data_type: 'observed', format: 'JSON-LD', content }] as never;
const field = (key: string, value: string) => ({ label: i18n.t(`serpPreview.${key}`), value });

it.each([null, 4, {}, { '@type': 4 }, { '@type': [null, 'Thing'] }, { '@type': 'Thing' }, { '@type': 'BreadcrumbList', itemListElement: false }, { '@type': 'FAQPage', mainEntity: null }, { '@type': 'Article' }])('does not invent fields for unsupported or empty evidence %j', content => {
  expect(deriveSerpRichResult(schema(content))).toBeNull();
});
it('uses supported types inside a graph without inventing data from invalid entries', () => {
  expect(deriveSerpRichResult(schema({ '@graph': [null, 4, { '@type': ['Thing', 'Product'], name: ' Observed  product ' }] })))
    .toEqual({ type: 'Product', title: i18n.t('serpPreview.productTitle'), fields: [field('name', 'Observed product')] });
});
it('normalizes breadcrumb names, preserves zero positions and bounds entries to eight', () => {
  const rows = [null, 4, {}, { name: ' ' }, ...Array.from({ length: 10 }, (_, position) => ({ name: `Node ${position}`, position }))];
  const result = deriveSerpRichResult(schema({ '@type': 'BreadcrumbList', itemListElement: rows }));
  expect(result?.fields).toEqual(Array.from({ length: 8 }, (_, position) => ({ label: `${position}.`, value: `Node ${position}` })));
  expect(deriveSerpRichResult(schema({ '@type': 'BreadcrumbList', itemListElement: [{ name: 'Home' }] }))?.fields)
    .toEqual([{ label: '•', value: 'Home' }]);
});
it('bounds FAQ questions to five and rejects unsupported name values', () => {
  const rows = [null, false, { name: {} }, ...Array.from({ length: 8 }, (_, index) => ({ name: ` Question ${index} ` }))];
  expect(deriveSerpRichResult(schema({ '@type': 'FAQPage', mainEntity: rows }))?.fields)
    .toEqual(Array.from({ length: 5 }, (_, index) => field('question', `Question ${index}`)));
  expect(deriveSerpRichResult(schema({ '@type': 'FAQPage', mainEntity: [{}] }))).toBeNull();
});
it.each(['Article', 'NewsArticle', 'BlogPosting'])('shows only observed article fields for %s', type => {
  const result = deriveSerpRichResult(schema({ '@type': type, headline: ' Observed ', datePublished: '2026-10-01', author: { name: 'Author' } }));
  expect(result).toEqual({ type, title: i18n.t('serpPreview.articleTitle'), fields: [field('headline', 'Observed'), field('published', '2026-10-01'), field('author', 'Author')] });
  expect(deriveSerpRichResult(schema({ '@type': type, author: 'Literal author' }))?.fields).toEqual([field('author', 'Literal author')]);
});
it('preserves measured zero price and rating; falls back only when reviewCount is absent', () => {
  expect(deriveSerpRichResult(schema({ '@type': 'Product', offers: { price: 0 }, aggregateRating: { ratingValue: 0, ratingCount: 7 } }))?.fields)
    .toEqual([field('price', '0'), field('rating', '0 (7)')]);
  expect(deriveSerpRichResult(schema({ '@type': 'Product', aggregateRating: { ratingValue: 4 } }))?.fields).toEqual([field('rating', '4')]);
  expect(deriveSerpRichResult(schema({ '@type': 'Product', offers: false, aggregateRating: false }))).toBeNull();
});
it('continues after empty supported evidence and ignores malformed graphs', () => {
  const rows = [...schema({ '@type': 'Product', '@graph': false }), ...schema({ '@type': 'FAQPage', mainEntity: [{ name: 'Question' }] })];
  expect(deriveSerpRichResult(rows)?.fields).toEqual([field('question', 'Question')]);
});
