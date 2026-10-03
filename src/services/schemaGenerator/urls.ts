import { SCHEMA_ARTICLE_TYPES, SchemaArticleType } from "./contracts";

export const httpUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

export const schemaTypeName = (value: string): string => {
  const trimmed = value.trim();
  if (SCHEMA_ARTICLE_TYPES.includes(trimmed as SchemaArticleType)) return trimmed;
  const url = httpUrl(trimmed);
  if (!url || !['schema.org', 'www.schema.org'].includes(url.hostname)) return '';
  return `${url.pathname}${url.hash}`.split(/[/#:]/u).filter(Boolean).at(-1) ?? '';
};

export const observedArticleTypes = (types: string[] | undefined): SchemaArticleType[] => {
  const observed = new Set((types ?? []).map(schemaTypeName));
  return SCHEMA_ARTICLE_TYPES.filter((type) => observed.has(type));
};

export const readablePathSegment = (segment: string): string => {
  let decoded = segment;
  try { decoded = decodeURIComponent(segment); } catch { /* retain the literal URL segment */ }
  return decoded.replace(/[-_]+/gu, ' ').replace(/\s+/gu, ' ').trim();
};

export const urlBreadcrumbItems = (pageUrl: URL): Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> => {
  const segments = pageUrl.pathname.split('/').filter(Boolean);
  const items: Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> = [];
  segments.forEach((segment, index) => {
    const name = readablePathSegment(segment);
    if (!name) return;
    const item = new URL(`/${segments.slice(0, index + 1).join('/')}`, pageUrl.origin);
    items.push({ '@type': 'ListItem', position: items.length + 1, name, item: item.href });
  });
  return items;
};
