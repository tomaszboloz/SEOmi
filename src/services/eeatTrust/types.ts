import type { Coded } from '@/services/siteFocus';
import type { PageCitationQuality } from './citationQuality';
import type { ClaimCitation } from '@/services/citationEvidence/claims';

/** E-E-A-T & Entity Trust Verifier contracts. Wording is a code plus params: the UI localizes. */

export const EEAT_TRUST_VERSION = 2;
export const LEGACY_EEAT_TRUST_VERSION = 1;
export const TRUST_PROFILE_ID = 'eetv-5-layer-v2';
/** Sub-scoring of the citation and schema layers (#88, #65); layer weights stay under TRUST_PROFILE_ID. Legacy stays the default so stored history remains comparable; claim-backed-v1 is opt-in through TrustOptions.scoringProfile. Missing in stored history means legacy. */
export type ScoringProfile = 'legacy' | 'claim-backed-v1';
export const SCORING_PROFILE: ScoringProfile = 'legacy';
export const CLAIM_BACKED_PROFILE: ScoringProfile = 'claim-backed-v1';
export const LEGACY_TRUST_PROFILE_ID = 'eetv-4-layer-v1';

export type TrustLevel = 'strong' | 'adequate' | 'weak' | 'critical';
export type TrustAvailability = 'observed' | 'unavailable';
export type YmylCategory = 'health' | 'finance' | 'legal';
export type TrustSeverity = 'critical' | 'warning' | 'info';
export type TransparencyKind = 'editorial' | 'about' | 'contact' | 'registry';

export interface TrustFinding extends Coded { severity: TrustSeverity }

/** Versioned five-layer profile; missing layers stay unknown and are renormalized explicitly. */
export const TRUST_WEIGHTS = { schemaGraph: 0.25, sameAs: 0.2, authorAlignment: 0.25, citationQuality: 0.2, transparency: 0.1 } as const;
export const LEGACY_TRUST_WEIGHTS = { schemaGraph: 0.3, authorAlignment: 0.25, citationQuality: 0.25, transparency: 0.2 } as const;
export type TrustLayer = keyof typeof TRUST_WEIGHTS;
export type TrustCoverageState = 'observed' | 'declared' | 'verified' | 'unknown';
export interface TrustCoverage { observed: number; declared: number; verified: number; unknown: number }

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
  bio?: string;
  credentials?: string[];
  knowsAbout?: string[];
  sameAs: string[];
  articleUrls: string[];
  /** "Redakcja", "Editorial team", "admin": an anonymous byline. */
  generic: boolean;
  /** Percent 0-100 against the Core Topic; undefined when the crawl holds no bio signal. */
  alignmentPct?: number;
  /** Syntax-only classification of sameAs links; never fetched, so never "verified". */
  profiles: ProfileEvidence[];
  reconciliation?: EntityReconciliation;
}

export type ProfileKind = 'orcid' | 'wikidata' | 'register' | 'social' | 'other';
export type ProfileStatus = 'syntax-valid' | 'declared' | 'fetched' | 'verified' | 'mismatch' | 'unavailable' | 'invalid';

export interface ProfileEvidence {
  url: string; kind: ProfileKind; status: ProfileStatus; tier?: 1 | 2 | 3; id?: string;
  fetchedAt?: string; expiresAt?: string; sourceDate?: string; detail?: string;
  /** Registry record actually fetched for a live lookup (ORCID public API, Wikidata wbgetentities). */
  lookupUrl?: string;
  /** Declared name and aliases of the entity owning this profile; input of the default identity matcher. */
  subjects?: string[];
}
export type EntityRole = 'author' | 'reviewer' | 'publisher';
export interface EntityReconciliation {
  role: EntityRole; profiles: ProfileEvidence[]; declarationRecall: number;
  status: ProfileStatus | 'unavailable'; evidence: 'declared' | 'registry' | 'manual';
}
/** Reviewer or publisher named by article JSON-LD, with syntax-only sameAs evidence (never "verified" offline). */
export interface RoleEntity {
  role: Exclude<EntityRole, 'author'>; key: string; name: string; id?: string;
  sameAs: string[]; articleUrls: string[]; reconciliation: EntityReconciliation;
}

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
  /** Bounded claim-to-source associations; lexical overlap never marks a claim manually checked. */
  claimEvidence?: ClaimCitation[];
  unbackedHighStakesClaims?: number;
  /** Per-page source quality sums and claim backing; absent in reports stored before claim-backed-v1. */
  pageQuality?: PageCitationQuality[];
  claimCount?: number;
  /** Mean per-page R_backed 0-1. */
  rBacked?: number;
}

export interface TransparencyDetail {
  found: Record<TransparencyKind, string | undefined>;
  datedArticles: number;
  articles: number;
}

export interface TrustReport {
  availability: TrustAvailability;
  score: number | null;
  level: TrustLevel | null;
  /** 0-100 per layer, undefined when the crawl has no data for it. */
  layers: Partial<Record<TrustLayer, number>>;
  profileVersion: number;
  profileId: string;
  scoringProfile?: ScoringProfile;
  coverage: Partial<Record<TrustLayer, TrustCoverage>>;
  ymyl?: YmylCategory;
  ymylPolicy?: { category: YmylCategory; applicable: boolean; multiplier: number; triggered: boolean; heuristic: true; tier?: 'none' | 'moderate' | 'severe'; reasons?: string[]; claimGate?: boolean };
  schema: SchemaGraphDetail;
  authors: AuthorEntity[];
  /** Reviewers and publishers; absent in reports stored before #87. */
  roleEntities?: RoleEntity[];
  /** Role-weighted sameAs declaration recall 0-1; undefined when no role is named. */
  roleRecall?: number;
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

export interface TrustSnapshot {
  at: string; runId: string; score: number; layers: Partial<Record<TrustLayer, number>>;
  profileVersion?: number; profileId?: string; scoringProfile?: ScoringProfile; coverage?: Partial<Record<TrustLayer, TrustCoverage>>;
}
