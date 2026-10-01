import type { TopicalEntityFact, TopicalMapDocument } from '@/services/topicalMap';
import i18n from '@/i18n';

export interface SchemaPageSource {
  url: string;
  title?: string;
  description?: string;
  schemaTypes?: string[];
}

export const SCHEMA_ARTICLE_TYPES = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle'] as const;
export type SchemaArticleType = typeof SCHEMA_ARTICLE_TYPES[number];

export interface SchemaGraphInput {
  siteUrl: string;
  page: SchemaPageSource;
  entity: TopicalMapDocument['entity'];
  topicFacts?: TopicalEntityFact[];
  includeOrganization: boolean;
  includeUrlBreadcrumbs?: boolean;
  articleType?: SchemaArticleType | '';
}

export interface GeneratedSchemaGraph {
  schema: Record<string, unknown>;
  omitted: string[];
  usedVerifiedFacts: number;
  usedUrlBreadcrumbs: number;
  usedArticleType: SchemaArticleType | null;
}

const httpUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

const schemaTypeName = (value: string): string => value.trim().split(/[/#:]/u).filter(Boolean).at(-1) ?? '';

const observedArticleTypes = (types: string[] | undefined): SchemaArticleType[] => {
  const observed = new Set((types ?? []).map(schemaTypeName));
  return SCHEMA_ARTICLE_TYPES.filter((type) => observed.has(type));
};

const readablePathSegment = (segment: string): string => {
  let decoded = segment;
  try { decoded = decodeURIComponent(segment); } catch { /* retain the literal URL segment */ }
  return decoded.replace(/[-_]+/gu, ' ').replace(/\s+/gu, ' ').trim();
};

const urlBreadcrumbItems = (pageUrl: URL): Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> => {
  const segments = pageUrl.pathname.split('/').filter(Boolean);
  return segments.flatMap((segment, index) => {
    const name = readablePathSegment(segment);
    if (!name) return [];
    const item = new URL(`/${segments.slice(0, index + 1).join('/')}`, pageUrl.origin);
    return [{ '@type': 'ListItem', position: index + 1, name, item: item.href }];
  });
};

/** Build a conservative JSON-LD graph from explicit project and crawl data only. */
export const generateSchemaGraph = (input: SchemaGraphInput): GeneratedSchemaGraph => {
  const pageUrl = httpUrl(input.page.url);
  if (!pageUrl) throw new Error(i18n.t('runtimeErrors.schema.invalidUrl'));
  pageUrl.hash = '';

  const site = httpUrl(input.siteUrl);
  const siteOrigin = (site ?? pageUrl).origin;
  const pageTitle = input.page.title?.trim();
  const pageDescription = input.page.description?.trim();
  const entityName = input.entity.name.trim();
  const entityDescription = input.entity.description.trim();
  const organizationEnabled = input.includeOrganization && Boolean(entityName);
  const breadcrumbItems = input.includeUrlBreadcrumbs ? urlBreadcrumbItems(pageUrl) : [];
  const selectedArticleType = input.articleType || '';
  const isObservedArticleType = observedArticleTypes(input.page.schemaTypes).includes(selectedArticleType as SchemaArticleType);
  const omitted: string[] = [];
  if (input.includeOrganization && !entityName) omitted.push(i18n.t('runtimeErrors.schema.organizationOmitted'));
  if (!pageTitle) omitted.push(i18n.t('runtimeErrors.schema.titleOmitted'));
  if (!pageDescription) omitted.push(i18n.t('runtimeErrors.schema.descriptionOmitted'));
  if (input.includeUrlBreadcrumbs && !breadcrumbItems.length) omitted.push(i18n.t('runtimeErrors.schema.breadcrumbsOmitted'));
  if (selectedArticleType && !isObservedArticleType) omitted.push(i18n.t('runtimeErrors.schema.articleTypeNotObserved'));
  if (selectedArticleType && isObservedArticleType && !pageTitle) omitted.push(i18n.t('runtimeErrors.schema.articleHeadlineOmitted'));

  const graph: Record<string, unknown>[] = [];
  if (organizationEnabled) {
    const verifiedFacts = [...input.entity.facts, ...(input.topicFacts ?? [])]
      .filter((fact) => fact.reuseStatus === 'verified' && fact.attribute.trim() && fact.value.trim() && httpUrl(fact.sourceUrl));
    graph.push({
      '@type': 'Organization',
      '@id': `${siteOrigin}/#organization`,
      name: entityName,
      url: siteOrigin,
      ...(entityDescription ? { description: entityDescription } : {}),
      ...(verifiedFacts.length ? {
        additionalProperty: verifiedFacts.map((fact) => ({
          '@type': 'PropertyValue',
          name: fact.attribute.trim(),
          value: fact.value.trim(),
          url: fact.sourceUrl,
        })),
      } : {}),
    });
  }
  const webPageId = `${pageUrl.href}#webpage`;
  graph.push({
    '@type': 'WebSite',
    '@id': `${siteOrigin}/#website`,
    url: siteOrigin,
    ...(entityName ? { name: entityName } : {}),
  });
  graph.push({
    '@type': 'WebPage',
    '@id': `${pageUrl.href}#webpage`,
    url: pageUrl.href,
    ...(pageTitle ? { name: pageTitle } : {}),
    ...(pageDescription ? { description: pageDescription } : {}),
    isPartOf: { '@id': `${siteOrigin}/#website` },
    ...(organizationEnabled ? {
      about: { '@id': `${siteOrigin}/#organization` },
      publisher: { '@id': `${siteOrigin}/#organization` },
    } : {}),
  });
  if (breadcrumbItems.length) graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl.href}#breadcrumb`,
    itemListElement: breadcrumbItems,
  });
  if (selectedArticleType && isObservedArticleType && pageTitle) graph.push({
    '@type': selectedArticleType,
    '@id': `${pageUrl.href}#article`,
    url: pageUrl.href,
    headline: pageTitle,
    ...(pageDescription ? { description: pageDescription } : {}),
    mainEntityOfPage: { '@id': webPageId },
    isPartOf: { '@id': `${siteOrigin}/#website` },
    ...(organizationEnabled ? { publisher: { '@id': `${siteOrigin}/#organization` } } : {}),
  });

  return {
    schema: { '@context': 'https://schema.org', '@graph': graph },
    omitted,
    usedVerifiedFacts: organizationEnabled
      ? [...input.entity.facts, ...(input.topicFacts ?? [])].filter((fact) => fact.reuseStatus === 'verified' && fact.attribute.trim() && fact.value.trim() && httpUrl(fact.sourceUrl)).length
      : 0,
    usedUrlBreadcrumbs: breadcrumbItems.length,
    usedArticleType: selectedArticleType && isObservedArticleType && pageTitle ? selectedArticleType as SchemaArticleType : null,
  };
};
