import type { StructuredData } from '@/types';
import i18n from '@/i18n';
import type { SerpRichResultField, SerpRichResultPreview } from './types';

const scalarText = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).replace(/\s+/gu, ' ').trim();
    return text || null;
  }
  return null;
};

const schemaTypes = (content: Record<string, unknown>): string[] => {
  const value = content['@type'];
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};

const typedSchemaObjects = (structuredData: StructuredData[]): Array<{ content: Record<string, unknown>; types: string[] }> => structuredData
  .flatMap((entry) => {
    const content = entry.content && typeof entry.content === 'object' ? entry.content : null;
    if (!content) return [];
    const graph = Array.isArray(content['@graph']) ? content['@graph'].filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : [];
    return [{ content, types: schemaTypes(content) }, ...graph.map((item) => ({ content: item, types: schemaTypes(item) }))];
  });

/**
 * Extracts only the most useful bounded rich-result evidence from structured
 * data already present in the audit. Missing properties remain missing rather
 * than being filled with assumptions.
 */
export const deriveSerpRichResult = (structuredData: StructuredData[]): SerpRichResultPreview | null => {
  for (const { content, types } of typedSchemaObjects(structuredData)) {
    const type = types.find((item) => ['BreadcrumbList', 'Product', 'Article', 'NewsArticle', 'BlogPosting', 'FAQPage'].includes(item));
    if (!type) continue;
    if (type === 'BreadcrumbList') {
      const items = Array.isArray(content.itemListElement) ? content.itemListElement.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const value = item as Record<string, unknown>;
        const name = scalarText(value.name);
        const position = scalarText(value.position);
        return name ? [{ label: position ? `${position}.` : '•', value: name }] : [];
      }).slice(0, 8) : [];
      if (items.length) return { type, title: i18n.t('serpPreview.breadcrumbTitle'), fields: items };
    }
    if (type === 'Product') {
      const fields: SerpRichResultField[] = [];
      const name = scalarText(content.name);
      const offers = content.offers && typeof content.offers === 'object' ? content.offers as Record<string, unknown> : null;
      const rating = content.aggregateRating && typeof content.aggregateRating === 'object' ? content.aggregateRating as Record<string, unknown> : null;
      if (name) fields.push({ label: i18n.t('serpPreview.name'), value: name });
      const price = scalarText(offers?.price);
      const currency = scalarText(offers?.priceCurrency);
      if (price) fields.push({ label: i18n.t('serpPreview.price'), value: currency ? `${price} ${currency}` : price });
      const ratingValue = scalarText(rating?.ratingValue);
      const reviewCount = scalarText(rating?.reviewCount ?? rating?.ratingCount);
      if (ratingValue) fields.push({ label: i18n.t('serpPreview.rating'), value: reviewCount ? `${ratingValue} (${reviewCount})` : ratingValue });
      if (fields.length) return { type, title: i18n.t('serpPreview.productTitle'), fields };
    }
    if (['Article', 'NewsArticle', 'BlogPosting'].includes(type)) {
      const fields: SerpRichResultField[] = [];
      const headline = scalarText(content.headline);
      const published = scalarText(content.datePublished);
      const author = scalarText(typeof content.author === 'object' && content.author ? (content.author as Record<string, unknown>).name : content.author);
      if (headline) fields.push({ label: i18n.t('serpPreview.headline'), value: headline });
      if (published) fields.push({ label: i18n.t('serpPreview.published'), value: published });
      if (author) fields.push({ label: i18n.t('serpPreview.author'), value: author });
      if (fields.length) return { type, title: i18n.t('serpPreview.articleTitle'), fields };
    }
    if (type === 'FAQPage') {
      const fields = Array.isArray(content.mainEntity) ? content.mainEntity.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const question = item as Record<string, unknown>;
        const name = scalarText(question.name);
        return name ? [{ label: i18n.t('serpPreview.question'), value: name }] : [];
      }).slice(0, 5) : [];
      if (fields.length) return { type, title: i18n.t('serpPreview.faqTitle'), fields };
    }
  }
  return null;
};
