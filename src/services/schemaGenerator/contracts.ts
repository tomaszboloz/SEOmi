import type { TopicalEntityFact, TopicalMapDocument } from '@/services/topicalMap';

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
