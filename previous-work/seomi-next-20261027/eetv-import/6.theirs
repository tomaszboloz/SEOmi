import type { Coded } from '@/services/siteFocus';

/** E-E-A-T & Entity Trust Verifier contracts. Wording is a code plus params: the UI localizes. */

export const EEAT_TRUST_VERSION = 1;

export type TrustLevel = 'strong' | 'adequate' | 'weak' | 'critical';
export type YmylCategory = 'health' | 'finance' | 'legal';
export type TrustSeverity = 'critical' | 'warning' | 'info';
export type TransparencyKind = 'editorial' | 'about' | 'contact' | 'registry';

export interface TrustFinding extends Coded { severity: TrustSeverity }

export type TrustGraphRole = 'document' | 'author' | 'reviewer' | 'publisher';
export interface TrustGraphEntity {
  key: string;
  id?: string;
  names: string[];
  types: string[];
  roles: TrustGraphRole[];
  sameAs: string[];
  aliases: string[];
  profileUrls: string[];
  sourcePages: string[];
  declarations: Array<{ sourcePage: string; declaration: number; nodePath: string }>;
  complete: boolean;
}
export interface TrustGraphEdge {
  from: string;
  to: string;
  role: Exclude<TrustGraphRole, 'document'>;
  property: string;
  sourcePage: string;
  declaration: number;
  nodePath: string;
  rawValue: string;
}
export interface TrustGraphDiagnostic {
  code: 'conflicting-definition' | 'dangling-reference' | 'indeterminate-reference' | 'incomplete-definition' | 'cycle' | 'role-overlap';
  severity: TrustSeverity;
  sourcePage?: string;
  declaration?: number;
  nodePath?: string;
  entityKey?: string;
  target?: string;
}
export interface TrustGraph {
  entities: TrustGraphEntity[];
  edges: TrustGraphEdge[];
  diagnostics: TrustGraphDiagnostic[];
}

/** Weights of the four layers; a layer without data is dropped and the rest renormalized. */
export const TRUST_WEIGHTS = { schemaGraph: 0.3, authorAlignment: 0.25, citationQuality: 0.25, transparency: 0.2 } as const;
export type TrustLayer = keyof typeof TRUST_WEIGHTS;

export interface SchemaGraphDetail {
  organization: { present: boolean; hasId: boolean; sameAs: string[]; name?: string };
  articleCount: number;
  articlesWithAuthor: number;
  articlesWithDate: number;
  articlesWithReviewer: number;
  articlesWithCitation: number;
  personCount: number;
  personsWithId: number;
  personsWithSameAs: number;
}

export interface AuthorEntity {
  key: string;
  name: string;
  id?: string;
  jobTitle?: string;
  sameAs: string[];
  aliases?: string[];
  profileUrls?: string[];
  articleUrls: string[];
  /** "Redakcja", "Editorial team", "admin": an anonymous byline. */
  generic: boolean;
  /** Percent 0-100 against the Core Topic; undefined when the crawl holds no bio signal. */
  alignmentPct?: number;
  /** Syntax-only classification of sameAs links; never fetched, so never "verified". */
  profiles: ProfileEvidence[];
}

export type ProfileKind = 'orcid' | 'wikidata' | 'register' | 'social' | 'other';
export type ProfileStatus = 'syntax-valid' | 'declared' | 'invalid';

export interface ProfileEvidence { url: string; kind: ProfileKind; status: ProfileStatus; tier?: 1 | 2 | 3; id?: string }

export interface CitationDetail {
  pagesAnalyzed: number;
  pagesWithTrusted: number;
  pagesWithAnyExternal: number;
  trustedLinks: number;
  externalLinks: number;
  checkedLinks: number;
  deadLinks: Array<{ page: string; target: string; status?: number }>;
  /** Article pages citing at least one DOI/PMID/PMCID source, and unique identified sources. */
  pagesWithScholarly: number;
  scholarlySources: number;
}

export interface TransparencyDetail {
  found: Record<TransparencyKind, string | undefined>;
  datedArticles: number;
  articles: number;
}

export interface TrustReport {
  score: number;
  level: TrustLevel;
  /** 0-100 per layer, undefined when the crawl has no data for it. */
  layers: Partial<Record<TrustLayer, number>>;
  ymyl?: YmylCategory;
  schema: SchemaGraphDetail;
  graph?: TrustGraph;
  authors: AuthorEntity[];
  citations: CitationDetail;
  transparency: TransparencyDetail;
  findings: TrustFinding[];
  /** Percent of YMYL articles lacking a named author or reviewer. */
  ymylUnattributedPct?: number;
  pageCount: number;
  articleCount: number;
  generatedAt: string;
  version: number;
}

export interface TrustSnapshot { at: string; runId: string; score: number; layers: Partial<Record<TrustLayer, number>> }
